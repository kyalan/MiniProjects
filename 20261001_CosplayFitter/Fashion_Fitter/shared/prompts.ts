import { colorLabel } from "./colors.ts";
import { getDressCode, type DressCode } from "./dressCodes.ts";
import { MAX_MEASURE_LENGTH, MAX_NOTE_LENGTH, type Climate, type Outfit, type StyleDirection } from "./types.ts";

export const EMPTY_DIRECTION: StyleDirection = {
  age: "",
  height: "",
  weight: "",
  colors: [],
  referenceCount: 0,
  climate: null,
};

export function styleDirection(input?: Partial<StyleDirection>): StyleDirection {
  return {
    age: (input?.age ?? "").trim().slice(0, 8),
    height: (input?.height ?? "").trim().slice(0, MAX_MEASURE_LENGTH),
    weight: (input?.weight ?? "").trim().slice(0, MAX_MEASURE_LENGTH),
    colors: input?.colors ?? [],
    referenceCount: input?.referenceCount ?? 0,
    climate: normalizeClimate(input?.climate),
  };
}

function normalizeClimate(climate: Climate | null | undefined): Climate | null {
  if (!climate) return null;
  const placeLabel = climate.placeLabel.trim();
  const dateLabel = climate.dateLabel.trim();
  if (!placeLabel || !dateLabel || !Number.isFinite(climate.temperatureC)) return null;
  return { placeLabel, dateLabel, temperatureC: Math.round(climate.temperatureC) };
}

export const SAMPLE_OUTFIT: Outfit = {
  name: "Ink wool day suit",
  why: "A tailored ink suit reads as weekday formal while staying specific to a cool coloring.",
  garments: ["ink wool two-piece suit", "ivory cotton shirt", "black closed-toe oxfords", "thin leather belt"],
  imageDirection:
    "Tailored ink two-piece wool suit, ivory cotton shirt, no tie, black closed-toe oxfords, and a thin leather belt. Quiet office lobby, even daylight, clothes visible from head toward the shoes.",
};

export function normalizeNote(note: string): string {
  return note.trim().slice(0, MAX_NOTE_LENGTH);
}

function directionText(direction: StyleDirection): string {
  const colors = direction.colors.length
    ? direction.colors.map((color) => colorLabel(color)).join(", ")
    : "Not given.";
  const mood =
    direction.referenceCount === 0
      ? "Not given."
      : `${direction.referenceCount} image(s) after the face photo. Take symbols, icons, motifs, and color tone from those images only. Do not copy any person in them. Do not reproduce a trademarked logo as a brand mark.`;
  const minor =
    /^\d+$/.test(direction.age) && Number(direction.age) < 18
      ? "The stated age is under 18. Treat the subject as a minor."
      : "";
  return `Use every line that is not "Not given." Ignore a line only when it says "Not given."
Age: ${direction.age || "Not given."}
Height: ${direction.height || "Not given."}
Weight: ${direction.weight || "Not given."}
Preferred colors: ${colors}
Dress-direction images: ${mood}
${climateText(direction.climate)}${minor ? `\n${minor}` : ""}`;
}

function climateText(climate: Climate | null): string {
  if (!climate) {
    return `Local date: Not given.
Temperature: Not given.
Place: Not given.`;
  }
  return `Local date: ${climate.dateLabel}
Temperature: ${climate.temperatureC}°C
Place: ${climate.placeLabel}
Dress for this date and temperature. Fabric, layers, and coverage must suit the weather. A hot day does not get a heavy coat. A cold day does not get summer clothes.`;
}

