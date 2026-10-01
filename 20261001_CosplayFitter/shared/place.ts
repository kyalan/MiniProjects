import { PLACE_UNAVAILABLE, type Climate, type PlaceSnapshot } from "./types.ts";

export function isBlockedPlace(input: {
  countryCode: string;
  country: string;
  city: string;
  region: string;
}): boolean {
  const code = input.countryCode.trim().toUpperCase();
  if (code === "CN" || code === "HK") return true;
  const country = input.country.trim().toLowerCase();
  const area = `${input.city} ${input.region}`.toLowerCase();
  const china = country === "china" || country.includes("people's republic of china");
  const hongKong = area.includes("hong kong") || area.includes("香港");
  return china && hongKong;
}

export function formatPlaceLabel(city: string, region: string, country: string): string {
  const parts: string[] = [];
  for (const part of [city, region, country]) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    if (parts.some((existing) => existing.toLowerCase() === trimmed.toLowerCase())) continue;
    parts.push(trimmed);
  }
  return parts.join(", ");
}

export function formatDateLabel(timeZone: string, now = new Date()): string {
  const options: Intl.DateTimeFormatOptions = {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  };
  let formatted: string;
  try {
    formatted = new Intl.DateTimeFormat("en-GB", { ...options, timeZone: timeZone.trim() || "UTC" }).format(now);
  } catch {
    formatted = new Intl.DateTimeFormat("en-GB", options).format(now);
  }
  return formatted.replace(",", "");
}

export function placeLine(place: PlaceSnapshot): string {
  if (!place.ok) return place.notice || PLACE_UNAVAILABLE;
  const parts = [place.label, place.dateLabel];
  if (typeof place.temperatureC === "number") parts.push(`${place.temperatureC}°C`);
  return parts.filter(Boolean).join(" · ");
}

export function climateFromPlace(place: PlaceSnapshot): Climate | null {
  if (!place.ok || !place.label || !place.dateLabel || typeof place.temperatureC !== "number") return null;
  return {
    placeLabel: place.label,
    dateLabel: place.dateLabel,
    temperatureC: place.temperatureC,
  };
}
