import { getCharacter, getTopic } from "./acg.ts";
import { normalizeNote } from "./prompts.ts";
import {
  ALLOWED_MIME_TYPES,
  MAX_IMAGE_BYTES,
  MAX_PREVIEWS,
  MIN_PREVIEWS,
  type AllowedMimeType,
  type FittingInput,
  type ReferenceImage,
  type Resolution,
} from "./types.ts";

export type ValidationResult =
  | { ok: true; value: FittingInput }
  | { ok: false; status: number; error: string };

export function decodedByteLength(base64: string): number {
  const clean = base64.replace(/\s/g, "");
  if (!clean) return 0;
  const padding = clean.endsWith("==") ? 2 : clean.endsWith("=") ? 1 : 0;
  return Math.floor((clean.length * 3) / 4) - padding;
}

export function stripDataUrl(value: string): { base64: string; mimeType?: string } {
  const match = /^data:([^;]+);base64,([\s\S]*)$/.exec(value.trim());
  if (!match) {
    return { base64: value.replace(/\s/g, "") };
  }
  return { mimeType: match[1], base64: match[2].replace(/\s/g, "") };
}

function isMime(value: string): value is AllowedMimeType {
  return (ALLOWED_MIME_TYPES as readonly string[]).includes(value);
}

function isResolution(value: string): value is Resolution {
  return value === "1K" || value === "2K";
}

const MIN_HEIGHT_CM = 50;
const MAX_HEIGHT_CM = 250;
const MIN_WEIGHT_KG = 1;
const MAX_WEIGHT_KG = 300;

function normalizeBodyMeasure(
  value: unknown,
  label: string,
  unit: "cm" | "kg",
  min: number,
  max: number,
): { ok: true; value: string } | { ok: false; error: string } {
  if (value === undefined || value === null || value === "") return { ok: true, value: "" };
  const text = (typeof value === "number" ? String(value) : typeof value === "string" ? value : "").trim();
  const match = new RegExp(`^(\\d+)(?:\\s*${unit})?$`, "i").exec(text);
  if (!match) {
    return { ok: false, error: `${label} should be a whole number of ${unit}, or left blank.` };
  }
  const amount = Number(match[1]);
  if (amount < min || amount > max) {
    return { ok: false, error: `${label} should be a whole number from ${min} to ${max} ${unit}, or left blank.` };
  }
  return { ok: true, value: `${amount} ${unit}` };
}

function normalizeAge(value: unknown): { ok: true; age: string } | { ok: false; error: string } {
  if (value === undefined || value === null || value === "") return { ok: true, age: "" };
  const text = String(value).trim();
  if (!/^\d{1,3}$/.test(text)) {
    return { ok: false, error: "Age should be a whole number of years, or left blank." };
  }
  const age = Number(text);
  if (age < 1 || age > 120) {
    return { ok: false, error: "Age should be between 1 and 120, or left blank." };
  }
  return { ok: true, age: String(age) };
}

function readPhoto(rawImage: unknown, declaredMime: unknown, label: string): { ok: true; image: ReferenceImage } | { ok: false; status: number; error: string } {
  const stripped = stripDataUrl(typeof rawImage === "string" ? rawImage : "");
  const mimeType = stripped.mimeType ?? (typeof declaredMime === "string" ? declaredMime : "");
  if (!isMime(mimeType)) {
    return { ok: false, status: 400, error: `Use a JPEG, PNG, or WebP ${label}.` };
  }
  if (!stripped.base64 || !/^[A-Za-z0-9+/]*={0,2}$/.test(stripped.base64)) {
    return { ok: false, status: 400, error: `The ${label} could not be read.` };
  }
  if (decodedByteLength(stripped.base64) > MAX_IMAGE_BYTES) {
    return { ok: false, status: 413, error: `That ${label} is over 7 MB.` };
  }
  return { ok: true, image: { imageBase64: stripped.base64, mimeType } };
}

export function validateFitting(body: unknown): ValidationResult {
  if (!body || typeof body !== "object") {
    return { ok: false, status: 400, error: "The fitting request was empty." };
  }
  const record = body as Record<string, unknown>;
  const topicId = typeof record.topic === "string" ? record.topic : "";
  const characterId = typeof record.character === "string" ? record.character : "";
  if (!getTopic(topicId)) {
    return { ok: false, status: 400, error: "Choose a topic." };
  }
  if (!getCharacter(topicId, characterId)) {
    return { ok: false, status: 400, error: "Choose a character." };
  }

  const count = record.count;
  if (typeof count !== "number" || !Number.isInteger(count) || count < MIN_PREVIEWS || count > MAX_PREVIEWS) {
    return { ok: false, status: 400, error: "Choose a preview count from 1 to 5." };
  }

  const resolution = typeof record.resolution === "string" ? record.resolution : "";
  if (!isResolution(resolution)) {
    return { ok: false, status: 400, error: "Choose 1K or 2K." };
  }

  const photo = readPhoto(record.imageBase64, record.mimeType, "photo");
  if (!photo.ok) return photo;

  const age = normalizeAge(record.age);
  if (!age.ok) return { ok: false, status: 400, error: age.error };
  const height = normalizeBodyMeasure(record.height, "Height", "cm", MIN_HEIGHT_CM, MAX_HEIGHT_CM);
  if (!height.ok) return { ok: false, status: 400, error: height.error };
  const weight = normalizeBodyMeasure(record.weight, "Weight", "kg", MIN_WEIGHT_KG, MAX_WEIGHT_KG);
  if (!weight.ok) return { ok: false, status: 400, error: weight.error };

  const note = typeof record.note === "string" ? normalizeNote(record.note) : "";

  return {
    ok: true,
    value: {
      topicId,
      characterId,
      count,
      note,
      resolution,
      imageBase64: photo.image.imageBase64,
      mimeType: photo.image.mimeType,
      age: age.age,
      height: height.value,
      weight: weight.value,
      references: [],
    },
  };
}
