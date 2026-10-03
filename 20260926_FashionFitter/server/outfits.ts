import type { Outfit } from "../shared/types.ts";

export function parseOutfits(text: string, count: number): Outfit[] {
  const fenced = text.replace(/```json|```/gi, "").trim();
  const start = fenced.indexOf("{");
  const end = fenced.lastIndexOf("}");
  if (start < 0 || end <= start) {
    throw new Error("The stylist did not return outfit JSON.");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(fenced.slice(start, end + 1));
  } catch {
    throw new Error("The stylist did not return outfit JSON.");
  }
  const outfits = (parsed as { outfits?: unknown }).outfits;
  if (!Array.isArray(outfits) || outfits.length !== count) {
    throw new Error(`The stylist returned ${Array.isArray(outfits) ? outfits.length : 0} outfits instead of ${count}.`);
  }
  return outfits.map((item, index) => {
    if (!item || typeof item !== "object") {
      throw new Error(`Outfit ${index + 1} was empty.`);
    }
    const record = item as Record<string, unknown>;
    const name = typeof record.name === "string" ? record.name.trim() : "";
    const why = typeof record.why === "string" ? record.why.trim() : "";
    const imageDirection =
      typeof record.imageDirection === "string" ? record.imageDirection.trim() : "";
    const garments = Array.isArray(record.garments)
      ? record.garments.filter((garment): garment is string => typeof garment === "string" && garment.trim() !== "").map((garment) => garment.trim())
      : [];
    if (!name || !why || !imageDirection || garments.length === 0) {
      throw new Error(`Outfit ${index + 1} was missing a name, reason, garments, or direction.`);
    }
    return { name, why, garments, imageDirection };
  });
}
