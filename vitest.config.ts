import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    // Pure business logic + API route handlers run fine in a node environment.
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      // Business logic is the part that must stay covered.
      include: ['src/lib/domain/**', 'src/lib/crypto/**', 'src/lib/analytics/**', 'src/lib/env.ts'],
    },
  },
});
