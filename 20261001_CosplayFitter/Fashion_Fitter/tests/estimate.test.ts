import { describe, expect, it } from "vitest";
import { getDressCode } from "../shared/dressCodes.ts";
import {
  INPUT_IMAGE_TOKENS,
  OUTPUT_IMAGE_TOKENS,
  estimateFitting,
  estimateTextTokens,
  formatUsd,
  stylistOutputTextTokens,
  CAPTION_OUTPUT_TEXT_TOKENS,
  INPUT_USD_PER_MILLION,
  TEXT_OUTPUT_USD_PER_MILLION,
  IMAGE_OUTPUT_USD_PER_MILLION,
} from "../shared/estimate.ts";
import { SAMPLE_OUTFIT, buildImagePrompt, buildStylistPrompt } from "../shared/prompts.ts";

describe("estimateFitting", () => {
  it("prices a 1K fitting from published image tokens and the exact prompts", () => {
    const dressCode = getDressCode("weekday_business_formal");
    if (!dressCode) throw new Error("missing dress code");
    const count = 3;
    const estimate = estimateFitting({
      dressCodeId: dressCode.id,
      count,
      note: "navy, no heels",
      resolution: "1K",
    });
    const stylistText = estimateTextTokens(
      buildStylistPrompt({ dressCode, count, note: "navy, no heels" }),
    );
    const imageText = estimateTextTokens(buildImagePrompt(SAMPLE_OUTFIT));
    const textOutput = stylistOutputTextTokens(count) + CAPTION_OUTPUT_TEXT_TOKENS * count;

    expect(estimate.refined).toBe(false);
    expect(estimate.lines.find((line) => line.label === "Stylist · input image")?.tokens).toBe(INPUT_IMAGE_TOKENS);
    expect(estimate.lines.find((line) => line.label === "Previews · input image × 3")?.tokens).toBe(
      INPUT_IMAGE_TOKENS * count,
    );
    expect(estimate.lines.find((line) => line.label === "Previews · output image × 3")?.tokens).toBe(
      OUTPUT_IMAGE_TOKENS["1K"] * count,
    );
    expect(estimate.inputTokens).toBe(INPUT_IMAGE_TOKENS * (1 + count) + stylistText + imageText * count);
    expect(estimate.textOutputTokens).toBe(textOutput);
    expect(estimate.imageOutputTokens).toBe(1120 * count);
    expect(estimate.totalTokens).toBe(estimate.inputTokens + estimate.textOutputTokens + estimate.imageOutputTokens);
    const rawUsd =
      (estimate.inputTokens * INPUT_USD_PER_MILLION +
        estimate.textOutputTokens * TEXT_OUTPUT_USD_PER_MILLION +
        estimate.imageOutputTokens * IMAGE_OUTPUT_USD_PER_MILLION) /
      1_000_000;
    expect(estimate.usd).toBe(Math.round(rawUsd * 1_000_000) / 1_000_000);
    expect(formatUsd(estimate.usd)).toMatch(/^\$\d+\.\d{4}$/);
  });

  it("charges 560 more output tokens per preview at 2K", () => {
    const base = { dressCodeId: "weekend_casual", count: 2, note: "" };
    const oneK = estimateFitting({ ...base, resolution: "1K" });
    const twoK = estimateFitting({ ...base, resolution: "2K" });
    expect(twoK.imageOutputTokens - oneK.imageOutputTokens).toBe(560 * 2);
    expect(twoK.totalTokens - oneK.totalTokens).toBe(560 * 2);
  });

  it("changes the receipt when the dress code changes", () => {
    const formal = estimateFitting({
      dressCodeId: "weekday_business_formal",
      count: 1,
      note: "",
      resolution: "1K",
    });
    const weekend = estimateFitting({
      dressCodeId: "weekend_casual",
      count: 1,
      note: "",
      resolution: "1K",
    });
    expect(formal.totalTokens).not.toBe(weekend.totalTokens);
  });

  it("replaces input text with Gemini's count and keeps published image tokens", () => {
    const estimate = estimateFitting({
      dressCodeId: "business_casual",
      count: 2,
      note: "",
      resolution: "1K",
      counted: { stylistInputTokens: 2000, imageInputTokensEach: 1800 },
    });
    expect(estimate.refined).toBe(true);
    expect(estimate.lines.find((line) => line.label === "Stylist · input text")).toMatchObject({
      tokens: 880,
      note: "counted",
    });
    expect(estimate.lines.find((line) => line.label === "Previews · input text × 2")).toMatchObject({
      tokens: 680 * 2,
      note: "counted",
    });
    expect(estimate.lines.find((line) => line.label === "Previews · output image × 2")?.note).toBe("published");
    expect(estimate.inputTokens).toBe(2000 + 1800 * 2);
  });

  it("counts each dress-direction image on the stylist call and on every preview", () => {
    const base = { dressCodeId: "weekend_casual", count: 2, note: "", resolution: "1K" as const };
    const plain = estimateFitting(base);
    const directed = estimateFitting({ ...base, referenceCount: 1 });
    expect(directed.lines.find((line) => line.label === "Stylist · input image")?.tokens).toBe(INPUT_IMAGE_TOKENS * 2);
    expect(directed.lines.find((line) => line.label === "Previews · input image × 2")?.tokens).toBe(INPUT_IMAGE_TOKENS * 2 * 2);
    expect(plain.lines.find((line) => line.label === "Stylist · input image")?.tokens).toBe(INPUT_IMAGE_TOKENS);
  });
});
