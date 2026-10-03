export const MODEL_ID = "gemini-3.1-flash-image";
export const MODEL_LABEL = "Gemini 3.1 Flash Image";
export const ASPECT_RATIO = "3:4";
export const MIN_PREVIEWS = 1;
export const MAX_PREVIEWS = 5;
export const MAX_IMAGE_BYTES = 7 * 1024 * 1024;
export const MAX_NOTE_LENGTH = 500;
export const MAX_MEASURE_LENGTH = 40;

export const RESOLUTIONS = ["1K", "2K"] as const;
export type Resolution = (typeof RESOLUTIONS)[number];

export const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

export interface Outfit {
  name: string;
  why: string;
  garments: string[];
  imageDirection: string;
}

export interface TokenLine {
  label: string;
  tokens: number;
  note: "published" | "estimated" | "counted";
}

export interface TokenEstimate {
  lines: TokenLine[];
  inputTokens: number;
  textOutputTokens: number;
  imageOutputTokens: number;
  totalTokens: number;
  usd: number;
  refined: boolean;
}

export interface UsageMetadata {
  promptTokenCount: number;
  candidatesTokenCount: number;
  totalTokenCount: number;
}

export interface ActualUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface ReferenceImage {
  imageBase64: string;
  mimeType: AllowedMimeType;
}

export const REGION_BLOCK_MESSAGE = "The LLM is not available in your current region.";
export const PLACE_UNAVAILABLE = "The place could not be read.";

export interface Climate {
  placeLabel: string;
  dateLabel: string;
  temperatureC: number;
}

export interface PlaceSnapshot {
  ok: boolean;
  blocked: boolean;
  label: string;
  dateLabel: string;
  temperatureC: number | null;
  notice: string;
  regionLabel?: string;
}

export interface StyleDirection {
  age: string;
  height: string;
  weight: string;
  referenceCount: number;
  climate: Climate | null;
}

export interface FittingInput {
  topicId: string;
  characterId: string;
  count: number;
  note: string;
  resolution: Resolution;
  imageBase64: string;
  mimeType: AllowedMimeType;
  age: string;
  height: string;
  weight: string;
  references: ReferenceImage[];
}
