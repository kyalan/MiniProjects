import { isColorId } from "./colors.ts";
import { getDressCode } from "./dressCodes.ts";
import { normalizeNote } from "./prompts.ts";
import {
  ALLOWED_MIME_TYPES,
  MAX_IMAGE_BYTES,
  MAX_MEASURE_LENGTH,
  MAX_MOOD_IMAGES,
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

function normalizeMeasure(value: unknown, label: string): { ok: true; value: string } | { ok: false; error: string } {
  if (value === undefined || value === null || value === "") return { ok: true, value: "" };
  if (typeof value !== "string") return { ok: false, error: `${label} should be a short note, or left blank.` };
  const text = value.trim().slice(0, MAX_MEASURE_LENGTH);
  return { ok: true, value: text };
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
  const dressCodeId = typeof record.dressCode === "string" ? record.dressCode : "";
  if (!getDressCode(dressCodeId)) {
    return { ok: false, status: 400, error: "Choose a dress code." };
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
  const height = normalizeMeasure(record.height, "Height");
  if (!height.ok) return { ok: false, status: 400, error: height.error };
  const weight = normalizeMeasure(record.weight, "Weight");
  if (!weight.ok) return { ok: false, status: 400, error: weight.error };

  const colors: string[] = [];
  if (record.colors !== undefined && record.colors !== null) {
    if (!Array.isArray(record.colors)) {
      return { ok: false, status: 400, error: "Choose colors from the palette." };
    }
    for (const color of record.colors) {
      if (typeof color !== "string" || !isColorId(color)) {
        return { ok: false, status: 400, error: "Choose colors from the palette." };
      }
      if (!colors.includes(color)) colors.push(color);
    }
  }

  const references: ReferenceImage[] = [];
  if (record.references !== undefined && record.references !== null) {
    if (!Array.isArray(record.references)) {
      return { ok: false, status: 400, error: "Dress-direction images could not be read." };
    }
    if (record.references.length > MAX_MOOD_IMAGES) {
      return { ok: false, status: 400, error: "Add up to 3 dress-direction images." };
    }
    for (const reference of record.references) {
      if (!reference || typeof reference !== "object") {
        return { ok: false, status: 400, error: "A dress-direction image could not be read." };
      }
      const item = reference as Record<string, unknown>;
      const mood = readPhoto(item.imageBase64, item.mimeType, "dress-direction image");
      if (!mood.ok) return mood;
      references.push(mood.image);
    }
  }

  const note = typeof record.note === "string" ? normalizeNote(record.note) : "";

  return {
    ok: true,
    value: {
      dressCodeId,
      count,
      note,
      resolution,
      imageBase64: photo.image.imageBase64,
      mimeType: photo.image.mimeType,
      age: age.age,
      height: height.value,
      weight: weight.value,
      colors,
      references,
    },
  };
}
