import { getCharacter, getTopic } from "./acg.ts";
import { SAMPLE_OUTFIT, buildImagePrompt, buildStylistPrompt, styleDirection } from "./prompts.ts";
import type { Climate, Resolution, TokenEstimate, TokenLine } from "./types.ts";

export const INPUT_IMAGE_TOKENS = 1120;
export const OUTPUT_IMAGE_TOKENS: Record<Resolution, number> = {
  "1K": 1120,
  "2K": 1680,
};
export const INPUT_USD_PER_MILLION = 0.5;
export const TEXT_OUTPUT_USD_PER_MILLION = 3;
export const IMAGE_OUTPUT_USD_PER_MILLION = 60;
export const CAPTION_OUTPUT_TEXT_TOKENS = 80;

export function estimateTextTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

export function stylistOutputTextTokens(count: number): number {
  return 180 + count * 140;
}

export function formatTokens(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

export function formatUsd(amount: number): string {
  return `$${amount.toFixed(4)}`;
}

export interface CountedInputTokens {
  stylistInputTokens: number;
  imageInputTokensEach: number;
}

function splitInput(
  countedTotal: number | undefined,
  fallbackText: string,
  imageCount: number,
): { image: number; text: number; textNote: TokenLine["note"] } {
  const publishedImages = INPUT_IMAGE_TOKENS * imageCount;
  if (countedTotal === undefined) {
    return {
      image: publishedImages,
      text: estimateTextTokens(fallbackText),
      textNote: "estimated",
    };
  }
  return {
    image: publishedImages,
    text: Math.max(0, countedTotal - publishedImages),
    textNote: "counted",
  };
}

export function estimateFitting(input: {
  topicId: string;
  characterId: string;
  count: number;
  note: string;
  resolution: Resolution;
  age?: string;
  height?: string;
  weight?: string;
  referenceCount?: number;
  climate?: Climate | null;
  counted?: CountedInputTokens;
}): TokenEstimate {
  const topic = getTopic(input.topicId);
  const character = getCharacter(input.topicId, input.characterId);
  if (!topic || !character) {
    throw new Error("Choose a character.");
  }

  const direction = styleDirection({
    age: input.age,
    height: input.height,
    weight: input.weight,
    referenceCount: input.referenceCount,
    climate: input.climate,
  });
  const imagesPerCall = 1 + direction.referenceCount;
  const stylistPrompt = buildStylistPrompt({
    character,
    topicLabel: topic.label,
    count: input.count,
    note: input.note,
    direction,
  });
  const imagePrompt = buildImagePrompt(SAMPLE_OUTFIT, direction);
  const stylist = splitInput(input.counted?.stylistInputTokens, stylistPrompt, imagesPerCall);
  const image = splitInput(input.counted?.imageInputTokensEach, imagePrompt, imagesPerCall);
  const stylistTextOut = stylistOutputTextTokens(input.count);
  const captionTextOut = CAPTION_OUTPUT_TEXT_TOKENS * input.count;
  const previewImageOut = OUTPUT_IMAGE_TOKENS[input.resolution] * input.count;

  const lines: TokenLine[] = [
    { label: "Stylist · input image", tokens: stylist.image, note: "published" },
    { label: "Stylist · input text", tokens: stylist.text, note: stylist.textNote },
    { label: "Stylist · output text", tokens: stylistTextOut, note: "estimated" },
    {
      label: `Previews · input image × ${input.count}`,
      tokens: image.image * input.count,
      note: "published",
    },
    {
      label: `Previews · input text × ${input.count}`,
      tokens: image.text * input.count,
      note: image.textNote,
    },
    {
      label: `Previews · output image × ${input.count}`,
      tokens: previewImageOut,
      note: "published",
    },
    {
      label: `Previews · captions × ${input.count}`,
      tokens: captionTextOut,
      note: "estimated",
    },
  ];

  const inputTokens = lines
    .filter((line) => line.label.includes("input"))
    .reduce((sum, line) => sum + line.tokens, 0);
  const textOutputTokens = stylistTextOut + captionTextOut;
  const imageOutputTokens = previewImageOut;
  const totalTokens = inputTokens + textOutputTokens + imageOutputTokens;
  const usd =
    (inputTokens * INPUT_USD_PER_MILLION +
      textOutputTokens * TEXT_OUTPUT_USD_PER_MILLION +
      imageOutputTokens * IMAGE_OUTPUT_USD_PER_MILLION) /
    1_000_000;

  return {
    lines,
    inputTokens,
    textOutputTokens,
    imageOutputTokens,
    totalTokens,
    usd: Math.round(usd * 1_000_000) / 1_000_000,
    refined: input.counted !== undefined,
  };
}
