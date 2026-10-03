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
  return { promptTokenCount: 0, candidatesTokenCount: 0, thoughtsTokenCount: 0, totalTokenCount: 0 };
}

function readCount(value: unknown): number {
  const count = Number(value ?? 0);
  return Number.isFinite(count) ? count : 0;
}

function readUsage(value: unknown): UsageMetadata {
  if (!value || typeof value !== "object") return emptyUsage();
  const usage = value as Record<string, unknown>;
  const prompt = readCount(usage.promptTokenCount);
  const candidates = readCount(usage.candidatesTokenCount);
  const thoughts = readCount(usage.thoughtsTokenCount ?? usage.thoughts_token_count);
  const total = readCount(usage.totalTokenCount ?? prompt + candidates + thoughts);
  return {
    promptTokenCount: prompt,
    candidatesTokenCount: candidates,
    thoughtsTokenCount: thoughts,
    totalTokenCount: total,
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

export async function countTokens(options: {
  apiKey: string;
  parts: GeminiPart[];
  fetchImpl?: typeof fetch;
}): Promise<number> {
  const payload = await postGemini(
    "countTokens",
    options.apiKey,
    { contents: [{ role: "user", parts: options.parts }] },
    30_000,
    options.fetchImpl ?? fetch,
  );
  const total = (payload as { totalTokens?: unknown }).totalTokens;
  const count = Number(total);
  if (!Number.isFinite(count)) {
    throw new GeminiRequestError(502, "Gemini did not return a token count.");
  }
  return count;
}

export function photoPart(mimeType: string, data: string): GeminiPart {
  return { inlineData: { mimeType, data } };
}
