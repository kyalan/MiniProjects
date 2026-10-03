import { describe, expect, it } from "vitest";
import { decodedByteLength, validateFitting } from "../shared/validate.ts";

const TINY_PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

const valid = {
  dressCode: "friday_smart_casual",
  count: 2,
  note: "  dark denim  ",
  resolution: "2K",
  imageBase64: TINY_PNG,
  mimeType: "image/png",
};

describe("validateFitting", () => {
  it("accepts a photo and trims the note", () => {
    const result = validateFitting(valid);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.note).toBe("dark denim");
      expect(result.value.mimeType).toBe("image/png");
    }
  });

  it("accepts a data URL and reads its mime type", () => {
    const result = validateFitting({
      ...valid,
      imageBase64: `data:image/jpeg;base64,${TINY_PNG}`,
      mimeType: "image/png",
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.mimeType).toBe("image/jpeg");
  });

  it("rejects counts outside 1 to 5 and unknown dress codes", () => {
    expect(validateFitting({ ...valid, count: 0 }).ok).toBe(false);
    expect(validateFitting({ ...valid, count: 6 }).ok).toBe(false);
    expect(validateFitting({ ...valid, count: 1.5 }).ok).toBe(false);
    expect(validateFitting({ ...valid, dressCode: "gala" }).ok).toBe(false);
  });

  it("rejects a non-image and a photo over 7 MB", () => {
    const mime = validateFitting({ ...valid, mimeType: "image/gif", imageBase64: TINY_PNG });
    expect(mime.ok).toBe(false);
    const bytes = 7 * 1024 * 1024 + 8;
    const length = Math.ceil(bytes / 3) * 4;
    const oversized = validateFitting({ ...valid, imageBase64: "A".repeat(length) });
    expect(oversized.ok).toBe(false);
    if (!oversized.ok) expect(oversized.status).toBe(413);
  });

  it("measures base64 bytes the same way as a decoder", () => {
    expect(decodedByteLength(TINY_PNG)).toBe(Buffer.from(TINY_PNG, "base64").length);
  });

  it("accepts optional age, colors, and one dress-direction image", () => {
    const result = validateFitting({
      ...valid,
      age: 34,
      height: "170",
      weight: "65",
      colors: ["navy", "navy", "ivory"],
      references: [{ imageBase64: TINY_PNG, mimeType: "image/png" }],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.age).toBe("34");
      expect(result.value.height).toBe("170 cm");
      expect(result.value.weight).toBe("65 kg");
      expect(result.value.colors).toEqual(["navy", "ivory"]);
      expect(result.value.references).toHaveLength(1);
    }
  });

  it("accepts centimetres and kilograms, and rejects other units", () => {
    const labelled = validateFitting({ ...valid, height: "170 cm", weight: "65 kg" });
    expect(labelled.ok).toBe(true);
    if (labelled.ok) {
      expect(labelled.value.height).toBe("170 cm");
      expect(labelled.value.weight).toBe("65 kg");
    }
    expect(validateFitting({ ...valid, height: "6 ft" }).ok).toBe(false);
    expect(validateFitting({ ...valid, weight: "65.5" }).ok).toBe(false);
    expect(validateFitting({ ...valid, city: "seoul" }).ok).toBe(true);
    expect(validateFitting({ ...valid, city: "paris" }).ok).toBe(false);
  });

  it("rejects a bad age, an unknown color, and a fourth direction image", () => {
    expect(validateFitting({ ...valid, age: "teen" }).ok).toBe(false);
    expect(validateFitting({ ...valid, colors: ["gold"] }).ok).toBe(false);
    const references = Array.from({ length: 4 }, () => ({ imageBase64: TINY_PNG, mimeType: "image/png" }));
    expect(validateFitting({ ...valid, references }).ok).toBe(false);
  });
});
