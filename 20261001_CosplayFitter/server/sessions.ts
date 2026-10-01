import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import archiver from "archiver";
import type { Response } from "express";

const SESSION_ID = /^\d{8}-\d{6}-[0-9a-f-]{36}$/i;

export function createSessionId(now = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  const stamp = [
    `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}`,
    `${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}`,
  ].join("-");
  return `${stamp}-${randomUUID()}`;
}

export function resolveSessionDir(sessionsDir: string, id: string): string | null {
  if (!SESSION_ID.test(id)) return null;
  const root = path.resolve(sessionsDir);
  const dir = path.resolve(root, id);
  const relative = path.relative(root, dir);
  if (relative.startsWith("..") || path.isAbsolute(relative)) return null;
  return dir;
}

export function redact(text: string, secret: string): string {
  if (!secret || secret.length < 8 || !text.includes(secret)) return text;
  return text.split(secret).join("[redacted]");
}

export async function writeText(file: string, text: string): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, text, "utf8");
}

export async function writeJson(file: string, value: unknown, secret = ""): Promise<void> {
  await writeText(file, redact(JSON.stringify(value, null, 2), secret));
}

export function extensionForMime(mimeType: string): string {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  if (mimeType === "image/jpeg") return "jpg";
  return "img";
}

export async function writeBase64File(file: string, base64: string): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, Buffer.from(base64, "base64"));
}

export function openFolder(dir: string): void {
  const options = { detached: true, stdio: "ignore" as const };
  if (process.platform === "win32") {
    spawn("explorer.exe", [dir], options).unref();
    return;
  }
  if (process.platform === "darwin") {
    spawn("open", [dir], options).unref();
    return;
  }
  spawn("xdg-open", [dir], options).unref();
}

export function pipeSessionZip(dir: string, res: Response): void {
  const filename = `${path.basename(dir)}.zip`;
  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  const archive = archiver("zip", { zlib: { level: 9 } });
  archive.on("error", (error) => {
    if (!res.headersSent) {
      res.status(500).json({ error: "The session zip could not be built." });
      return;
    }
    res.destroy(error);
  });
  archive.pipe(res);
  archive.directory(dir, false);
  void archive.finalize();
}
