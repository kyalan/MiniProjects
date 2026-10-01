import { describe, expect, it } from "vitest";
import { mapPool } from "../server/pool.ts";
import { parseOutfits } from "../server/outfits.ts";

describe("mapPool", () => {
  it("keeps at most two image calls in flight", async () => {
    let current = 0;
    let max = 0;
    await mapPool([1, 2, 3, 4, 5], 2, async () => {
      current += 1;
      max = Math.max(max, current);
      await new Promise((resolve) => setTimeout(resolve, 20));
      current -= 1;
    });
    expect(max).toBe(2);
  });
});

describe("parseOutfits", () => {
  it("reads fenced stylist JSON", () => {
    const outfits = parseOutfits(
      "```json\n" +
        JSON.stringify({
          outfits: [
            {
              name: "Ink suit",
              why: "It fits weekday formal.",
              garments: ["ink suit", "oxfords"],
              imageDirection: "An ink wool suit in a lobby.",
            },
          ],
        }) +
        "\n```",
      1,
    );
    expect(outfits[0]?.name).toBe("Ink suit");
  });

  it("rejects the wrong number of outfits", () => {
    expect(() => parseOutfits(JSON.stringify({ outfits: [] }), 2)).toThrow(/instead of 2/);
  });
});
