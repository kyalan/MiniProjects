import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createPortraitLoader } from "../server/portraits.ts";

const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

describe("portrait cache", () => {
  let cacheDir: string;

  afterEach(async () => {
    if (cacheDir) await rm(cacheDir, { recursive: true, force: true });
  });

  it("downloads a matching portrait once and then reads the file", async () => {
    cacheDir = await mkdtemp(path.join(tmpdir(), "acg-"));
    let rosterCalls = 0;
    let imageCalls = 0;
    const fetchImpl: typeof fetch = async (input) => {
      const url = String(input);
      if (url.includes("/characters") && !url.endsWith(".png")) {
        rosterCalls += 1;
        return Response.json({
          data: [
            {
              character: {
                name: "Monkey D. Luffy",
                images: { jpg: { image_url: "https://cdn.example/luffy.png" } },
              },
            },
          ],
        });
      }
      imageCalls += 1;
      return new Response(TINY_PNG, { headers: { "content-type": "image/png" } });
    };
    const load = createPortraitLoader({ cacheDir, fetchImpl });
    const first = await load("one_piece", "luffy");
    const second = await load("one_piece", "luffy");
    expect(first?.mimeType).toBe("image/png");
    expect(second?.imageBase64).toBe(first?.imageBase64);
    expect(rosterCalls).toBe(1);
    expect(imageCalls).toBe(1);
    const saved = await readFile(path.join(cacheDir, "one_piece", "luffy.png"));
    expect(saved.equals(TINY_PNG)).toBe(true);
  });

  it("returns null for an unknown character without calling the network", async () => {
    cacheDir = await mkdtemp(path.join(tmpdir(), "acg-"));
    let calls = 0;
    const fetchImpl: typeof fetch = async () => {
      calls += 1;
      return Response.json({ data: [] });
    };
    const load = createPortraitLoader({ cacheDir, fetchImpl });
    expect(await load("one_piece", "nobody")).toBeNull();
    expect(calls).toBe(0);
  });
});
