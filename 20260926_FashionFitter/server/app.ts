import { access } from "node:fs/promises";
import path from "node:path";
import express, { type Express, type Request } from "express";
import { estimateFitting } from "../shared/estimate.ts";
import { climateFromPlace } from "../shared/place.ts";
import { SAMPLE_OUTFIT, buildImagePrompt, stylistPromptFor } from "../shared/prompts.ts";
import {
  ASPECT_RATIO,
  MODEL_ID,
  MODEL_LABEL,
  REGION_BLOCK_MESSAGE,
  type ActualUsage,
  type Climate,
  type FittingInput,
  type Outfit,
  type PlaceSnapshot,
  type UsageMetadata,
} from "../shared/types.ts";
import { validateFitting } from "../shared/validate.ts";
import { countTokens, generateContent, GeminiRequestError, photoPart, type GeminiPart } from "./gemini.ts";
import { clearSessionCookie, credentialsConfigured, credentialsMatch, readSession, setSessionCookie } from "./auth.ts";
import { lookupCityPlace, lookupPlace, unavailablePlace } from "./place.ts";
import { parseOutfits } from "./outfits.ts";
import { mapPool } from "./pool.ts";
import {
  createSessionId,
  extensionForMime,
  openFolder,
  pipeSessionZip,
  redact,
  resolveSessionDir,
  writeBase64File,
  writeJson,
  writeText,
} from "./sessions.ts";

export interface AppOptions {
  sessionsDir: string;
  fetchImpl?: typeof fetch;
  lookupPlace?: () => Promise<PlaceSnapshot>;
  lookupCity?: (cityId: string) => Promise<PlaceSnapshot | null>;
  openFolder?: (dir: string) => void;
  serveClient?: boolean;
  rootDir?: string;
  skipAuth?: boolean;
}

function fittingDirection(fitting: FittingInput, climate: Climate | null) {
  return {
    age: fitting.age,
    height: fitting.height,
    weight: fitting.weight,
    colors: fitting.colors,
    referenceCount: fitting.references.length,
    climate,
  };
}

function recordedPlace(connection: PlaceSnapshot, fitting: PlaceSnapshot, cityId: string) {
  return {
    place: fitting.label,
    localDate: fitting.dateLabel,
    temperatureC: fitting.temperatureC,
    timezone: fitting.timezone,
    cityId: cityId || null,
    connection: connection.label,
    connectionTimezone: connection.timezone,
  };
}

function fittingParts(text: string, fitting: FittingInput): GeminiPart[] {
  return [
    { text },
    photoPart(fitting.mimeType, fitting.imageBase64),
    ...fitting.references.map((reference) => photoPart(reference.mimeType, reference.imageBase64)),
  ];
}

interface PreviewRecord {
  index: number;
  outfit: Outfit;
  caption: string;
  mimeType?: string;
  file?: string;
  usage?: UsageMetadata;
  error?: string;
}

function resolveKey(req: Request): string {
  const header = req.header("x-gemini-key");
  return (header || process.env.GEMINI_API_KEY || "").trim();
}

function publicMessage(error: unknown, secret: string): string {
  const raw = error instanceof Error ? error.message : "The fitting could not be finished.";
  const message = redact(raw, secret).slice(0, 400);
  if (/api key/i.test(message)) return "Gemini rejected the API key.";
  if (error instanceof GeminiRequestError && error.status === 429) {
    return "Gemini is rate limiting requests. Wait a moment, then try fewer previews.";
  }
  if (error instanceof GeminiRequestError && error.status === 404) {
    return "Gemini 3.1 Flash Image is not available for this key.";
  }
  return message || "The fitting could not be finished.";
}

function addUsage(total: ActualUsage, usage: UsageMetadata): ActualUsage {
  return {
    inputTokens: total.inputTokens + usage.promptTokenCount,
    outputTokens: total.outputTokens + usage.candidatesTokenCount + usage.thoughtsTokenCount,
    totalTokens: total.totalTokens + usage.totalTokenCount,
  };
}

