import { getCharacter, getTopic, type AcgCharacter } from "./acg.ts";
import { MAX_MEASURE_LENGTH, MAX_NOTE_LENGTH, type Climate, type Outfit, type StyleDirection } from "./types.ts";

export const EMPTY_DIRECTION: StyleDirection = {
  age: "",
  height: "",
  weight: "",
  referenceCount: 0,
  climate: null,
};

export function styleDirection(input?: Partial<StyleDirection>): StyleDirection {
  return {
    age: (input?.age ?? "").trim().slice(0, 8),
    height: (input?.height ?? "").trim().slice(0, MAX_MEASURE_LENGTH),
    weight: (input?.weight ?? "").trim().slice(0, MAX_MEASURE_LENGTH),
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
  name: "Straw-hat day cosplay",
  why: "The open red vest and straw hat are the character's signature look, adjusted for a warm day.",
  garments: ["straw hat", "open red vest", "blue shorts", "sandals"],
  imageDirection:
    "Straw hat on a red cord, open red vest, blue shorts, and sandals. Quiet daylight, clothes visible from head toward the shoes.",
};

export function normalizeNote(note: string): string {
  return note.trim().slice(0, MAX_NOTE_LENGTH);
}

function directionText(direction: StyleDirection): string {
  const costume =
    direction.referenceCount === 0
      ? "Not given."
      : `${direction.referenceCount} image after the face photo. Use it only for clothes, colors, and props. Do not copy the face in that image.`;
  const minor =
    /^\d+$/.test(direction.age) && Number(direction.age) < 18
      ? "The stated age is under 18. Treat the subject as a minor."
      : "";
  return `Use every line that is not "Not given." Ignore a line only when it says "Not given."
Age: ${direction.age || "Not given."}
Height: ${direction.height || "Not given."}
Weight: ${direction.weight || "Not given."}
Costume reference image: ${costume}
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
  character: AcgCharacter;
  topicLabel: string;
  count: number;
  note: string;
  direction?: Partial<StyleDirection>;
}): string {
  const note = normalizeNote(input.note) || "None.";
  const direction = styleDirection(input.direction);
  return `You are the stylist for a cosplay studio. The first image is the person who will wear the costume. A later image, if any, is a costume reference for clothes and props only. Choose cosplay outfits of the character below. You are writing directions for an image model that will keep their face and redraw them in costume.

Return JSON only. No markdown fences. Use this shape:
{
  "medium": "photograph",
  "agePresentation": "adult or minor or unclear",
  "outfits": [
    {
      "name": "short name",
      "why": "one sentence on why this costume fits the character and this person",
      "garments": ["visible garment", "shoes"],
      "imageDirection": "concrete palette, silhouette, fabric, wig, props, and setting for the image model"
    }
  ]
}

Standing rules:
- Return exactly ${input.count} outfits in the outfits array.
- Every outfit must be a recognizable cosplay of the character below. Make them distinct: the signature look, plus other recognizable costume variants such as a different canon outfit, a weather-adjusted version, or a convention-practical version. Do not invent an unrelated fashion look.
- Keep the person's face. Do not replace it with the character's face.
- Set medium to photograph. Every imageDirection must describe a live-action photograph of a real person in the costume, not anime, manga, illustration, or a 3D animation still. The costume reference may be a drawing. Translate its clothes into real fabric, hair, and props. Do not copy its drawn style.
- If the person appears to be a minor, set agePresentation to minor. Every outfit must be modest and age-appropriate. No cocktail glamour, no revealing cuts, no adult styling.
- Never sexualize the subject.
- Never use real fashion brand names or logos.
- Use the stated age, height, and weight when they are given. When a line says "Not given.", do not invent that measurement.
- If a costume reference image is attached, every outfit's imageDirection must name the clothes, colors, and props taken from it. Do not copy the face in that image.
- imageDirection must be specific enough to dress them from head to toe, including a wig when the character's hair differs from the photo, and any stated height and weight as the figure's scale.
- If local date and temperature are given, every outfit must suit that weather while staying recognizable as the character. imageDirection must name the fabric and layers for that temperature. A hot day does not get a heavy coat. A cold day does not get summer clothes.

Series: ${input.topicLabel}
Character: ${input.character.name}
Costume: ${input.character.costume}
Client note: ${note}
${directionText(direction)}`;
}

export function buildImagePrompt(outfit: Outfit, directionInput?: Partial<StyleDirection>): string {
  const direction = styleDirection(directionInput);
  return `Create one live-action photograph of the person in the first reference image, wearing the cosplay below. It must look like a real photo, not anime, manga, or an illustration. Frame is a 3:4 portrait. Show the clothes clearly, from head toward the shoes when the frame allows.

${directionText(direction)}

Identity lock:
- The first image is the person. Any image after it is a costume reference, not another person.
- Keep the same face, age appearance, skin tone, and distinguishing marks. A wig may follow the character. Do not replace the face to do that.
- Do not copy the face from the costume reference. Copy clothes, colors, and props only.
- If age, height, or weight is stated above, the clothed figure must match those figures. Do not change the face to do that.
- If a costume reference image is attached, the clothes must show its clothes, colors, and props.
- If local date and temperature are stated above, the clothes must suit that weather, including the fabric and layers, while staying recognizable as the cosplay. A hot day does not get a heavy coat. A cold day does not get summer clothes.
- Do not redesign their body beyond the stated figures. This is a cosplay preview, not a tailor fit.
- Render a photorealistic live-action photograph. Real skin, real fabric, real light. Do not draw in an anime, manga, or illustrated style, even if the costume reference or the written direction sounds like a drawing.
- If the subject appears to be a minor, keep the clothing modest and age-appropriate. No glamour pose and no revealing cuts.
- Never sexualize the subject.
- No real brand logos, no watermarks, no text in the image, and no extra people.

Outfit name: ${outfit.name}
Garments: ${outfit.garments.join(", ")}
Direction: ${outfit.imageDirection}

Setting: a quiet, uncluttered place that suits the costume, with even light.

With the image, write one short sentence naming the outfit.`;
}

export function stylistPromptFor(input: {
  topicId: string;
  characterId: string;
  count: number;
  note: string;
  age?: string;
  height?: string;
  weight?: string;
  references?: unknown[];
  climate?: Climate | null;
}): string {
  const topic = getTopic(input.topicId);
  const character = getCharacter(input.topicId, input.characterId);
  if (!topic || !character) {
    throw new Error("Choose a character.");
  }
  return buildStylistPrompt({
    character,
    topicLabel: topic.label,
    count: input.count,
    note: input.note,
    direction: {
      age: input.age,
      height: input.height,
      weight: input.weight,
      referenceCount: input.references?.length ?? 0,
      climate: input.climate,
    },
  });
}
