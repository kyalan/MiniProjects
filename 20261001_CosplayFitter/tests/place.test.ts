import { afterEach, describe, expect, it } from "vitest";
import { climateFromPlace, formatDateLabel, isBlockedPlace, placeLine, regionBlockMessage } from "../shared/place.ts";
import { clearPlaceCache, lookupPlace, readPlace } from "../server/place.ts";

const HONG_KONG_IP = "203.0.113.8";
const HONG_KONG_LATITUDE = "22.3022";
const HONG_KONG_LONGITUDE = "114.1744";

function geo(body: Record<string, unknown>) {
  return {
    success: true,
    latitude: 35.66,
    longitude: 139.7,
    timezone: { id: "Asia/Tokyo" },
    ip: HONG_KONG_IP,
    ...body,
  };
}

function fetchPlaces(options: { geo: unknown; weather?: unknown; weatherStatus?: number }): typeof fetch {
  return async (input) => {
    const url = String(input);
    if (url.includes("open-meteo.com")) {
      if (options.weatherStatus) return new Response("no", { status: options.weatherStatus });
      return Response.json(options.weather ?? { current: { temperature_2m: 29.4, time: "2026-09-28T00:16" } });
    }
    if (options.geo instanceof Error) throw options.geo;
    return Response.json(options.geo);
  };
}

function expectHongKongWeatherRequest(url: string) {
  const params = new URL(url).searchParams;
  expect(params.get("latitude")).toBe(HONG_KONG_LATITUDE);
  expect(params.get("longitude")).toBe(HONG_KONG_LONGITUDE);
  expect(params.get("timezone")).toBe("Asia/Hong_Kong");
  expect(params.get("current")).toBe("temperature_2m");
}

describe("place lookup", () => {
  afterEach(() => {
    clearPlaceCache();
  });

  it("blocks regions missing from Gemini's available list, and leaves listed regions open", () => {
    expect(isBlockedPlace({ countryCode: "HK", country: "Hong Kong", city: "Kowloon", region: "Kowloon" })).toBe(true);
    expect(isBlockedPlace({ countryCode: "CN", country: "China", city: "Shenzhen", region: "Guangdong" })).toBe(true);
    expect(isBlockedPlace({ countryCode: "MO", country: "Macao", city: "Macau", region: "Macao" })).toBe(true);
    expect(isBlockedPlace({ countryCode: "", country: "China", city: "Hong Kong", region: "Hong Kong" })).toBe(true);
    expect(isBlockedPlace({ countryCode: "JP", country: "Japan", city: "Shibuya", region: "Tokyo" })).toBe(false);
    expect(isBlockedPlace({ countryCode: "TW", country: "Taiwan", city: "Taipei", region: "Taiwan" })).toBe(false);
    expect(isBlockedPlace({ countryCode: "SG", country: "Singapore", city: "Singapore", region: "Singapore" })).toBe(false);
    expect(isBlockedPlace({ countryCode: "JP", country: "Japan", city: "Hong Kong", region: "Hong Kong" })).toBe(false);
  });

  it("shows Hong Kong weather and still blocks a Hong Kong address", async () => {
    let weatherUrl = "";
    const place = await readPlace(async (input) => {
      const url = String(input);
      if (url.includes("open-meteo.com")) weatherUrl = url;
      return fetchPlaces({
        geo: geo({ city: "Kowloon", region: "Kowloon", country: "Hong Kong", country_code: "HK" }),
      })(input, {});
    });
    expectHongKongWeatherRequest(weatherUrl);
    expect(place.blocked).toBe(true);
    expect(place.label).toBe("Hong Kong");
    expect(place.regionLabel).toBe("Kowloon, Hong Kong");
    expect(regionBlockMessage(place.regionLabel ?? "")).toBe("The LLM is not available in Kowloon, Hong Kong.");
    expect(place.dateLabel).toBe("Monday 28 September 2026");
    expect(place.temperatureC).toBe(29);
    expect(placeLine(place)).toBe("Hong Kong · Monday 28 September 2026 · 29°C");
    expect(JSON.stringify(place)).not.toContain(HONG_KONG_IP);
    expect(climateFromPlace(place)).toEqual({
      placeLabel: "Hong Kong",
      dateLabel: "Monday 28 September 2026",
      temperatureC: 29,
    });
  });

  it("blocks a mainland China address and still shows Hong Kong", async () => {
    const place = await readPlace(
      fetchPlaces({
        geo: geo({
          city: "Shenzhen",
          region: "Guangdong",
          country: "China",
          country_code: "CN",
          timezone: { id: "Asia/Shanghai" },
        }),
        weather: { current: { temperature_2m: 31, time: "2026-09-28T00:16" } },
      }),
    );
    expect(place.blocked).toBe(true);
    expect(place.label).toBe("Hong Kong");
    expect(place.regionLabel).toBe("Shenzhen, Guangdong, China");
    expect(place.temperatureC).toBe(31);
  });

  it("shows Hong Kong weather for a place that can call Gemini", async () => {
    let weatherUrl = "";
    const place = await readPlace(async (input) => {
      const url = String(input);
      if (url.includes("open-meteo.com")) weatherUrl = url;
      return fetchPlaces({
        geo: geo({ city: "Shibuya", region: "Tokyo", country: "Japan", country_code: "JP" }),
      })(input, {});
    });
    expectHongKongWeatherRequest(weatherUrl);
    expect(place.ok).toBe(true);
    expect(place.blocked).toBe(false);
    expect(place.label).toBe("Hong Kong");
    expect(place.regionLabel).toBe("Shibuya, Tokyo, Japan");
    expect(place.temperatureC).toBe(29);
    expect(placeLine(place)).toBe("Hong Kong · Monday 28 September 2026 · 29°C");
  });

  it("does not block when the address lookup fails", async () => {
    const place = await readPlace(fetchPlaces({ geo: new Error("offline") }));
    expect(place.ok).toBe(true);
    expect(place.blocked).toBe(false);
    expect(place.label).toBe("Hong Kong");
    expect(place.regionLabel).toBe("");
    expect(place.temperatureC).toBe(29);
    expect(climateFromPlace(place)?.placeLabel).toBe("Hong Kong");
  });

  it("keeps Hong Kong when the weather lookup fails and does not invent a temperature", async () => {
    const place = await readPlace(
      fetchPlaces({
        geo: geo({ city: "Shibuya", region: "Tokyo", country: "Japan", country_code: "JP" }),
        weatherStatus: 500,
      }),
      new Date("2026-09-28T04:00:00Z"),
    );
    expect(place.ok).toBe(true);
    expect(place.blocked).toBe(false);
    expect(place.label).toBe("Hong Kong");
    expect(place.temperatureC).toBeNull();
    expect(place.dateLabel).toBe("Monday 28 September 2026");
    expect(placeLine(place)).toBe("Hong Kong · Monday 28 September 2026");
    expect(climateFromPlace(place)).toBeNull();
  });

  it("caches a lookup for the next call", async () => {
    let calls = 0;
    const fetchImpl: typeof fetch = async (input) => {
      calls += 1;
      return fetchPlaces({
        geo: geo({ city: "Shibuya", region: "Tokyo", country: "Japan", country_code: "JP" }),
      })(input, {});
    };
    await lookupPlace(fetchImpl);
    await lookupPlace(fetchImpl);
    expect(calls).toBe(2);
  });

  it("formats the calendar date without a leading comma", () => {
    expect(formatDateLabel("UTC", new Date("2026-09-28T12:00:00Z"))).toBe("Monday 28 September 2026");
  });
});
