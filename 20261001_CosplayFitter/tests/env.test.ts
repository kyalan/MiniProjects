import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadEnvLocal } from "../server/env.ts";

const originals = new Map<string, string | undefined>();

function remember(key: string) {
  if (!originals.has(key)) originals.set(key, process.env[key]);
}

afterEach(() => {
  for (const [key, value] of originals) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  originals.clear();
});

describe("loadEnvLocal", () => {
  it("uses the file when Windows already set the same name", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "cosplay-env-"));
    const file = path.join(dir, ".env.local");
    writeFileSync(file, "GEMINI_API_KEY=from-file\nAPP_USER=from-file\n");
    remember("GEMINI_API_KEY");
    remember("APP_USER");
    process.env.GEMINI_API_KEY = "from-machine";
    process.env.APP_USER = "from-machine";
    try {
      loadEnvLocal(file);
      expect(process.env.GEMINI_API_KEY).toBe("from-file");
      expect(process.env.APP_USER).toBe("from-file");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
