import type { Outfit } from "./types.ts";
import { translateShopQuery } from "./zhShop.ts";

export interface ShopLink {
  id: string;
  name: string;
  href: string;
  query: string;
}

const MAX_QUERY_LENGTH = 160;

type Shop = {
  id: string;
  name: string;
  script?: "hans";
  search: (query: string) => string;
};

function searchParams(query: string, key: string): string {
  return new URLSearchParams({ [key]: query }).toString();
}

const SHOPS: Shop[] = [
  {
    id: "taobao",
    name: "Taobao",
    script: "hans",
    search: (query) => `https://world.taobao.com/search/search.htm?${searchParams(query, "q")}`,
  },
  {
    id: "aliexpress",
    name: "AliExpress",
    script: "hans",
    search: (query) => `https://www.aliexpress.com/wholesale?${searchParams(query, "SearchText")}`,
  },
  {
    id: "amazon",
    name: "Amazon",
    search: (query) => `https://www.amazon.com/s?${searchParams(query, "k")}`,
  },
  {
    id: "ebay",
    name: "eBay",
    search: (query) => `https://www.ebay.com/sch/i.html?${searchParams(query, "_nkw")}`,
  },
];

export interface ShopItem {
  garment: string;
  query: string;
  links: ShopLink[];
}

function clipQuery(text: string): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= MAX_QUERY_LENGTH) return normalized;
  const cut = normalized.slice(0, MAX_QUERY_LENGTH);
  const space = cut.lastIndexOf(" ");
  return (space > 40 ? cut.slice(0, space) : cut).trim();
}

export function shopSearchQuery(characterName: string, outfit: Pick<Outfit, "name" | "garments">): string {
  const lead = characterName.trim() || outfit.name.trim();
  const garments = outfit.garments.map((garment) => garment.trim()).filter(Boolean);
  return clipQuery([lead, "cosplay", ...garments].filter(Boolean).join(" "));
}

export function shopSearchUrl(shopId: string, query: string): string | null {
  const shop = SHOPS.find((item) => item.id === shopId);
  const trimmed = query.trim();
  if (!shop || !trimmed) return null;
  return shop.search(trimmed);
}

export function shopLinks(query: string): ShopLink[] {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const hans = translateShopQuery(trimmed, "hans");
  return SHOPS.map((shop) => {
    const used = shop.script === "hans" ? hans : trimmed;
    return { id: shop.id, name: shop.name, href: shop.search(used), query: used };
  });
}

export function shopItems(characterName: string, outfit: Pick<Outfit, "name" | "garments">): ShopItem[] {
  const lead = characterName.trim() || outfit.name.trim();
  return outfit.garments
    .map((garment) => garment.trim())
    .filter(Boolean)
    .map((garment) => {
      const query = clipQuery([lead, "cosplay", garment].filter(Boolean).join(" "));
      return { garment, query, links: shopLinks(query) };
    });
}
