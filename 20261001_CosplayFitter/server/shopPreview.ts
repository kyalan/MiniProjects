import { shopSearchUrl } from "../shared/shops.ts";

const CACHE_MS = 30 * 60 * 1000;
const PAGE_TIMEOUT_MS = 8_000;
const IMAGE_LIMIT_BYTES = 1_500_000;

const BROWSER =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

interface CacheEntry {
  at: number;
  ttl: number;
  body: Buffer | null;
  contentType: string;
}

const cache = new Map<string, CacheEntry>();

const PAGE_PATTERNS: Record<string, RegExp[]> = {
  taobao: [/(?:https?:)?\/\/(?:img|gw|imgextra)\.alicdn\.com\/[^"'\s<>()]+\.(?:jpg|jpeg|webp)/gi],
  aliexpress: [
    /(?:https?:)?\/\/[^"'\s<>()]*aliexpress-media\.com\/kf\/[^"'\s<>()]+\.(?:avif|jpg|jpeg|webp)/gi,
    /(?:https?:)?\/\/[^"'\s<>()]*alicdn\.com\/kf\/[^"'\s<>()]+\.(?:avif|jpg|jpeg|webp)/gi,
    /ae-pic[^"'\s<>()]*aliexpress-media\.com\/kf\/[^"'\s<>()]+\.(?:avif|jpg|jpeg|webp)/gi,
  ],
  amazon: [/https?:\/\/m\.media-amazon\.com\/images\/I\/[A-Za-z0-9%+._,-]+\.(?:jpg|jpeg|webp)/gi],
  ebay: [/https?:\/\/i\.ebayimg\.com\/images\/[^"'\s<>()]+\.(?:jpg|jpeg|webp)/gi],
};

export function extractProductImage(shopId: string, html: string): string | null {
  const patterns = PAGE_PATTERNS[shopId];
  if (!patterns) return null;
  const page = html
    .replace(/\\u002F/gi, "/")
    .replace(/\\\//g, "/")
    .replace(/\\u0026/gi, "&")
    .replace(/&amp;/g, "&");
  const found: string[] = [];
  for (const pattern of patterns) {
    for (const match of page.matchAll(pattern)) {
      const url = cleanUrl(match[0]);
      if (url && hostAllowed(url) && !junk(url)) found.push(url);
    }
  }
  return prefer(shopId, found);
}

export async function loadShopPreview(
  shopId: string,
  query: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ body: Buffer; contentType: string } | null> {
  const pageUrl = shopSearchUrl(shopId, query);
  if (!pageUrl) return null;
  const key = `${shopId}\n${query.trim()}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < hit.ttl) {
    return hit.body ? { body: hit.body, contentType: hit.contentType } : null;
  }
  const html = await fetchText(pageUrl, fetchImpl);
  const imageUrl = html ? extractProductImage(shopId, html) : null;
  const image = imageUrl ? await fetchImage(imageUrl, pageUrl, fetchImpl) : null;
  cache.set(key, {
    at: Date.now(),
    ttl: image ? CACHE_MS : 2 * 60 * 1000,
    body: image?.body ?? null,
    contentType: image?.contentType ?? "",
  });
  return image;
}

function prefer(shopId: string, urls: string[]): string | null {
  const unique = [...new Set(urls)];
  const ranked = unique.sort((left, right) => score(shopId, right) - score(shopId, left));
  return ranked[0] ?? null;
}

function score(shopId: string, url: string): number {
  if (shopId === "ebay" && /\/s-l500\./i.test(url)) return 5;
  if (shopId === "ebay" && /\/s-l400\./i.test(url)) return 4;
  if (shopId === "amazon" && /_AC_UL320_/i.test(url)) return 5;
  if (shopId === "aliexpress" && /480x480/i.test(url)) return 5;
  if (/\.(?:avif|jpg|jpeg|webp)(?:$|\?)/i.test(url)) return 3;
  return 1;
}

function junk(url: string): boolean {
  return /sprite|icon|logo|pixel|1x1|blank|placeholder|avatar|96x96|48x48|44x32|tps-\d+-\d+|\.(?:gif|ico|css|js)(?:$|\?)/i.test(
    url,
  );
}

function cleanUrl(raw: string): string | null {
  const text = raw
    .replace(/\\u002F/gi, "/")
    .replace(/\\\//g, "/")
    .replace(/\\u0026/gi, "&")
    .replace(/&amp;/g, "&")
    .replace(/\\+$/g, "")
    .replace(/[),.;]+$/g, "");
  const absolute = text.startsWith("//")
    ? `https:${text}`
    : /^[a-z0-9.-]+\.[a-z]{2,}\//i.test(text)
      ? `https://${text}`
      : text;
  try {
    const url = new URL(absolute);
    if (url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

function hostAllowed(url: string): boolean {
  const host = new URL(url).hostname;
  if (host === "m.media-amazon.com" || host === "i.ebayimg.com") return true;
  return host.endsWith(".alicdn.com") || host.endsWith(".aliexpress-media.com");
}

async function fetchText(url: string, fetchImpl: typeof fetch): Promise<string | null> {
  try {
    const origin = new URL(url).origin;
    const cookie = await warmupCookies(origin, fetchImpl);
    const response = await fetchImpl(url, {
      headers: {
        "user-agent": BROWSER,
        accept: "text/html,application/xhtml+xml",
        "accept-language": "en-US,en;q=0.9",
        referer: `${origin}/`,
        ...(cookie ? { cookie } : {}),
      },
      redirect: "follow",
      signal: AbortSignal.timeout(PAGE_TIMEOUT_MS),
    });
    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  }
}

async function warmupCookies(origin: string, fetchImpl: typeof fetch): Promise<string> {
  try {
    const response = await fetchImpl(`${origin}/`, {
      headers: { "user-agent": BROWSER, accept: "text/html", "accept-language": "en-US,en;q=0.9" },
      redirect: "manual",
      signal: AbortSignal.timeout(PAGE_TIMEOUT_MS),
    });
    const headers = response.headers as Headers & { getSetCookie?: () => string[] };
    const cookies = headers.getSetCookie?.() ?? [];
    return cookies
      .map((item) => item.split(";")[0]?.trim() ?? "")
      .filter(Boolean)
      .join("; ");
  } catch {
    return "";
  }
}

async function fetchImage(
  url: string,
  referer: string,
  fetchImpl: typeof fetch,
): Promise<{ body: Buffer; contentType: string } | null> {
  try {
    const response = await fetchImpl(url, {
      headers: { "user-agent": BROWSER, accept: "image/*", referer },
      redirect: "follow",
      signal: AbortSignal.timeout(PAGE_TIMEOUT_MS),
    });
    if (!response.ok) return null;
    if (!hostAllowed(response.url || url)) return null;
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.startsWith("image/")) return null;
    const body = Buffer.from(await response.arrayBuffer());
    if (body.length === 0 || body.length > IMAGE_LIMIT_BYTES) return null;
    return { body, contentType: contentType.split(";")[0] ?? contentType };
  } catch {
    return null;
  }
}
