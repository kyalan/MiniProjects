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

  it("downloads a pinned film poster once and does not call Jikan", async () => {
    cacheDir = await mkdtemp(path.join(tmpdir(), "acg-"));
    const seen: string[] = [];
    const fetchImpl: typeof fetch = async (input) => {
      const url = String(input);
      seen.push(url);
      if (url.includes("api.php")) {
        return Response.json({
          query: {
            pages: {
              "10706": {
                imageinfo: [{ thumburl: "https://cdn.example/paul.jpg" }],
              },
            },
          },
        });
      }
      return new Response(TINY_PNG, { headers: { "content-type": "image/png" } });
    };
    const load = createPortraitLoader({ cacheDir, fetchImpl });
    const first = await load("desert", "paul");
    const second = await load("desert", "paul");
    expect(first?.mimeType).toBe("image/png");
    expect(second?.imageBase64).toBe(first?.imageBase64);
    expect(seen.some((url) => url.includes("jikan.moe"))).toBe(false);
    expect(seen.filter((url) => url.includes("paul.jpg"))).toHaveLength(1);
    const wiki = seen.find((url) => url.includes("api.php")) ?? "";
    expect(wiki).toContain("Dune+Character+Poster+-+Paul.jpeg");
    expect(wiki).toContain("iiurlwidth=800");
    const saved = await readFile(path.join(cacheDir, "desert", "paul.png"));
    expect(saved.equals(TINY_PNG)).toBe(true);
  });

  it("downloads a wiki page image for a Jungle character", async () => {
    cacheDir = await mkdtemp(path.join(tmpdir(), "acg-"));
    const seen: string[] = [];
    const fetchImpl: typeof fetch = async (input) => {
      const url = String(input);
      seen.push(url);
      if (url.includes("api.php")) {
        return Response.json({
          query: {
            pages: {
              "2453": {
                title: "Ruby Roundhouse",
                thumbnail: { source: "https://cdn.example/ruby.png" },
              },
            },
          },
        });
      }
      return new Response(TINY_PNG, { headers: { "content-type": "image/png" } });
    };
    const load = createPortraitLoader({ cacheDir, fetchImpl });
    const portrait = await load("jungle", "ruby");
    expect(portrait?.mimeType).toBe("image/png");
    const wiki = seen.find((url) => url.includes("api.php")) ?? "";
    expect(wiki).toContain("Ruby+Roundhouse");
    expect(wiki).toContain("pithumbsize=800");
    expect(seen.some((url) => url.includes("jikan.moe"))).toBe(false);
  });
});
