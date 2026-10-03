import { PLACE_UNAVAILABLE, REGION_BLOCK_MESSAGE, type Climate, type PlaceSnapshot } from "./types.ts";

// ISO codes from https://ai.google.dev/gemini-api/docs/available-regions
const GEMINI_AVAILABLE_REGIONS = new Set(
  "AD AE AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BW CA CC CD CF CG CH CI CK CL CM CO CR CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GQ GR GS GT GU GW GY HM HN HR HT HU ID IE IL IM IN IO IQ IS IT JE JM JO JP KE KG KH KI KM KN KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MG MH MK ML MN MP MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RW SA SB SC SD SE SG SH SI SK SL SM SN SO SR SS ST SV SZ TC TD TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS XK YE ZA ZM ZW".split(
    " ",
  ),
);

const UNAVAILABLE_NAMES = ["china", "people's republic of china", "hong kong", "香港", "macau", "macao", "澳門", "澳门"];

export function isBlockedPlace(input: {
  countryCode: string;
  country: string;
  city: string;
  region: string;
}): boolean {
  const code = input.countryCode.trim().toUpperCase();
  if (code) return !GEMINI_AVAILABLE_REGIONS.has(code);
  const haystack = `${input.country} ${input.city} ${input.region}`.toLowerCase();
  return UNAVAILABLE_NAMES.some((name) => haystack.includes(name));
}

export function regionBlockMessage(regionLabel: string): string {
  const place = regionLabel.trim();
  if (!place) return REGION_BLOCK_MESSAGE;
  return `The LLM is not available in ${place}.`;
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