export function buildStylistPrompt(input: {
  dressCode: DressCode;
  count: number;
  note: string;
  direction?: Partial<StyleDirection>;
}): string {
  const note = normalizeNote(input.note) || "None.";
  const direction = styleDirection(input.direction);
  return `You are the stylist for a fitting studio. The first image is a person or an illustrated character. Later images, if any, are dress-direction references for symbols, icons, and color tone. Choose outfits that suit them and the dress code. You are writing directions for an image model that will keep their face and redraw them dressed.

Return JSON only. No markdown fences. Use this shape:
{
  "medium": "photograph or illustration",
  "agePresentation": "adult or minor or unclear",
  "outfits": [
    {
      "name": "short name",
      "why": "one sentence on why this outfit fits the dress code and this person",
      "garments": ["visible garment", "shoes"],
      "imageDirection": "concrete palette, silhouette, fabric, and setting for the image model"
    }
  ]
}

Standing rules:
- Return exactly ${input.count} outfits in the outfits array.
- Every outfit must satisfy the dress code below. Make them distinct by palette, silhouette, and accessories.
- If the reference is a drawing, anime, 3D render, or animation character, set medium to illustration. imageDirection must stay in that illustrated medium. Do not photorealize the character.
- If the person appears to be a minor, set agePresentation to minor. Every outfit must be modest and age-appropriate. No cocktail glamour, no revealing cuts, no adult styling.
- Never sexualize the subject.
- Never use real fashion brand names or logos.
- Use the stated age, height, and weight when they are given. When a line says "Not given.", do not invent that measurement.
- If preferred colors are listed, every outfit's imageDirection must name those colors and put each of them on a visible garment.
- If dress-direction images are attached, every outfit's imageDirection must name the symbols, icons, motifs, and color tone taken from them.
- imageDirection must be specific enough to dress them from head to toe, including any stated height and weight as the figure's scale.
- If local date and temperature are given, every outfit must suit that weather. imageDirection must name the fabric and layers for that temperature. A hot day does not get a heavy coat. A cold day does not get summer clothes.

Dress code: ${input.dressCode.label}
Wear: ${input.dressCode.inBounds}
Avoid: ${input.dressCode.outOfBounds}
Client note: ${note}
${directionText(direction)}`;
}

export function buildImagePrompt(outfit: Outfit, directionInput?: Partial<StyleDirection>): string {
  const direction = styleDirection(directionInput);
  return `Create one portrait of the subject in the first reference image, wearing the outfit below. Frame is a 3:4 portrait. Show the clothes clearly, from head toward the shoes when the frame allows.

${directionText(direction)}

Identity lock:
- The first image is the person. Any images after it are dress-direction references, not extra people.
- Keep the same face, age appearance, skin tone, hair, and distinguishing marks.
- If age, height, or weight is stated above, the clothed figure must match those figures. Do not change the face to do that.
- If preferred colors are stated above, those colors must be visible on the clothes.
- If dress-direction images are attached, the clothes must show their symbols, icons, motifs, and color tone.
- If local date and temperature are stated above, the clothes must suit that weather, including the fabric and layers. A hot day does not get a heavy coat. A cold day does not get summer clothes.
- Do not redesign their body beyond the stated figures. This is a styling preview, not a tailor fit.
- If the reference is a drawing, anime, 3D render, or animation character, stay in that illustrated medium. Do not photorealize the character.
- If the subject appears to be a minor, keep the clothing modest and age-appropriate. No glamour pose and no revealing cuts.
- Never sexualize the subject.
- No real brand logos, no watermarks, no text in the image, and no extra people.

Outfit name: ${outfit.name}
Garments: ${outfit.garments.join(", ")}
Direction: ${outfit.imageDirection}

Setting: a quiet, uncluttered place that suits the clothes, with even light.

With the image, write one short sentence naming the outfit.`;
}

export function stylistPromptFor(input: {
  dressCodeId: string;
  count: number;
  note: string;
  age?: string;
  height?: string;
  weight?: string;
  colors?: string[];
  references?: unknown[];
  climate?: Climate | null;
}): string {
  const dressCode = getDressCode(input.dressCodeId);
  if (!dressCode) {
    throw new Error("Choose a dress code.");
  }
  return buildStylistPrompt({
    dressCode,
    count: input.count,
    note: input.note,
    direction: {
      age: input.age,
      height: input.height,
      weight: input.weight,
      colors: input.colors,
      referenceCount: input.references?.length ?? 0,
      climate: input.climate,
    },
  });
}
