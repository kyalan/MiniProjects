import { formatDateLabel, isBlockedPlace } from "../shared/place.ts";
import { PLACE_UNAVAILABLE, type PlaceSnapshot } from "../shared/types.ts";

const IP_URL = "https://ipwho.is/";
const WEATHER_URL = "https://api.open-meteo.com/v1/forecast";
const PLACE_CACHE_MS = 15 * 60 * 1000;
const HONG_KONG_LABEL = "Hong Kong";
const HONG_KONG_TIMEZONE = "Asia/Hong_Kong";
const HONG_KONG_LATITUDE = 22.3022;
const HONG_KONG_LONGITUDE = 114.1744;

interface IpWhoBody {
  success?: boolean;
  city?: unknown;
  region?: unknown;
  country?: unknown;
  country_code?: unknown;
}

interface WeatherBody {
  current?: { temperature_2m?: unknown; time?: unknown };
}

let cached: { at: number; value: PlaceSnapshot } | null = null;

export function unavailablePlace(): PlaceSnapshot {
  return {
    ok: false,
    blocked: false,
    label: "",
    dateLabel: "",
    temperatureC: null,
    notice: PLACE_UNAVAILABLE,
  };
}

export function clearPlaceCache(): void {
  cached = null;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function dateLabelFromLocalTime(localIso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(localIso);
  if (!match) return "";
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12));
  return formatDateLabel("UTC", date);
}

async function readJson(fetchImpl: typeof fetch, url: string): Promise<unknown> {
  const response = await fetchImpl(url, { signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error("Place lookup failed.");
  return response.json();
}

function detectedLabel(city: string, region: string, country: string): string {
  const parts: string[] = [];
  for (const part of [city, region, country]) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    if (parts.some((existing) => existing.toLowerCase() === trimmed.toLowerCase())) continue;
    parts.push(trimmed);
  }
  return parts.join(", ");
}

async function readCurrentRegion(fetchImpl: typeof fetch): Promise<{ blocked: boolean; regionLabel: string }> {
  try {
    const geo = (await readJson(fetchImpl, IP_URL)) as IpWhoBody;
    if (!geo?.success) return { blocked: false, regionLabel: "" };
    const city = text(geo.city);
    const region = text(geo.region);
    const country = text(geo.country);
    const countryCode = text(geo.country_code);
    return {
      blocked: isBlockedPlace({ countryCode, country, city, region }),
      regionLabel: detectedLabel(city, region, country),
    };
  } catch {
    return { blocked: false, regionLabel: "" };
  }
}

async function readHongKongWeather(
  fetchImpl: typeof fetch,
  now: Date,
): Promise<{ dateLabel: string; temperatureC: number | null }> {
  let dateLabel = formatDateLabel(HONG_KONG_TIMEZONE, now);
  let temperatureC: number | null = null;
  try {
    const params = new URLSearchParams({
      latitude: String(HONG_KONG_LATITUDE),
      longitude: String(HONG_KONG_LONGITUDE),
      current: "temperature_2m",
      timezone: HONG_KONG_TIMEZONE,
    });
    const weather = (await readJson(fetchImpl, `${WEATHER_URL}?${params}`)) as WeatherBody;
    const raw = weather.current?.temperature_2m;
    if (typeof raw === "number" && Number.isFinite(raw)) temperatureC = Math.round(raw);
    const localTime = weather.current?.time;
    if (typeof localTime === "string") {
      dateLabel = dateLabelFromLocalTime(localTime) || dateLabel;
    }
  } catch {
    temperatureC = null;
  }
  return { dateLabel, temperatureC };
}

export async function readPlace(fetchImpl: typeof fetch = fetch, now = new Date()): Promise<PlaceSnapshot> {
  const [region, weather] = await Promise.all([readCurrentRegion(fetchImpl), readHongKongWeather(fetchImpl, now)]);
  return {
    ok: true,
    blocked: region.blocked,
    label: HONG_KONG_LABEL,
    dateLabel: weather.dateLabel,
    temperatureC: weather.temperatureC,
    notice: "",
    regionLabel: region.regionLabel,
  };
}

export async function lookupPlace(fetchImpl: typeof fetch = fetch, now = new Date()): Promise<PlaceSnapshot> {
  if (cached && Date.now() - cached.at < PLACE_CACHE_MS) return cached.value;
  const value = await readPlace(fetchImpl, now);
  cached = { at: Date.now(), value };
  return value;
}
