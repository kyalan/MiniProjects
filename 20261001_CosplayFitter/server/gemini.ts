import { MODEL_ID } from "../shared/types.ts";
import type { UsageMetadata } from "../shared/types.ts";

const API_ROOT = "https://generativelanguage.googleapis.com/v1beta/models";

export class GeminiRequestError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "GeminiRequestError";
    this.status = status;
  }
}

export interface GeminiPart {
  text?: string;
  inlineData?: { mimeType: string; data: string };
}

export interface GeminiImage {
  mimeType: string;
  data: string;
}

export interface GeminiResult {
  text: string;
  images: GeminiImage[];
  usage: UsageMetadata;
  finishReason: string;
}

interface GenerateOptions {
  apiKey: string;
  parts: GeminiPart[];
  modalities: Array<"TEXT" | "IMAGE">;
  image?: { aspectRatio: string; imageSize: string };
  timeoutMs: number;
  fetchImpl?: typeof fetch;
}

function emptyUsage(): UsageMetadata {
  return { promptTokenCount: 0, candidatesTokenCount: 0, totalTokenCount: 0 };
}

function readUsage(value: unknown): UsageMetadata {
  if (!value || typeof value !== "object") return emptyUsage();
  const usage = value as Record<string, unknown>;
  const prompt = Number(usage.promptTokenCount ?? 0);
  const candidates = Number(usage.candidatesTokenCount ?? 0);
  const total = Number(usage.totalTokenCount ?? prompt + candidates);
  return {
    promptTokenCount: Number.isFinite(prompt) ? prompt : 0,
    candidatesTokenCount: Number.isFinite(candidates) ? candidates : 0,
    totalTokenCount: Number.isFinite(total) ? total : 0,
  };
}

export function readGeminiResult(payload: unknown): GeminiResult {
  const record = payload as {
    candidates?: Array<{
      finishReason?: string;
      content?: { parts?: Array<Record<string, unknown>> };
    }>;
    usageMetadata?: unknown;
    promptFeedback?: { blockReason?: string };
  };
  const candidate = record.candidates?.[0];
  const parts = candidate?.content?.parts ?? [];
  const texts: string[] = [];
  const images: GeminiImage[] = [];
  for (const part of parts) {
    if (typeof part.text === "string" && part.text.trim()) {
      texts.push(part.text);
    }
    const inline = (part.inlineData ?? part.inline_data) as
      | { mimeType?: string; mime_type?: string; data?: string }
      | undefined;
    if (inline?.data) {
      images.push({
        mimeType: inline.mimeType ?? inline.mime_type ?? "image/png",
        data: inline.data,
      });
    }
  }
  return {
    text: texts.join("\n").trim(),
    images,
    usage: readUsage(record.usageMetadata),
    finishReason: candidate?.finishReason ?? record.promptFeedback?.blockReason ?? "",
  };
}

async function postGemini(
  action: "generateContent" | "countTokens",
  apiKey: string,
  body: unknown,
  timeoutMs: number,
  fetchImpl: typeof fetch,
): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(`${API_ROOT}/${MODEL_ID}:${action}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const raw = await response.text();
    let payload: unknown = {};
    if (raw) {
      try {
        payload = JSON.parse(raw);
      } catch {
        payload = { error: { message: raw.slice(0, 300) } };
      }
    }
    if (!response.ok) {
      const message =
        payload &&
        typeof payload === "object" &&
        "error" in payload &&
        payload.error &&
        typeof payload.error === "object" &&
        "message" in payload.error &&
        typeof payload.error.message === "string"
          ? payload.error.message
          : `Gemini returned ${response.status}.`;
      throw new GeminiRequestError(response.status, message);
    }
    return payload;
  } catch (error) {
    if (error instanceof GeminiRequestError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new GeminiRequestError(504, "Gemini took too long to answer.");
    }
    throw new GeminiRequestError(502, "The studio could not reach Gemini.");
  } finally {
    clearTimeout(timer);
  }
}

export async function generateContent(options: GenerateOptions): Promise<GeminiResult> {
  const generationConfig: Record<string, unknown> = {
    responseModalities: options.modalities,
  };
  if (options.image) {
    generationConfig.imageConfig = {
      aspectRatio: options.image.aspectRatio,
      imageSize: options.image.imageSize,
    };
  }
  const payload = await postGemini(
    "generateContent",
    options.apiKey,
    {
      contents: [{ role: "user", parts: options.parts }],
      generationConfig,
    },
    options.timeoutMs,
    options.fetchImpl ?? fetch,
  );
  return readGeminiResult(payload);
}

export interface TokenCount {
  total: number;
  textTokens?: number;
  imageTokens?: number;
}

function modalityTokens(details: unknown, modality: string): number | undefined {
  if (!Array.isArray(details)) return undefined;
  let sum = 0;
  let found = false;
  for (const item of details) {
    if (!item || typeof item !== "object") continue;
    const record = item as { modality?: unknown; tokenCount?: unknown };
    const count = Number(record.tokenCount);
    if (record.modality !== modality || !Number.isFinite(count)) continue;
    sum += count;
    found = true;
  }
  return found ? sum : undefined;
}

export async function countTokens(options: {
  apiKey: string;
  parts: GeminiPart[];
  fetchImpl?: typeof fetch;
}): Promise<TokenCount> {
  const payload = await postGemini(
    "countTokens",
    options.apiKey,
    { contents: [{ role: "user", parts: options.parts }] },
    30_000,
    options.fetchImpl ?? fetch,
  );
  const record = payload as { totalTokens?: unknown; promptTokensDetails?: unknown };
  const total = Number(record.totalTokens);
  if (!Number.isFinite(total)) {
    throw new GeminiRequestError(502, "Gemini did not return a token count.");
  }
  return {
    total,
    textTokens: modalityTokens(record.promptTokensDetails, "TEXT"),
    imageTokens: modalityTokens(record.promptTokensDetails, "IMAGE"),
  };
}

export function photoPart(mimeType: string, data: string): GeminiPart {
  return { inlineData: { mimeType, data } };
}
