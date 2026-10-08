import { access } from "node:fs/promises";
import path from "node:path";
import express, { type Express, type Request } from "express";
import { estimateFitting } from "../shared/estimate.ts";
import { climateFromPlace, regionBlockMessage } from "../shared/place.ts";
import { SAMPLE_OUTFIT, buildImagePrompt, stylistPromptFor } from "../shared/prompts.ts";
import {
  ASPECT_RATIO,
  MODEL_ID,
  MODEL_LABEL,
  type ActualUsage,
  type Climate,
  type FittingInput,
  type Outfit,
  type PlaceSnapshot,
  type UsageMetadata,
} from "../shared/types.ts";
import { validateFitting } from "../shared/validate.ts";
import { ADMIN_ID, createAuth, credentialsFromEnv, type AuthSetting } from "./auth.ts";
import { countTokens, generateContent, GeminiRequestError, photoPart, type GeminiPart } from "./gemini.ts";
import { parseOutfits } from "./outfits.ts";
import { lookupPlace, unavailablePlace } from "./place.ts";
import { createPortraitLoader, type LoadPortrait } from "./portraits.ts";
import { loadShopPreview } from "./shopPreview.ts";
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
  cacheDir?: string;
  fetchImpl?: typeof fetch;
  loadPortrait?: LoadPortrait;
  lookupPlace?: () => Promise<PlaceSnapshot>;
  openFolder?: (dir: string) => void;
  serveClient?: boolean;
  rootDir?: string;
  auth?: AuthSetting | false;
}

function fittingDirection(fitting: FittingInput, climate: Climate | null) {
  return {
    age: fitting.age,
    height: fitting.height,
    weight: fitting.weight,
    referenceCount: fitting.references.length,
    climate,
  };
}

