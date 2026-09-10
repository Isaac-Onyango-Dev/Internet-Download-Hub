import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'client', 'src'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.test.{ts,tsx}'],
    exclude: ['node_modules', 'dist', 'release', 'electron/**'],
    passWithNoTests: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/**',
        'dist/**',
        'release/**',
        'electron/**',
        'client/src/components/ui/**',
        '**/*.config.ts',
        '**/*.config.cjs',
        'scripts/**',
      ],
    },
  },
});
