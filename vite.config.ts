import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  base: './',
  // Serve the repo's generated app assets as Vite "public" files.
  // This makes `/icons/*` and `/icon.png` work consistently in dev and in the packaged build output.
  publicDir: path.resolve(import.meta.dirname, "assets"),
  plugins: [
    react(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    strictPort: true,
    hmr: {
      port: 5173
    },
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
