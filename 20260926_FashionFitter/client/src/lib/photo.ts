import { MAX_IMAGE_BYTES, type AllowedMimeType } from "@shared/types.ts";

export interface PreparedPhoto {
  base64: string;
  mimeType: AllowedMimeType;
  dataUrl: string;
}

const ACCEPTED = new Set(["image/jpeg", "image/png", "image/webp"]);

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(new Error("The photo could not be read."));
    reader.readAsDataURL(blob);
  });
}

export async function preparePhoto(file: File): Promise<PreparedPhoto> {
  if (!ACCEPTED.has(file.type)) {
    throw new Error("Use a JPEG, PNG, or WebP photo.");
  }
  const bitmap = await createImageBitmap(file);
  const maxEdge = 2048;
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("The photo could not be read.");
  }
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const mimeType: AllowedMimeType = file.type === "image/png" ? "image/png" : "image/jpeg";
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => (result ? resolve(result) : reject(new Error("The photo could not be read."))),
      mimeType,
      0.92,
    );
  });
  if (blob.size > MAX_IMAGE_BYTES) {
    throw new Error("That photo is still over 7 MB after resizing.");
  }
  const base64 = await blobToBase64(blob);
  return { base64, mimeType, dataUrl: `data:${mimeType};base64,${base64}` };
}
