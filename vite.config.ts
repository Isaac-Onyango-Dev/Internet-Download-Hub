import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(() => {
  const isWeb = process.env.VITE_TARGET === 'web';
  return {
    // GitHub Pages web app uses the /Internet-Download-Hub/web/ route
    // The desktop app (Electron) uses local file paths (./)
    base: isWeb ? '/Internet-Download-Hub/web/' : './',
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
      outDir: isWeb 
        ? path.resolve(import.meta.dirname, 'docs/web') 
        : path.resolve(import.meta.dirname, 'dist'),
      emptyOutDir: true,
    },
    server: {
      port: 5173,
      host: true,
      proxy: {
        '/api': {
          target: 'http://localhost:5005',
          changeOrigin: true,
        },
      },
    },
  };
});
