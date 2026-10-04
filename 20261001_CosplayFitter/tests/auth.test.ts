import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";
import { createApp } from "../server/app.ts";
import { ADMIN_ID, sameSecret } from "../server/auth.ts";
import { createSessionId } from "../server/sessions.ts";

const OPEN_PLACE = {
  ok: true,
  blocked: false,
  label: "Shibuya, Tokyo, Japan",
  dateLabel: "Monday 28 September 2026",
  temperatureC: 22,
  notice: "",
};

describe("login", () => {
  let sessionsDir: string;

  afterEach(async () => {
    if (sessionsDir) await rm(sessionsDir, { recursive: true, force: true });
  });

  it("compares secrets without treating a shorter value as equal", () => {
    expect(sameSecret("studio", "studio")).toBe(true);
    expect(sameSecret("studio", "stud")).toBe(false);
    expect(sameSecret("studio", "studio ")).toBe(false);
  });

  it("blocks the studio until the ID and password match", async () => {
    sessionsDir = await mkdtemp(path.join(tmpdir(), "auth-"));
    const app = await createApp({
      sessionsDir,
      lookupPlace: async () => OPEN_PLACE,
      auth: { user: "kyala", password: "correct horse" },
    });

    const locked = await request(app).get("/api/config");
    expect(locked.status).toBe(401);

    const wrong = await request(app).post("/api/login").send({ id: "kyala", password: "nope" });
    expect(wrong.status).toBe(401);

    const agent = request.agent(app);
    const signedIn = await agent.post("/api/login").send({ id: "kyala", password: "correct horse" });
    expect(signedIn.status).toBe(200);
    const session = await agent.get("/api/session");
    expect(session.body).toEqual({ authenticated: true, configured: true, admin: false });
    const config = await agent.get("/api/config");
    expect(config.status).toBe(200);

    await agent.post("/api/logout");
    const after = await agent.get("/api/config");
    expect(after.status).toBe(401);
  });

  it("stays locked when no ID and password are configured", async () => {
    sessionsDir = await mkdtemp(path.join(tmpdir(), "auth-"));
    const savedUser = process.env.APP_USER;
    const savedPassword = process.env.APP_PASSWORD;
    delete process.env.APP_USER;
    delete process.env.APP_PASSWORD;
    try {
      const fresh = await createApp({ sessionsDir, lookupPlace: async () => OPEN_PLACE });
      const session = await request(fresh).get("/api/session");
      expect(session.body).toEqual({ authenticated: false, configured: false, admin: false });
      const login = await request(fresh).post("/api/login").send({ id: "anyone", password: "anything" });
      expect(login.status).toBe(503);
      expect(login.body.error).toMatch(/APP_USER/);
    } finally {
      if (savedUser === undefined) delete process.env.APP_USER;
      else process.env.APP_USER = savedUser;
      if (savedPassword === undefined) delete process.env.APP_PASSWORD;
      else process.env.APP_PASSWORD = savedPassword;
    }
  });

  it("treats only ky_admin as the admin", async () => {
    sessionsDir = await mkdtemp(path.join(tmpdir(), "auth-"));
    const sessionId = createSessionId();
    const folder = path.join(sessionsDir, sessionId);
    await mkdir(folder, { recursive: true });
    await writeFile(path.join(folder, "note.txt"), "kept");
    const opened: string[] = [];

    const guest = await createApp({
      sessionsDir,
      lookupPlace: async () => OPEN_PLACE,
      auth: { user: "kyala", password: "correct horse" },
      openFolder: (dir) => opened.push(dir),
    });
    const guestAgent = request.agent(guest);
    expect((await guestAgent.post("/api/login").send({ id: "kyala", password: "correct horse" })).status).toBe(200);
    expect((await guestAgent.get("/api/session")).body.admin).toBe(false);
    expect((await guestAgent.get(`/api/sessions/${sessionId}/zip`)).status).toBe(403);
    expect((await guestAgent.post(`/api/sessions/${sessionId}/reveal`)).status).toBe(403);
    expect(opened).toEqual([]);

    const admin = await createApp({
      sessionsDir,
      lookupPlace: async () => OPEN_PLACE,
      auth: { user: ADMIN_ID, password: "correct horse" },
      openFolder: (dir) => opened.push(dir),
    });
    const adminAgent = request.agent(admin);
    expect((await adminAgent.post("/api/login").send({ id: ADMIN_ID, password: "correct horse" })).status).toBe(200);
    expect((await adminAgent.get("/api/session")).body).toEqual({
      authenticated: true,
      configured: true,
      admin: true,
    });
    const zip = await adminAgent.get(`/api/sessions/${sessionId}/zip`);
    expect(zip.status).toBe(200);
    expect(zip.headers["content-type"]).toMatch(/zip/);
    const reveal = await adminAgent.post(`/api/sessions/${sessionId}/reveal`);
    expect(reveal.status).toBe(200);
    expect(opened).toEqual([folder]);
  });
});
