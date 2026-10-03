import { afterEach, describe, expect, it } from "vitest";
import { getCity, matchCityId } from "../shared/cities.ts";
import { climateFromPlace, formatDateLabel, isBlockedPlace, placeLine } from "../shared/place.ts";
import { PLACE_UNAVAILABLE } from "../shared/types.ts";
import { clearPlaceCache, lookupPlace, readCityPlace, readPlace } from "../server/place.ts";

const HONG_KONG_IP = "203.0.113.8";

function geo(body: Record<string, unknown>) {
  return {
    success: true,
    latitude: 22.3,
    longitude: 114.2,
    timezone: { id: "Asia/Hong_Kong" },
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

describe("place lookup", () => {
  afterEach(() => {
    clearPlaceCache();
  });

  it("blocks Hong Kong and mainland China, and leaves another country open", () => {
    expect(isBlockedPlace({ countryCode: "HK", country: "Hong Kong", city: "Kowloon", region: "Kowloon" })).toBe(true);
    expect(isBlockedPlace({ countryCode: "CN", country: "China", city: "Shenzhen", region: "Guangdong" })).toBe(true);
    expect(isBlockedPlace({ countryCode: "", country: "China", city: "Hong Kong", region: "Hong Kong" })).toBe(true);
    expect(isBlockedPlace({ countryCode: "JP", country: "Japan", city: "Shibuya", region: "Tokyo" })).toBe(false);
  });

  it("reads Hong Kong from the public IP and the local temperature", async () => {
    const place = await readPlace(
      fetchPlaces({
        geo: geo({ city: "Kowloon", region: "Kowloon", country: "Hong Kong", country_code: "HK" }),
      }),
    );
    expect(place.blocked).toBe(true);
    expect(place.label).toBe("Kowloon, Hong Kong");
    expect(place.dateLabel).toBe("Monday 28 September 2026");
    expect(place.temperatureC).toBe(29);
    expect(place.timezone).toBe("Asia/Hong_Kong");
    expect(placeLine(place)).toBe("Kowloon, Hong Kong · Monday 28 September 2026 · 29°C · Asia/Hong_Kong");
    expect(JSON.stringify(place)).not.toContain(HONG_KONG_IP);
    expect(climateFromPlace(place)?.temperatureC).toBe(29);
  });

  it("blocks a mainland China fixture", async () => {
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
    expect(place.label).toBe("Shenzhen, Guangdong, China");
  });

  it("does not block when the lookup fails", async () => {
    const place = await readPlace(fetchPlaces({ geo: new Error("offline") }));
    expect(place.ok).toBe(false);
    expect(place.blocked).toBe(false);
    expect(place.temperatureC).toBeNull();
    expect(placeLine(place)).toBe(PLACE_UNAVAILABLE);
    expect(climateFromPlace(place)).toBeNull();
  });

  it("keeps the place when the weather lookup fails and does not invent a temperature", async () => {
    const place = await readPlace(
      fetchPlaces({
        geo: geo({ city: "Shibuya", region: "Tokyo", country: "Japan", country_code: "JP" }),
        weatherStatus: 500,
      }),
      new Date("2026-09-28T04:00:00Z"),
    );
    expect(place.ok).toBe(true);
    expect(place.blocked).toBe(false);
    expect(place.temperatureC).toBeNull();
    expect(place.dateLabel).toBe("Monday 28 September 2026");
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

  it("matches the connection label to an East Asian city", () => {
    expect(matchCityId("Kowloon, Hong Kong")).toBe("hong-kong");
    expect(matchCityId("Shibuya, Tokyo, Japan")).toBe("tokyo");
    expect(matchCityId("Reykjavik, Iceland")).toBe("");
  });

  it("reads a chosen city's date, temperature, and timezone", async () => {
    const seoul = getCity("seoul");
    if (!seoul) throw new Error("missing Seoul");
    const place = await readCityPlace(
      seoul,
      fetchPlaces({
        geo: {},
        weather: { current: { temperature_2m: 18.2, time: "2026-10-03T21:40" } },
      }),
      new Date("2026-10-03T12:00:00Z"),
    );
    expect(place.label).toBe("Seoul, South Korea");
    expect(place.temperatureC).toBe(18);
    expect(place.timezone).toBe("Asia/Seoul");
    expect(place.dateLabel).toBe("Saturday 3 October 2026");
    expect(place.blocked).toBe(false);
    expect(placeLine(place)).toBe("Seoul, South Korea · Saturday 3 October 2026 · 18°C · Asia/Seoul");
  });

  it("formats the calendar date without a leading comma", () => {
    expect(formatDateLabel("UTC", new Date("2026-09-28T12:00:00Z"))).toBe("Monday 28 September 2026");
  });
});
