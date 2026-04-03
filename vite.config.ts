import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  // GitHub Pages path: https://isaac-onyango-dev.github.io/Internet-Download-Hub/web/
  base: '/Internet-Download-Hub/web/',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'client', 'src'),
      '@shared': path.resolve(import.meta.dirname, 'shared'),
      '@assets': path.resolve(import.meta.dirname, 'attached_assets'),
    },
  },
  root: path.resolve(import.meta.dirname, 'client'),
  build: {
    // Output into docs/web — served by GitHub Pages alongside docs/index.html
    outDir: path.resolve(import.meta.dirname, 'docs/web'),
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    host: true,
    // No proxy needed — Cobalt calls go directly from the browser
  },
});
