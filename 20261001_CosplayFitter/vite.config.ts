import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: path.join(root, "client"),
  plugins: [react()],
  resolve: {
    alias: {
      "@shared": path.join(root, "shared"),
    },
  },
  build: {
    outDir: path.join(root, "dist"),
    emptyOutDir: true,
  },
  server: {
    watch: {
      usePolling: true,
      interval: 1000,
      ignored: ["**/node_modules/**", "**/data/**", "**/dist/**"],
    },
  },
});