function recordedPlace(place: PlaceSnapshot) {
  return {
    place: place.label,
    localDate: place.dateLabel,
    temperatureC: place.temperatureC,
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
    outputTokens: total.outputTokens + usage.candidatesTokenCount,
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
  const authSetting = options.auth === undefined ? credentialsFromEnv() : options.auth;
  const auth = createAuth(authSetting === false ? null : authSetting);
  const authEnforced = authSetting !== false;
  if (authEnforced) app.use(auth.guard);

  function requesterIsAdmin(req: Request): boolean {
    if (!authEnforced) return true;
    return auth.userId(req) === ADMIN_ID;
  }
  const reveal = options.openFolder ?? openFolder;
  const loadPortrait =
    options.loadPortrait ??
    createPortraitLoader({
      cacheDir: options.cacheDir ?? path.join(process.cwd(), "data", "acg-cache"),
    });

  async function pricedEstimate(fitting: FittingInput, climate: Climate | null, apiKey: string) {
    const direction = fittingDirection(fitting, climate);
    const stylistText = stylistPromptFor({ ...fitting, climate });
    const imageText = buildImagePrompt(SAMPLE_OUTFIT, direction);
    const [stylistCount, previewCount] = await Promise.all([
      countTokens({
        apiKey,
        parts: fittingParts(stylistText, fitting),
        fetchImpl: options.fetchImpl,
      }),
      countTokens({
        apiKey,
        parts: fittingParts(imageText, fitting),
        fetchImpl: options.fetchImpl,
      }),
    ]);
    return estimateFitting({
      topicId: fitting.topicId,
      characterId: fitting.characterId,
      count: fitting.count,
      note: fitting.note,
      resolution: fitting.resolution,
      ...direction,
      counted: {
        stylistInputTokens: stylistCount.total,
        imageInputTokensEach: previewCount.total,
        stylistTextTokens: stylistCount.textTokens,
        stylistImageTokens: stylistCount.imageTokens,
        previewTextTokens: previewCount.textTokens,
        previewImageTokens: previewCount.imageTokens,
      },
    });
  }

  async function withPortrait(fitting: FittingInput): Promise<FittingInput> {
    const portrait = await loadPortrait(fitting.topicId, fitting.characterId);
    return portrait ? { ...fitting, references: [portrait] } : { ...fitting, references: [] };
  }
  const resolvePlace = async (): Promise<PlaceSnapshot> => {
    try {
      return await (options.lookupPlace ?? lookupPlace)();
    } catch {
      return unavailablePlace();
    }
  };

  app.get("/api/session", (req, res) => {
    const authenticated = authEnforced ? auth.signedIn(req) : true;
    res.json({
      authenticated,
      configured: auth.credentials !== null || !authEnforced,
      admin: authenticated && (!authEnforced || auth.userId(req) === ADMIN_ID),
    });
  });

  app.post("/api/login", (req, res) => {
    const body = req.body as { id?: unknown; password?: unknown };
    const id = typeof body?.id === "string" ? body.id : "";
    const password = typeof body?.password === "string" ? body.password : "";
    const result = auth.login(id, password);
    if (!result.ok) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    res.setHeader("Set-Cookie", result.cookie);
    res.json({ ok: true });
  });

  app.post("/api/logout", (req, res) => {
    res.setHeader("Set-Cookie", auth.logout(req));
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

  app.get("/api/shop-preview", async (req, res) => {
    const shop = typeof req.query.shop === "string" ? req.query.shop : "";
    const query = typeof req.query.q === "string" ? req.query.q.slice(0, 200) : "";
    const image = await loadShopPreview(shop, query, options.fetchImpl);
    if (!image) {
      res.status(404).end();
      return;
    }
    res.setHeader("Content-Type", image.contentType);
    res.setHeader("Cache-Control", "private, max-age=1800");
    res.send(image.body);
  });

  app.get("/api/acg/:topicId/:characterId/image", async (req, res) => {
    const portrait = await loadPortrait(req.params.topicId, req.params.characterId);
    if (!portrait) {
      res.status(404).end();
      return;
    }
    res.setHeader("Content-Type", portrait.mimeType);
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.send(Buffer.from(portrait.imageBase64, "base64"));
  });

  app.post("/api/estimate", async (req, res) => {
    const place = await resolvePlace();
    if (place.blocked) {
      res.status(403).json({ error: regionBlockMessage(place.regionLabel ?? "") });
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
    const fitting = await withPortrait(parsed.value);
    const climate = climateFromPlace(place);
    try {
      const estimate = await pricedEstimate(fitting, climate, secret);
      res.json({ estimate });
    } catch (error) {
      res.status(502).json({ error: publicMessage(error, secret) });
    }
  });

  app.post("/api/generate", async (req, res) => {
    const place = await resolvePlace();
    if (place.blocked) {
      res.status(403).json({ error: regionBlockMessage(place.regionLabel ?? "") });
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

    const fitting = await withPortrait(parsed.value);
    const climate = climateFromPlace(place);
    res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache");
    const send = (event: unknown) => {
      if (!res.writableEnded) res.write(`${JSON.stringify(event)}\n`);
    };

    const sessionId = createSessionId();
    const dir = path.join(options.sessionsDir, sessionId);
    let estimate = estimateFitting({
      topicId: fitting.topicId,
      characterId: fitting.characterId,
      count: fitting.count,
      note: fitting.note,
      resolution: fitting.resolution,
      ...fittingDirection(fitting, climate),
    });
    try {
      estimate = await pricedEstimate(fitting, climate, secret);
    } catch {
      // Keep the published-table estimate when Gemini cannot count this photo.
    }
    let failed = false;
    let actual: ActualUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
    const previews: PreviewRecord[] = [];
    let errorMessage = "";

    try {
      await writeBase64File(
        path.join(dir, "input", `photo.${extensionForMime(fitting.mimeType)}`),
        fitting.imageBase64,
      );
      const portrait = fitting.references[0];
      if (portrait) {
        await writeBase64File(
          path.join(dir, "input", `character.${extensionForMime(portrait.mimeType)}`),
          portrait.imageBase64,
        );
      }
      await writeJson(
        path.join(dir, "input", "request.json"),
        {
          model: MODEL_ID,
          topic: fitting.topicId,
          character: fitting.characterId,
          count: fitting.count,
          note: fitting.note,
          age: fitting.age,
          height: fitting.height,
          weight: fitting.weight,
          portrait: Boolean(portrait),
          resolution: fitting.resolution,
          ...recordedPlace(place),
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
        ...(requesterIsAdmin(req) ? { sessionPath: dir } : {}),
      });
    } finally {
      await writeJson(
        path.join(dir, "report.json"),
        {
          model: MODEL_ID,
          topic: fitting.topicId,
          character: fitting.characterId,
          count: fitting.count,
          note: fitting.note,
          age: fitting.age,
          height: fitting.height,
          weight: fitting.weight,
          portrait: fitting.references.length > 0,
          resolution: fitting.resolution,
          ...recordedPlace(place),
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
          ...(requesterIsAdmin(req) ? { sessionPath: dir } : {}),
          actual,
          estimate,
        });
      }
      res.end();
    }
  });

  app.get("/api/sessions/:id/zip", async (req, res) => {
    if (!requesterIsAdmin(req)) {
      res.status(403).json({ error: "The session folder is only available to the admin." });
      return;
    }
    const dir = resolveSessionDir(options.sessionsDir, req.params.id);
    if (!dir || !(await fileExists(dir))) {
      res.status(404).json({ error: "That session backup was not found." });
      return;
    }
    pipeSessionZip(dir, res);
  });

  app.post("/api/sessions/:id/reveal", async (req, res) => {
    if (!requesterIsAdmin(req)) {
      res.status(403).json({ error: "The session folder is only available to the admin." });
      return;
    }
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
