import { describe, expect, it } from "vitest";
import { getCharacter, getTopic } from "../shared/acg.ts";
import { buildImagePrompt, buildStylistPrompt, stylistPromptFor } from "../shared/prompts.ts";
import type { Outfit } from "../shared/types.ts";

const outfit: Outfit = {
  name: "Straw-hat day cosplay",
  why: "The open red vest and straw hat stay recognizable on a warm day.",
  garments: ["straw hat", "open red vest", "blue shorts", "sandals"],
  imageDirection: "Straw hat, open red vest, blue shorts, and sandals in a quiet park.",
};

describe("prompt builder", () => {
  const topic = getTopic("one_piece");
  const character = getCharacter("one_piece", "luffy");
  if (!topic || !character) throw new Error("missing character");

  const stylist = buildStylistPrompt({
    character,
    topicLabel: topic.label,
    count: 4,
    note: "keep the straw hat",
  });
  const image = buildImagePrompt(outfit);

  it("locks identity, medium, and age-appropriate styling", () => {
    for (const prompt of [stylist, image]) {
      expect(prompt).toMatch(/live-action photograph/i);
      expect(prompt).toMatch(/not anime/i);
      expect(prompt).toMatch(/minor/i);
      expect(prompt).toMatch(/modest and age-appropriate/i);
      expect(prompt).toMatch(/never sexualize/i);
    }
  });

  it("includes the character, the client note, and the exact preview count", () => {
    expect(stylist).toContain("One Piece");
    expect(stylist).toContain(character.name);
    expect(stylist).toContain(character.costume);
    expect(stylist).toContain("keep the straw hat");
    expect(stylist).toContain("exactly 4");
    expect(stylist).toMatch(/do not replace it with the character's face/i);
  });

  it("puts the outfit on a 3:4 portrait without changing the body", () => {
    expect(image).toContain("3:4");
    expect(image).toContain("Straw-hat day cosplay");
    expect(image).toContain("sandals");
    expect(image).toMatch(/not a tailor fit/i);
    expect(image).toMatch(/no real brand logos/i);
    expect(image).toMatch(/do not copy the face from the costume reference/i);
  });

  it("carries age, size, and the costume reference", () => {
    const directed = buildStylistPrompt({
      character,
      topicLabel: topic.label,
      count: 2,
      note: "",
      direction: { age: "16", height: "160 cm", weight: "52 kg", referenceCount: 1 },
    });
    expect(directed).toContain("Age: 16");
    expect(directed).toContain("160 cm");
    expect(directed).toContain("52 kg");
    expect(directed).toMatch(/clothes, colors, and props/i);
    expect(directed).toMatch(/do not copy the face in that image/i);
    expect(directed).toMatch(/stated age is under 18/i);
  });

  it("requires outfits to suit the local date and temperature", () => {
    const climate = {
      placeLabel: "Kowloon, Hong Kong",
      dateLabel: "Monday 28 September 2026",
      temperatureC: 29,
    };
    const directed = buildStylistPrompt({
      character,
      topicLabel: topic.label,
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

  it("names a Chiikawa character and the costume used for that portrait", () => {
    const topic = getTopic("chiikawa");
    const character = getCharacter("chiikawa", "hachiware");
    expect(topic?.malAnimeId).toBe(50250);
    expect(character?.aliases).toContain("Hachiware");
    if (!topic || !character) throw new Error("missing character");
    const directed = buildStylistPrompt({
      character,
      topicLabel: topic.label,
      count: 1,
      note: "",
    });
    expect(directed).toContain("Chiikawa");
    expect(directed).toContain("Hachiware");
    expect(directed).toContain(character.costume);
  });

  it("names the 2021 film for a Desert character", () => {
    const topic = getTopic("desert");
    const character = getCharacter("desert", "paul");
    expect(topic?.label).toBe("Desert");
    expect(topic?.series).toBe("Dune (2021)");
    expect(topic?.malAnimeId).toBeUndefined();
    expect(character?.previewFile).toBe("Dune Character Poster - Paul.jpeg");
    if (!character) throw new Error("missing character");
    const directed = stylistPromptFor({
      topicId: "desert",
      characterId: "paul",
      count: 1,
      note: "",
    });
    expect(directed).toContain("Dune (2021)");
    expect(directed).toContain("Paul Atreides");
    expect(directed).toContain(character.costume);
  });

  it("names the 2017 film for a Jungle character", () => {
    const character = getCharacter("jungle", "ruby");
    if (!character) throw new Error("missing character");
    const directed = stylistPromptFor({
      topicId: "jungle",
      characterId: "ruby",
      count: 1,
      note: "",
    });
    expect(directed).toContain("Jumanji: Welcome to the Jungle (2017)");
    expect(directed).toContain("Ruby Roundhouse");
    expect(directed).toContain(character.costume);
  });
});
