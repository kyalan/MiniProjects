import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../server/app.ts";
import { REGION_BLOCK_MESSAGE, type PlaceSnapshot } from "../shared/types.ts";

const OPEN_PLACE: PlaceSnapshot = {
  ok: true,
  blocked: false,
  label: "Shibuya, Tokyo, Japan",
  dateLabel: "Monday 28 September 2026",
  temperatureC: 22,
  notice: "",
};

const TINY_PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const SECRET = "test-key-do-not-store-9f3a";

interface RecordedCall {
  url: string;
  body: {
    contents?: Array<{ parts?: Array<{ text?: string; inlineData?: { data?: string } }> }>;
    generationConfig?: {
      responseModalities?: string[];
      imageConfig?: { aspectRatio?: string; imageSize?: string };
    };
  };
  key: string;
}

function outfits(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    name: `Look ${index + 1}`,
    why: `Outfit ${index + 1} fits the dress code.`,
    garments: ["shirt", "trousers", "shoes"],
    imageDirection: `Direction for look ${index + 1} with a distinct palette.`,
  }));
}

function mockGemini(options?: { fail?: boolean }) {
  const calls: RecordedCall[] = [];
  let inFlight = 0;
  let maxInFlight = 0;
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = String(input);
    const body = JSON.parse(String(init?.body ?? "{}")) as RecordedCall["body"];
    const key = new Headers(init?.headers).get("x-goog-api-key") ?? "";
    calls.push({ url, body, key });
    if (options?.fail) {
      return new Response(
        JSON.stringify({ error: { message: "API key not valid. Please pass a valid API key." } }),
        { status: 400, headers: { "content-type": "application/json" } },
      );
    }
    if (url.endsWith(":countTokens")) {
      const text = body.contents?.[0]?.parts?.find((part) => part.text)?.text ?? "";
      return Response.json({ totalTokens: 1120 + Math.ceil(text.length / 4) });
    }
    const modalities = body.generationConfig?.responseModalities ?? [];
    const imageCall = modalities.includes("IMAGE");
    if (imageCall) {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 30));
      inFlight -= 1;
      return Response.json({
        candidates: [
          {
            finishReason: "STOP",
            content: {
              parts: [
                { text: "A clean tailored look." },
                { inlineData: { mimeType: "image/png", data: TINY_PNG } },
              ],
            },
          },
        ],
        usageMetadata: { promptTokenCount: 1300, candidatesTokenCount: 1200, totalTokenCount: 2500 },
      });
    }
    const text = body.contents?.[0]?.parts?.find((part) => part.text)?.text ?? "";
    const count = Number(/exactly (\d+)/.exec(text)?.[1] ?? "1");
    return Response.json({
      candidates: [
        {
          finishReason: "STOP",
          content: {
            parts: [
              {
                text: JSON.stringify({
                  medium: "photograph",
                  agePresentation: "adult",
                  outfits: outfits(count),
                }),
              },
            ],
          },
        },
      ],
      usageMetadata: { promptTokenCount: 1500, candidatesTokenCount: 400, totalTokenCount: 1900 },
    });
  };
  return {
    fetchImpl,
    calls,
    maxInFlight: () => maxInFlight,
  };
}

async function filesUnder(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const full = path.join(dir, entry.name);
      return entry.isDirectory() ? filesUnder(full) : [full];
    }),
  );
  return files.flat();
}

function fittingBody(count: number, resolution: "1K" | "2K" = "1K") {
  return {
    dressCode: "weekday_business_formal",
    count,
    note: "quiet navy",
    resolution,
    imageBase64: TINY_PNG,
    mimeType: "image/png",
  };
}

