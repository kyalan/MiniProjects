import path from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "./app.ts";
import { loadEnvLocal } from "./env.ts";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

if (process.argv.includes("--prod")) {
  process.env.NODE_ENV = "production";
}

loadEnvLocal(path.join(rootDir, ".env.local"));

const port = Number(process.env.PORT) || 3000;
const app = await createApp({
  sessionsDir: path.join(rootDir, "data", "sessions"),
  serveClient: true,
  rootDir,
});

const server = app.listen(port, "127.0.0.1", () => {
  console.log(`Fitting Studio at http://127.0.0.1:${port}`);
});
server.requestTimeout = 0;
server.headersTimeout = 0;
server.timeout = 0;
