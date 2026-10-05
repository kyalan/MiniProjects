import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { getCharacter, getTopic, type AcgCharacter, type AcgTopic } from "../shared/acg.ts";
import type { AllowedMimeType } from "../shared/types.ts";

export interface CachedPortrait {
  imageBase64: string;
  mimeType: AllowedMimeType;
}

export type LoadPortrait = (topicId: string, characterId: string) => Promise<CachedPortrait | null>;

const MISS_TTL_MS = 60 * 60 * 1000;
const EXTENSIONS = ["jpg", "png", "webp"] as const;

const MIME_FOR_EXT: Record<(typeof EXTENSIONS)[number], AllowedMimeType> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

interface RosterEntry {
  name: string;
  imageUrl: string;
}

function normalizeName(value: string): string {
  return value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "");
}

function sniff(bytes: Buffer): AllowedMimeType | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes.toString("ascii", 1, 4) === "PNG") return "image/png";
  if (bytes.length >= 12 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP") {
    return "image/webp";
  }
  return null;
}

function extensionFor(mimeType: AllowedMimeType): (typeof EXTENSIONS)[number] {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  return "jpg";
}

const PREVIEW_WIDTH = "800";

function httpsUrl(value: unknown): string {
  return typeof value === "string" && /^https:\/\//.test(value) ? value : "";
}

function wikiQuery(api: string, params: Record<string, string>): string {
  const url = new URL(api);
  url.searchParams.set("action", "query");
  url.searchParams.set("format", "json");
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url.toString();
}

function firstPage(payload: unknown): Record<string, unknown> | null {
  if (!payload || typeof payload !== "object") return null;
  const pages = (payload as { query?: { pages?: unknown } }).query?.pages;
  if (!pages || typeof pages !== "object") return null;
  for (const page of Object.values(pages as Record<string, unknown>)) {
    if (!page || typeof page !== "object" || "missing" in page) continue;
    return page as Record<string, unknown>;
  }
  return null;
}

async function wikiImageUrl(fetchImpl: typeof fetch, topic: AcgTopic, character: AcgCharacter): Promise<string | null> {
  if (!topic.wikiApi) return null;
  const endpoint = character.previewFile
    ? wikiQuery(topic.wikiApi, {
        titles: `File:${character.previewFile}`,
        prop: "imageinfo",
        iiprop: "url",
        iiurlwidth: PREVIEW_WIDTH,
      })
    : character.previewPage
      ? wikiQuery(topic.wikiApi, {
          titles: character.previewPage,
          prop: "pageimages",
          piprop: "thumbnail",
          pithumbsize: PREVIEW_WIDTH,
        })
      : "";
  if (!endpoint) return null;
  const response = await fetchImpl(endpoint, { signal: AbortSignal.timeout(20_000) });
  if (!response.ok) return null;
  const page = firstPage(await response.json());
  if (!page) return null;
  if (character.previewFile) {
    const info = Array.isArray(page.imageinfo) ? page.imageinfo[0] : null;
    if (!info || typeof info !== "object") return null;
    const record = info as { thumburl?: unknown; url?: unknown };
    return httpsUrl(record.thumburl) || httpsUrl(record.url) || null;
  }
  const thumbnail = page.thumbnail;
  if (!thumbnail || typeof thumbnail !== "object") return null;
  return httpsUrl((thumbnail as { source?: unknown }).source) || null;
}

function isRosterEntry(value: unknown): value is RosterEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as RosterEntry;
  return typeof entry.name === "string" && entry.name.trim() !== "" && typeof entry.imageUrl === "string" && /^https:\/\//.test(entry.imageUrl);
}

function imageUrlOf(character: unknown): string {
  if (!character || typeof character !== "object") return "";
  const images = (character as { images?: { jpg?: { image_url?: string }; webp?: { image_url?: string } } }).images;
  const url = images?.jpg?.image_url || images?.webp?.image_url || "";
  return /^https:\/\//.test(url) ? url : "";
}

