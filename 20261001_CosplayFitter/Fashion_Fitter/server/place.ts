import { formatDateLabel, formatPlaceLabel, isBlockedPlace } from "../shared/place.ts";
import { PLACE_UNAVAILABLE, type PlaceSnapshot } from "../shared/types.ts";

const IP_URL = "https://ipwho.is/";
const WEATHER_URL = "https://api.open-meteo.com/v1/forecast";
const PLACE_CACHE_MS = 15 * 60 * 1000;

interface IpWhoBody {
  success?: boolean;
  city?: unknown;
  region?: unknown;
  country?: unknown;
  country_code?: unknown;
  latitude?: unknown;
  longitude?: unknown;
  timezone?: { id?: unknown } | string;
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

function timezoneId(value: IpWhoBody["timezone"]): string {
  if (typeof value === "string") return value.trim();
  if (value && typeof value.id === "string") return value.id.trim();
  return "";
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

export async function readPlace(fetchImpl: typeof fetch = fetch, now = new Date()): Promise<PlaceSnapshot> {
  try {
    const geo = (await readJson(fetchImpl, IP_URL)) as IpWhoBody;
    if (!geo?.success) return unavailablePlace();
    const city = text(geo.city);
    const region = text(geo.region);
    const country = text(geo.country);
    const countryCode = text(geo.country_code);
    const label = formatPlaceLabel(city, region, country);
    if (!label) return unavailablePlace();
    const zone = timezoneId(geo.timezone);
    let dateLabel = formatDateLabel(zone || "UTC", now);
    let temperatureC: number | null = null;
    const latitude = Number(geo.latitude);
    const longitude = Number(geo.longitude);
    if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
      try {
        const params = new URLSearchParams({
          latitude: String(latitude),
          longitude: String(longitude),
          current: "temperature_2m",
        });
        if (zone) params.set("timezone", zone);
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
    }
    return {
      ok: true,
      blocked: isBlockedPlace({ countryCode, country, city, region }),
      label,
      dateLabel,
      temperatureC,
      notice: "",
    };
  } catch {
    return unavailablePlace();
  }
}

export async function lookupPlace(fetchImpl: typeof fetch = fetch, now = new Date()): Promise<PlaceSnapshot> {
  if (cached && Date.now() - cached.at < PLACE_CACHE_MS) return cached.value;
  const value = await readPlace(fetchImpl, now);
  cached = { at: Date.now(), value };
  return value;
}
