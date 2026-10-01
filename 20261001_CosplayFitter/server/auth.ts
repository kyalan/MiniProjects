import { randomBytes, timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

export const SESSION_COOKIE = "cosplay_session";
const SESSION_MS = 7 * 24 * 60 * 60 * 1000;

export interface LoginCredentials {
  user: string;
  password: string;
}

export type AuthSetting = LoginCredentials | null;

const OPEN_API = new Set(["/api/login", "/api/logout", "/api/session"]);

export function credentialsFromEnv(): LoginCredentials | null {
  const user = process.env.APP_USER?.trim() ?? "";
  const password = process.env.APP_PASSWORD ?? "";
  if (!user || !password) return null;
  return { user, password };
}

export function sameSecret(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) {
    timingSafeEqual(a, a);
    return false;
  }
  return timingSafeEqual(a, b);
}

export function readCookie(header: string | undefined, name: string): string {
  if (!header) return "";
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq <= 0) continue;
    const key = part.slice(0, eq).trim();
    if (key !== name) continue;
    return decodeURIComponent(part.slice(eq + 1).trim());
  }
  return "";
}

function sessionCookie(token: string, maxAge: number): string {
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}`;
}

export function createAuth(credentials: AuthSetting) {
  const sessions = new Map<string, number>();

  function validToken(token: string): boolean {
    if (!token) return false;
    const createdAt = sessions.get(token);
    if (createdAt === undefined) return false;
    if (Date.now() - createdAt > SESSION_MS) {
      sessions.delete(token);
      return false;
    }
    return true;
  }

  function signedIn(req: Request): boolean {
    return validToken(readCookie(req.header("cookie"), SESSION_COOKIE));
  }

  function login(id: string, password: string): { ok: true; cookie: string } | { ok: false; status: number; error: string } {
    if (!credentials) {
      return {
        ok: false,
        status: 503,
        error: "Set APP_USER and APP_PASSWORD in .env.local, then restart.",
      };
    }
    if (!sameSecret(id, credentials.user) || !sameSecret(password, credentials.password)) {
      return { ok: false, status: 401, error: "That ID or password is wrong." };
    }
    const token = randomBytes(32).toString("base64url");
    sessions.set(token, Date.now());
    return { ok: true, cookie: sessionCookie(token, Math.floor(SESSION_MS / 1000)) };
  }

  function logout(req: Request): string {
    const token = readCookie(req.header("cookie"), SESSION_COOKIE);
    if (token) sessions.delete(token);
    return sessionCookie("", 0);
  }

  function guard(req: Request, res: Response, next: NextFunction): void {
    if (!req.path.startsWith("/api") || OPEN_API.has(req.path)) {
      next();
      return;
    }
    if (!credentials) {
      res.status(503).json({ error: "Set APP_USER and APP_PASSWORD in .env.local, then restart." });
      return;
    }
    if (!signedIn(req)) {
      res.status(401).json({ error: "Sign in to use Cosplay Fitter." });
      return;
    }
    next();
  }

  return { credentials, signedIn, login, logout, guard };
}
