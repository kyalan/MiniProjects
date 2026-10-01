import { describe, expect, it } from "vitest";
import { getDressCode } from "../shared/dressCodes.ts";
import { buildImagePrompt, buildStylistPrompt } from "../shared/prompts.ts";
import type { Outfit } from "../shared/types.ts";

const outfit: Outfit = {
  name: "Paper-blue shirt dress",
  why: "A clean shirt dress stays inside weekend casual without looking unfinished.",
  garments: ["paper-blue shirt dress", "white sneakers"],
  imageDirection: "A paper-blue cotton shirt dress and plain white sneakers in a quiet park.",
};

describe("prompt builder", () => {
  const dressCode = getDressCode("weekend_casual");
  if (!dressCode) throw new Error("missing dress code");

  const stylist = buildStylistPrompt({ dressCode, count: 4, note: "prefer navy" });
  const image = buildImagePrompt(outfit);

  it("locks identity, medium, and age-appropriate styling", () => {
    for (const prompt of [stylist, image]) {
      expect(prompt).toMatch(/animation character/i);
      expect(prompt).toMatch(/do not photorealize/i);
      expect(prompt).toMatch(/minor/i);
      expect(prompt).toMatch(/modest and age-appropriate/i);
      expect(prompt).toMatch(/never sexualize/i);
    }
  });

  it("includes the dress code, the client note, and the exact preview count", () => {
    expect(stylist).toContain("Weekend casual");
    expect(stylist).toContain(dressCode.outOfBounds);
    expect(stylist).toContain("prefer navy");
    expect(stylist).toContain("exactly 4");
  });

  it("puts the outfit on a 3:4 portrait without changing the body", () => {
    expect(image).toContain("3:4");
    expect(image).toContain("Paper-blue shirt dress");
    expect(image).toContain("white sneakers");
    expect(image).toMatch(/not a tailor fit/i);
    expect(image).toMatch(/no real brand logos/i);
  });

  it("carries age, size, colors, and dress-direction images", () => {
    const directed = buildStylistPrompt({
      dressCode,
      count: 2,
      note: "",
      direction: { age: "16", height: "160 cm", weight: "52 kg", colors: ["navy", "ivory"], referenceCount: 2 },
    });
    expect(directed).toContain("Age: 16");
    expect(directed).toContain("160 cm");
    expect(directed).toContain("52 kg");
    expect(directed).toContain("Navy");
    expect(directed).toContain("Ivory");
    expect(directed).toMatch(/symbols, icons, motifs, and color tone/i);
    expect(directed).toMatch(/imageDirection must name those colors/i);
    expect(directed).toMatch(/stated age is under 18/i);
  });

  it("requires outfits to suit the local date and temperature", () => {
    const climate = {
      placeLabel: "Kowloon, Hong Kong",
      dateLabel: "Monday 28 September 2026",
      temperatureC: 29,
    };
    const directed = buildStylistPrompt({
      dressCode,
      count: 2,
      note: "",
      direction: { climate },
    });
    const portrait = buildImagePrompt(outfit, { climate });
    for (const prompt of [directed, portrait]) {
      expect(prompt).toContain("Monday 28 September 2026");
      expect(prompt).toContain("29°C");
      expect(prompt).toContain("Kowloon, Hong Kong");
      expect(prompt).toMatch(/hot day does not get a heavy coat/i);
      expect(prompt).toMatch(/cold day does not get summer clothes/i);
    }
    expect(directed).toMatch(/imageDirection must name the fabric and layers/i);
    expect(portrait).toMatch(/clothes must suit that weather/i);
  });
});
