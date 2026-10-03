import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { Request, Response } from "express";

export const SESSION_COOKIE = "fitting_session";
const SESSION_MS = 12 * 60 * 60 * 1000;

let fallbackSecret = "";

function sessionSecret(): string {
  const fromEnv = process.env.APP_SESSION_SECRET?.trim();
  if (fromEnv) return fromEnv;
  if (!fallbackSecret) fallbackSecret = randomBytes(32).toString("base64url");
  return fallbackSecret;
}

function sameSecret(left: string, right: string): boolean {
  const a = createHash("sha256").update(left).digest();
  const b = createHash("sha256").update(right).digest();
  return timingSafeEqual(a, b);
}

export function credentialsConfigured(): boolean {
  return Boolean(process.env.APP_LOGIN_ID?.trim() && process.env.APP_LOGIN_PASSWORD?.trim());
}

export function credentialsMatch(id: string, password: string): boolean {
  if (!credentialsConfigured()) return false;
  const expectedId = process.env.APP_LOGIN_ID?.trim() ?? "";
  const expectedPassword = process.env.APP_LOGIN_PASSWORD?.trim() ?? "";
  const idOk = sameSecret(id.trim(), expectedId);
  const passwordOk = sameSecret(password, expectedPassword);
  return idOk && passwordOk;
}

export function issueSession(id: string): string {
  const payload = Buffer.from(JSON.stringify({ id: id.trim(), exp: Date.now() + SESSION_MS })).toString("base64url");
  const sig = createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function readSession(req: Request): string | null {
  const header = req.header("cookie");
  if (!header) return null;
  const pair = header
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE}=`));
  if (!pair) return null;
  const token = decodeURIComponent(pair.slice(SESSION_COOKIE.length + 1));
  const splitAt = token.lastIndexOf(".");
  if (splitAt <= 0) return null;
  const payload = token.slice(0, splitAt);
  const sig = token.slice(splitAt + 1);
  const expected = createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
  const left = Buffer.from(sig);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  try {
    const body = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { id?: unknown; exp?: unknown };
    if (typeof body.id !== "string" || typeof body.exp !== "number" || body.exp < Date.now()) return null;
    return body.id;
  } catch {
    return null;
  }
}

export function setSessionCookie(res: Response, id: string): void {
  res.cookie(SESSION_COOKIE, issueSession(id), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MS,
  });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE, { path: "/" });
}