async function fileExists(file: string): Promise<boolean> {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

export async function createApp(options: AppOptions): Promise<Express> {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "24mb" }));
  const reveal = options.openFolder ?? openFolder;
  const resolvePlace = async (): Promise<PlaceSnapshot> => {
    try {
      return await (options.lookupPlace ?? lookupPlace)();
    } catch {
      return unavailablePlace();
    }
  };
  const resolveCity = options.lookupCity ?? ((cityId: string) => lookupCityPlace(cityId, options.fetchImpl));
  const resolveFittingPlace = async (connection: PlaceSnapshot, cityId: string): Promise<PlaceSnapshot> => {
    if (!cityId) return connection;
    try {
      return (await resolveCity(cityId)) ?? connection;
    } catch {
      return connection;
    }
  };

  app.use((req, res, next) => {
    if (options.skipAuth || !req.path.startsWith("/api")) {
      next();
      return;
    }
    if (
      (req.path === "/api/login" && req.method === "POST") ||
      (req.path === "/api/logout" && req.method === "POST") ||
      (req.path === "/api/auth" && req.method === "GET")
    ) {
      next();
      return;
    }
    if (!credentialsConfigured()) {
      res.status(401).json({ error: "Set APP_LOGIN_ID and APP_LOGIN_PASSWORD in .env.local, then restart." });
      return;
    }
    if (!readSession(req)) {
      res.status(401).json({ error: "Sign in to use the studio." });
      return;
    }
    next();
  });

  app.get("/api/auth", (req, res) => {
    const configured = credentialsConfigured();
    if (options.skipAuth || (configured && readSession(req))) {
      res.json({ ok: true, configured });
      return;
    }
    res.status(401).json({ ok: false, configured });
  });

  app.post("/api/login", (req, res) => {
    if (!credentialsConfigured()) {
      res.status(503).json({
        error: "Set APP_LOGIN_ID and APP_LOGIN_PASSWORD in .env.local, then restart the studio.",
      });
      return;
    }
    const body = req.body as { id?: unknown; password?: unknown } | null;
    const id = typeof body?.id === "string" ? body.id : "";
    const password = typeof body?.password === "string" ? body.password : "";
    if (!credentialsMatch(id, password)) {
      res.status(401).json({ error: "That ID or password does not match." });
      return;
    }
    setSessionCookie(res, id);
    res.json({ ok: true });
  });

  app.post("/api/logout", (_req, res) => {
    clearSessionCookie(res);
    res.json({ ok: true });
  });

  app.get("/api/config", (_req, res) => {
    res.json({
      hasServerKey: Boolean(process.env.GEMINI_API_KEY?.trim()),
      model: MODEL_ID,
      modelLabel: MODEL_LABEL,
    });
  });

  app.get("/api/place", async (_req, res) => {
    res.json(await resolvePlace());
  });

  app.get("/api/climate", async (req, res) => {
    const cityId = typeof req.query.city === "string" ? req.query.city : "";
    if (!cityId) {
      res.status(400).json({ error: "Choose a city from the list." });
      return;
    }
    try {
      const place = await resolveCity(cityId);
      if (!place?.ok) {
        res.status(400).json({ error: "Choose a city from the list." });
        return;
      }
      res.json(place);
    } catch {
      res.status(502).json({ error: "The place could not be read." });
    }
  });

  app.post("/api/estimate", async (req, res) => {
    const place = await resolvePlace();
    if (place.blocked) {
      res.status(403).json({ error: REGION_BLOCK_MESSAGE });
      return;
    }
    const secret = resolveKey(req);
    if (!secret) {
      res.status(400).json({ error: "Add a Gemini API key to price this fitting with Gemini." });
      return;
    }
    const parsed = validateFitting(req.body);
    if (!parsed.ok) {
      res.status(parsed.status).json({ error: parsed.error });
      return;
    }
    const fitting = parsed.value;
    const fittingPlace = await resolveFittingPlace(place, fitting.cityId);
    const climate = climateFromPlace(fittingPlace);
    try {
      const stylistText = stylistPromptFor({ ...fitting, climate });
      const imageText = buildImagePrompt(SAMPLE_OUTFIT, fittingDirection(fitting, climate));
      const [stylistInputTokens, imageInputTokensEach] = await Promise.all([
        countTokens({
          apiKey: secret,
          parts: fittingParts(stylistText, fitting),
          fetchImpl: options.fetchImpl,
        }),
        countTokens({
          apiKey: secret,
          parts: fittingParts(imageText, fitting),
          fetchImpl: options.fetchImpl,
        }),
      ]);
      const estimate = estimateFitting({
        dressCodeId: fitting.dressCodeId,
        count: fitting.count,
        note: fitting.note,
        resolution: fitting.resolution,
        ...fittingDirection(fitting, climate),
        counted: { stylistInputTokens, imageInputTokensEach },
      });
      res.json({ estimate });
    } catch (error) {
      res.status(502).json({ error: publicMessage(error, secret) });
    }
  });

  app.post("/api/generate", async (req, res) => {
    const place = await resolvePlace();
    if (place.blocked) {
      res.status(403).json({ error: REGION_BLOCK_MESSAGE });
      return;
    }
    const secret = resolveKey(req);
    const parsed = validateFitting(req.body);
    if (!parsed.ok) {
      res.status(parsed.status).json({ error: parsed.error });
      return;
    }
    if (!secret) {
      res.status(400).json({ error: "Add a Gemini API key to generate previews." });
      return;
    }

    const fitting = parsed.value;
    const fittingPlace = await resolveFittingPlace(place, fitting.cityId);
    const climate = climateFromPlace(fittingPlace);
    res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache");
    const send = (event: unknown) => {
      if (!res.writableEnded) res.write(`${JSON.stringify(event)}\n`);
    };

    const sessionId = createSessionId();
    const dir = path.join(options.sessionsDir, sessionId);
    const estimate = estimateFitting({
      dressCodeId: fitting.dressCodeId,
      count: fitting.count,
      note: fitting.note,
      resolution: fitting.resolution,
      ...fittingDirection(fitting, climate),
    });
    let failed = false;
    let actual: ActualUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
    const previews: PreviewRecord[] = [];
    let errorMessage = "";

    try {
      await writeBase64File(
        path.join(dir, "input", `photo.${extensionForMime(fitting.mimeType)}`),
        fitting.imageBase64,
      );
      for (const [index, reference] of fitting.references.entries()) {
        await writeBase64File(
          path.join(dir, "input", `mood-${String(index + 1).padStart(2, "0")}.${extensionForMime(reference.mimeType)}`),
          reference.imageBase64,
        );
      }
      await writeJson(
        path.join(dir, "input", "request.json"),
        {
          model: MODEL_ID,
          dressCode: fitting.dressCodeId,
          count: fitting.count,
          note: fitting.note,
          age: fitting.age,
          height: fitting.height,
          weight: fitting.weight,
          colors: fitting.colors,
          moodImages: fitting.references.length,
          resolution: fitting.resolution,
          ...recordedPlace(place, fittingPlace, fitting.cityId),
          aspectRatio: ASPECT_RATIO,
          mimeType: fitting.mimeType,
          createdAt: new Date().toISOString(),
        },
        secret,
      );

      const stylistPrompt = stylistPromptFor({ ...fitting, climate });
      await writeText(path.join(dir, "prompts", "stylist.txt"), redact(stylistPrompt, secret));
      const stylist = await generateContent({
        apiKey: secret,
        parts: fittingParts(stylistPrompt, fitting),
        modalities: ["TEXT"],
        timeoutMs: 60_000,
        fetchImpl: options.fetchImpl,
      });
      actual = addUsage(actual, stylist.usage);
      await writeText(path.join(dir, "prompts", "stylist-response.txt"), redact(stylist.text, secret));
      if (/SAFETY|PROHIBITED|BLOCK/i.test(stylist.finishReason) && !stylist.text) {
        throw new Error("The model declined this photo. Try another picture.");
      }
      const outfits = parseOutfits(stylist.text, fitting.count);
      await writeJson(path.join(dir, "prompts", "outfits.json"), outfits, secret);
      send({ type: "stylist", outfits, usage: stylist.usage });

      await mapPool(outfits, 2, async (outfit, index) => {
        const number = index + 1;
        const record: PreviewRecord = { index: number, outfit, caption: "" };
        previews.push(record);
        const imagePrompt = buildImagePrompt(outfit, fittingDirection(fitting, climate));
        try {
          await writeText(
            path.join(dir, "prompts", `image-${String(number).padStart(2, "0")}.txt`),
            redact(imagePrompt, secret),
          );
          const image = await generateContent({
            apiKey: secret,
            parts: fittingParts(imagePrompt, fitting),
            modalities: ["TEXT", "IMAGE"],
            image: { aspectRatio: ASPECT_RATIO, imageSize: fitting.resolution },
            timeoutMs: 120_000,
            fetchImpl: options.fetchImpl,
          });
          actual = addUsage(actual, image.usage);
          record.usage = image.usage;
          record.caption = image.text;
          const generated = image.images[0];
          if (!generated) {
            throw new Error("The model did not return a preview image.");
          }
          const filename = `preview-${String(number).padStart(2, "0")}.${extensionForMime(generated.mimeType)}`;
          await writeBase64File(path.join(dir, "output", filename), generated.data);
          record.mimeType = generated.mimeType;
          record.file = filename;
          await writeJson(
            path.join(dir, "output", `preview-${String(number).padStart(2, "0")}.json`),
            {
              outfit,
              caption: image.text,
              mimeType: generated.mimeType,
              file: filename,
              usage: image.usage,
              finishReason: image.finishReason,
            },
            secret,
          );
          send({
            type: "preview",
            index: number,
            outfit,
            caption: image.text,
            mimeType: generated.mimeType,
            imageBase64: generated.data,
            usage: image.usage,
          });
        } catch (error) {
          record.error = publicMessage(error, secret);
          send({ type: "preview-error", index: number, outfit, message: record.error });
        }
      });
    } catch (error) {
      failed = true;
      errorMessage = publicMessage(error, secret);
      send({
        type: "error",
        message: errorMessage,
        sessionId,
        sessionPath: dir,
      });
    } finally {
      await writeJson(
        path.join(dir, "report.json"),
        {
          model: MODEL_ID,
          dressCode: fitting.dressCodeId,
          count: fitting.count,
          note: fitting.note,
          age: fitting.age,
          height: fitting.height,
          weight: fitting.weight,
          colors: fitting.colors,
          moodImages: fitting.references.length,
          resolution: fitting.resolution,
          ...recordedPlace(place, fittingPlace, fitting.cityId),
          estimate,
          actual,
          previews: [...previews]
            .sort((a, b) => a.index - b.index)
            .map((preview) => ({
            index: preview.index,
            outfit: preview.outfit,
            caption: preview.caption,
            file: preview.file ?? null,
            usage: preview.usage ?? null,
            error: preview.error ?? null,
          })),
          error: errorMessage || null,
          createdAt: new Date().toISOString(),
        },
        secret,
      ).catch(() => undefined);
      if (!failed) {
        send({
          type: "done",
          sessionId,
          sessionPath: dir,
          actual,
          estimate,
        });
      }
      res.end();
    }
  });

  app.get("/api/sessions/:id/zip", async (req, res) => {
    const dir = resolveSessionDir(options.sessionsDir, req.params.id);
    if (!dir || !(await fileExists(dir))) {
      res.status(404).json({ error: "That session backup was not found." });
      return;
    }
    pipeSessionZip(dir, res);
  });

  app.post("/api/sessions/:id/reveal", async (req, res) => {
    const dir = resolveSessionDir(options.sessionsDir, req.params.id);
    if (!dir || !(await fileExists(dir))) {
      res.status(404).json({ error: "That session backup was not found." });
      return;
    }
    reveal(dir);
    res.json({ path: dir });
  });

  if (options.serveClient && options.rootDir) {
    if (process.env.NODE_ENV === "production") {
      const dist = path.join(options.rootDir, "dist");
      app.use(express.static(dist));
      app.use((req, res, next) => {
        if (req.method !== "GET" || req.path.startsWith("/api")) {
          next();
          return;
        }
        res.sendFile(path.join(dist, "index.html"));
      });
    } else {
      const { createServer } = await import("vite");
      const vite = await createServer({
        configFile: path.join(options.rootDir, "vite.config.ts"),
        server: {
          middlewareMode: true,
          watch: {
            usePolling: true,
            interval: 1000,
            ignored: ["**/node_modules/**", "**/data/**", "**/dist/**"],
          },
        },
        appType: "spa",
      });
      vite.watcher.on("error", () => undefined);
      app.use(vite.middlewares);
    }
  }

  return app;
}