describe("fitting API", () => {
  let sessionsDir: string;
  const savedKey = process.env.GEMINI_API_KEY;

  beforeEach(async () => {
    sessionsDir = await mkdtemp(path.join(tmpdir(), "fitting-"));
    delete process.env.GEMINI_API_KEY;
  });

  afterEach(async () => {
    if (savedKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = savedKey;
    await rm(sessionsDir, { recursive: true, force: true });
  });

  it("refuses to generate without a key", async () => {
    const gemini = mockGemini();
    const app = await createApp({ sessionsDir, fetchImpl: gemini.fetchImpl, lookupPlace: async () => OPEN_PLACE });
    const response = await request(app).post("/api/generate").send(fittingBody(1));
    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/API key/);
    expect(gemini.calls).toHaveLength(0);
  });

  it("does not put the API key in config or on disk when Gemini rejects it", async () => {
    process.env.GEMINI_API_KEY = SECRET;
    const gemini = mockGemini({ fail: true });
    const app = await createApp({ sessionsDir, fetchImpl: gemini.fetchImpl, lookupPlace: async () => OPEN_PLACE });
    const config = await request(app).get("/api/config");
    expect(config.body).toEqual({
      hasServerKey: true,
      model: "gemini-3.1-flash-image",
      modelLabel: "Gemini 3.1 Flash Image",
    });
    expect(JSON.stringify(config.body)).not.toContain(SECRET);

    const response = await request(app)
      .post("/api/generate")
      .set("x-gemini-key", SECRET)
      .send(fittingBody(1));
    const events = response.text
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line) as { type: string; sessionId?: string; message?: string });
    expect(events.some((event) => event.type === "error" && /API key/i.test(event.message ?? ""))).toBe(true);
    const sessionId = events.find((event) => event.sessionId)?.sessionId;
    expect(sessionId).toBeTruthy();
    const folder = path.join(sessionsDir, sessionId!);
    const files = await filesUnder(folder);
    expect(files.some((file) => file.endsWith(`${path.sep}input${path.sep}request.json`))).toBe(true);
    expect(files.some((file) => file.includes(`${path.sep}output${path.sep}preview-`))).toBe(false);
    for (const file of files) {
      const bytes = await readFile(file);
      expect(bytes.includes(Buffer.from(SECRET))).toBe(false);
    }
    const requestJson = JSON.parse(await readFile(path.join(folder, "input", "request.json"), "utf8"));
    expect(requestJson.apiKey).toBeUndefined();
    expect(requestJson.ip).toBeUndefined();
    expect(gemini.calls[0]?.key).toBe(SECRET);
  });

  it("backs up one preview and a zip without the key", async () => {
    const gemini = mockGemini();
    const opened: string[] = [];
    const app = await createApp({
      sessionsDir,
      fetchImpl: gemini.fetchImpl,
      lookupPlace: async () => OPEN_PLACE,
      openFolder: (dir) => opened.push(dir),
    });
    const response = await request(app)
      .post("/api/generate")
      .set("x-gemini-key", SECRET)
      .send(fittingBody(1));
    const events = response.text
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line) as { type: string; sessionId?: string; index?: number });
    expect(events.map((event) => event.type)).toEqual(["stylist", "preview", "done"]);
    const sessionId = events.find((event) => event.type === "done")?.sessionId;
    expect(sessionId).toBeTruthy();
    const folder = path.join(sessionsDir, sessionId!);
    const stylist = await readFile(path.join(folder, "prompts", "stylist.txt"), "utf8");
    expect(stylist).toContain("Weekday business formal");
    expect(stylist).toContain("Monday 28 September 2026");
    expect(stylist).toContain("22°C");
    expect(stylist).toMatch(/do not photorealize/i);
    const requestJson = JSON.parse(await readFile(path.join(folder, "input", "request.json"), "utf8"));
    expect(requestJson).toMatchObject({
      place: "Shibuya, Tokyo, Japan",
      localDate: "Monday 28 September 2026",
      temperatureC: 22,
    });
    expect(requestJson.ip).toBeUndefined();
    expect(await readFile(path.join(folder, "output", "preview-01.png"))).toBeInstanceOf(Buffer);
    const report = JSON.parse(await readFile(path.join(folder, "report.json"), "utf8"));
    expect(report.estimate.totalTokens).toBeGreaterThan(0);
    expect(report.actual.totalTokens).toBe(1900 + 2500);
    expect(report.model).toBe("gemini-3.1-flash-image");
    for (const file of await filesUnder(folder)) {
      expect((await readFile(file)).includes(Buffer.from(SECRET))).toBe(false);
    }
    const imageCall = gemini.calls.find((call) => call.body.generationConfig?.responseModalities?.includes("IMAGE"));
    expect(imageCall?.body.generationConfig?.imageConfig).toEqual({
      aspectRatio: "3:4",
      imageSize: "1K",
    });
    expect(imageCall?.body.contents?.[0]?.parts?.some((part) => part.inlineData?.data === TINY_PNG)).toBe(true);
    const stylistCall = gemini.calls.find((call) => call.body.generationConfig?.responseModalities?.join() === "TEXT");
    expect(stylistCall).toBeTruthy();

    const zip = await request(app)
      .get(`/api/sessions/${sessionId}/zip`)
      .buffer(true)
      .parse((res, callback) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
        res.on("end", () => callback(null, Buffer.concat(chunks)));
      });
    expect(zip.status).toBe(200);
    expect(zip.headers["content-type"]).toMatch(/zip/);
    expect(Buffer.isBuffer(zip.body)).toBe(true);
    expect(zip.body.subarray(0, 2).toString()).toBe("PK");

    const reveal = await request(app).post(`/api/sessions/${sessionId}/reveal`);
    expect(reveal.status).toBe(200);
    expect(opened).toEqual([folder]);
    expect((await request(app).post("/api/sessions/not-a-session/reveal")).status).toBe(404);
  });

  it("generates five previews with at most two image calls in flight", async () => {
    const gemini = mockGemini();
    const app = await createApp({ sessionsDir, fetchImpl: gemini.fetchImpl, lookupPlace: async () => OPEN_PLACE });
    const response = await request(app)
      .post("/api/generate")
      .set("x-gemini-key", SECRET)
      .send(fittingBody(5, "2K"));
    const events = response.text
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line) as { type: string; sessionId?: string });
    expect(events.filter((event) => event.type === "preview")).toHaveLength(5);
    expect(events.at(-1)?.type).toBe("done");
    const folder = path.join(sessionsDir, events.at(-1)!.sessionId!);
    for (const number of [1, 2, 3, 4, 5]) {
      await expect(readFile(path.join(folder, "output", `preview-0${number}.png`))).resolves.toBeInstanceOf(Buffer);
    }
    const imageCalls = gemini.calls.filter((call) => call.body.generationConfig?.responseModalities?.includes("IMAGE"));
    expect(imageCalls).toHaveLength(5);
    expect(imageCalls[0]?.body.generationConfig?.imageConfig?.imageSize).toBe("2K");
    expect(gemini.maxInFlight()).toBeLessThanOrEqual(2);
    expect(gemini.maxInFlight()).toBe(2);
  });

  it("refines the receipt with countTokens", async () => {
    const gemini = mockGemini();
    const app = await createApp({ sessionsDir, fetchImpl: gemini.fetchImpl, lookupPlace: async () => OPEN_PLACE });
    const response = await request(app)
      .post("/api/estimate")
      .set("x-gemini-key", SECRET)
      .send(fittingBody(2));
    expect(response.status).toBe(200);
    expect(response.body.estimate.refined).toBe(true);
    expect(gemini.calls.filter((call) => call.url.endsWith(":countTokens"))).toHaveLength(2);
    expect(response.body.estimate.lines.find((line: { label: string }) => line.label === "Stylist · input text").note).toBe(
      "counted",
    );
  });

  it("blocks Mainland China and Hong Kong before calling Gemini", async () => {
    const gemini = mockGemini();
    const blocked: PlaceSnapshot = {
      ok: true,
      blocked: true,
      label: "Kowloon, Hong Kong",
      dateLabel: "Monday 28 September 2026",
      temperatureC: 29,
      notice: "",
    };
    const app = await createApp({
      sessionsDir,
      fetchImpl: gemini.fetchImpl,
      lookupPlace: async () => blocked,
    });
    const place = await request(app).get("/api/place");
    expect(place.body).toEqual(blocked);
    expect(JSON.stringify(place.body)).not.toMatch(/ip/i);

    const estimate = await request(app).post("/api/estimate").set("x-gemini-key", SECRET).send(fittingBody(1));
    expect(estimate.status).toBe(403);
    expect(estimate.body.error).toBe(REGION_BLOCK_MESSAGE);

    const generate = await request(app).post("/api/generate").set("x-gemini-key", SECRET).send(fittingBody(1));
    expect(generate.status).toBe(403);
    expect(generate.body.error).toBe(REGION_BLOCK_MESSAGE);
    expect(gemini.calls).toHaveLength(0);
  });
});
