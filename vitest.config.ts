import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  test: {
    environment: 'node',
    // The first server start is slow on a cold Windows machine.
    testTimeout: 20000,
    include: ['apps/**/*.test.{ts,tsx}', 'packages/**/*.test.ts'],
  },
});