export function createPortraitLoader(options: { cacheDir: string; fetchImpl?: typeof fetch }): LoadPortrait {
  const fetchImpl = options.fetchImpl ?? fetch;
  const inflight = new Map<string, Promise<CachedPortrait | null>>();
  const rosterTasks = new Map<string, Promise<RosterEntry[] | null>>();
  let active = 0;
  const waiters: Array<() => void> = [];

  async function withSlot<T>(work: () => Promise<T>): Promise<T> {
    if (active >= 4) {
      await new Promise<void>((resolve) => waiters.push(resolve));
    }
    active += 1;
    try {
      return await work();
    } finally {
      active -= 1;
      waiters.shift()?.();
    }
  }

  async function readCached(topicId: string, characterId: string): Promise<CachedPortrait | null> {
    for (const extension of EXTENSIONS) {
      try {
        const bytes = await readFile(path.join(options.cacheDir, topicId, `${characterId}.${extension}`));
        const mimeType = sniff(bytes) ?? MIME_FOR_EXT[extension];
        return { imageBase64: bytes.toString("base64"), mimeType };
      } catch {
        // try the next extension
      }
    }
    return null;
  }

  async function recentMiss(topicId: string, characterId: string): Promise<boolean> {
    try {
      const text = await readFile(path.join(options.cacheDir, topicId, `${characterId}.miss`), "utf8");
      const at = Number(text);
      return Number.isFinite(at) && Date.now() - at < MISS_TTL_MS;
    } catch {
      return false;
    }
  }

  async function writeMiss(topicId: string, characterId: string): Promise<void> {
    const file = path.join(options.cacheDir, topicId, `${characterId}.miss`);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, String(Date.now()));
  }

  async function download(topicId: string, characterId: string, imageUrl: string): Promise<CachedPortrait | null> {
    return withSlot(async () => {
      const response = await fetchImpl(imageUrl, { signal: AbortSignal.timeout(20_000) });
      if (!response.ok) return null;
      const bytes = Buffer.from(await response.arrayBuffer());
      const mimeType = sniff(bytes);
      if (!mimeType || bytes.length > 7 * 1024 * 1024) return null;
      const file = path.join(options.cacheDir, topicId, `${characterId}.${extensionFor(mimeType)}`);
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, bytes);
      return { imageBase64: bytes.toString("base64"), mimeType };
    });
  }

  async function roster(topic: AcgTopic): Promise<RosterEntry[] | null> {
    if (!topic.malAnimeId) return null;
    const file = path.join(options.cacheDir, topic.id, "roster.json");
    try {
      const parsed = JSON.parse(await readFile(file, "utf8")) as unknown;
      if (Array.isArray(parsed)) {
        const entries = parsed.filter(isRosterEntry);
        if (entries.length) return entries;
      }
    } catch {
      // fetch below
    }
    const pending = rosterTasks.get(topic.id);
    if (pending) return pending;
    const task = (async () => {
      try {
        const response = await fetchImpl(`https://api.jikan.moe/v4/anime/${topic.malAnimeId}/characters`, {
          signal: AbortSignal.timeout(20_000),
        });
        if (!response.ok) return null;
        const payload = (await response.json()) as { data?: unknown };
        if (!Array.isArray(payload.data)) return null;
        const entries: RosterEntry[] = [];
        for (const row of payload.data) {
          const character = (row as { character?: { name?: string } }).character;
          const name = character?.name?.trim() ?? "";
          const imageUrl = imageUrlOf(character);
          if (name && imageUrl) entries.push({ name, imageUrl });
        }
        if (!entries.length) return null;
        await mkdir(path.dirname(file), { recursive: true });
        await writeFile(file, JSON.stringify(entries));
        return entries;
      } catch {
        return null;
      }
    })();
    rosterTasks.set(topic.id, task);
    const entries = await task;
    if (!entries) rosterTasks.delete(topic.id);
    return entries;
  }

  async function resolve(topicId: string, characterId: string): Promise<CachedPortrait | null> {
    const topic = getTopic(topicId);
    const character = getCharacter(topicId, characterId);
    if (!topic || !character) return null;
    const cached = await readCached(topicId, characterId);
    if (cached) return cached;
    if (await recentMiss(topicId, characterId)) return null;
    if (topic.wikiApi && (character.previewFile || character.previewPage)) {
      try {
        const imageUrl = await wikiImageUrl(fetchImpl, topic, character);
        if (!imageUrl) {
          await writeMiss(topicId, characterId);
          return null;
        }
        const downloaded = await download(topicId, characterId, imageUrl);
        if (!downloaded) await writeMiss(topicId, characterId);
        return downloaded;
      } catch {
        await writeMiss(topicId, characterId);
        return null;
      }
    }
    const entries = await roster(topic);
    const wanted = new Set([character.name, ...character.aliases].map(normalizeName));
    const match = entries?.find((entry) => wanted.has(normalizeName(entry.name)));
    if (!match) {
      if (entries) await writeMiss(topicId, characterId);
      return null;
    }
    try {
      const downloaded = await download(topicId, characterId, match.imageUrl);
      if (!downloaded) await writeMiss(topicId, characterId);
      return downloaded;
    } catch {
      await writeMiss(topicId, characterId);
      return null;
    }
  }

  return (topicId, characterId) => {
    const key = `${topicId}/${characterId}`;
    const pending = inflight.get(key);
    if (pending) return pending;
    const task = resolve(topicId, characterId).finally(() => inflight.delete(key));
    inflight.set(key, task);
    return task;
  };
}
