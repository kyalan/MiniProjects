import { describe, expect, it } from "vitest";
import { decodedByteLength, validateFitting } from "../shared/validate.ts";

const TINY_PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

const valid = {
  topic: "one_piece",
  character: "luffy",
  count: 2,
  note: "  keep the straw hat  ",
  resolution: "2K",
  imageBase64: TINY_PNG,
  mimeType: "image/png",
};

describe("validateFitting", () => {
  it("accepts a photo and trims the note", () => {
    const result = validateFitting(valid);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.note).toBe("keep the straw hat");
      expect(result.value.mimeType).toBe("image/png");
      expect(result.value.topicId).toBe("one_piece");
      expect(result.value.characterId).toBe("luffy");
      expect(result.value.references).toEqual([]);
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

  it("rejects counts outside 1 to 5 and unknown characters", () => {
    expect(validateFitting({ ...valid, count: 0 }).ok).toBe(false);
    expect(validateFitting({ ...valid, count: 6 }).ok).toBe(false);
    expect(validateFitting({ ...valid, count: 1.5 }).ok).toBe(false);
    expect(validateFitting({ ...valid, topic: "naruto" }).ok).toBe(false);
    expect(validateFitting({ ...valid, character: "gala" }).ok).toBe(false);
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

  it("accepts optional age, height, and weight", () => {
    const result = validateFitting({
      ...valid,
      age: 34,
      height: 170,
      weight: "65",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.age).toBe("34");
      expect(result.value.height).toBe("170 cm");
      expect(result.value.weight).toBe("65 kg");
    }
  });

  it("keeps a unit already written on height or weight", () => {
    const result = validateFitting({
      ...valid,
      height: "170 cm",
      weight: "65 kg",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.height).toBe("170 cm");
      expect(result.value.weight).toBe("65 kg");
    }
  });

  it("rejects a decimal or an out-of-range height or weight", () => {
    expect(validateFitting({ ...valid, height: "170.5" }).ok).toBe(false);
    expect(validateFitting({ ...valid, height: "49" }).ok).toBe(false);
    expect(validateFitting({ ...valid, weight: "0" }).ok).toBe(false);
    expect(validateFitting({ ...valid, weight: "301 kg" }).ok).toBe(false);
    const blank = validateFitting({ ...valid, height: "", weight: "" });
    expect(blank.ok).toBe(true);
    if (blank.ok) {
      expect(blank.value.height).toBe("");
      expect(blank.value.weight).toBe("");
    }
  });

  it("rejects a bad age", () => {
    expect(validateFitting({ ...valid, age: "teen" }).ok).toBe(false);
  });
});
