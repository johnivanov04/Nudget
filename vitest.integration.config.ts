import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

/**
 * Integration tests run against a LOCAL Supabase Postgres (real auth + RLS).
 * They are separated from the unit suite (`*.itest.ts`, not `*.test.ts`) and are
 * gated behind env (see tests/integration/setup.ts) so `npm test` stays green
 * without a database. Run them with:
 *
 *   supabase start
 *   NUDGET_DB_TEST=1 \
 *   SUPABASE_TEST_URL=... SUPABASE_TEST_ANON_KEY=... SUPABASE_TEST_SERVICE_ROLE_KEY=... \
 *   npm run test:integration
 */
export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'node',
    include: ['tests/integration/**/*.itest.ts'],
    setupFiles: ['tests/integration/setup.ts'],
    // The tests share one database; run files serially to keep isolation simple.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
