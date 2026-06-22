import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Bypass postcss.config.mjs (Tailwind v4 incompatible with Vite 5 PostCSS loader in tests)
  css: {
    postcss: { plugins: [] },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'tests/unit/**/*.test.ts'],
    exclude: ['tests/e2e/**'],
    globals: true,
    setupFiles: ['tests/unit/setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
});
