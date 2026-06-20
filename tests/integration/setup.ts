/**
 * Integration setup file (runs before any integration test module).
 *
 * Maps the SUPABASE_TEST_* variables onto the env vars the application code
 * reads, so the REAL repositories (which build their Supabase client from
 * `getEnv()`) talk to the local test database. This only happens when the
 * integration suite is enabled; otherwise nothing is touched and the tests skip.
 */
const enabled =
  process.env.NUDGET_DB_TEST === '1' &&
  !!process.env.SUPABASE_TEST_URL &&
  !!process.env.SUPABASE_TEST_ANON_KEY &&
  !!process.env.SUPABASE_TEST_SERVICE_ROLE_KEY;

if (enabled) {
  process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.SUPABASE_TEST_URL;
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.SUPABASE_TEST_ANON_KEY;
  process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY;
  // Plaid vars are unused by these tests but must satisfy env validation if read.
  process.env.PLAID_CLIENT_ID ||= 'integration-test-client';
  process.env.PLAID_SECRET ||= 'integration-test-secret';
  process.env.PLAID_ENV ||= 'sandbox';
  // A throwaway 32-byte key for token-encryption round-trips.
  process.env.TOKEN_ENCRYPTION_KEY ||= 'a'.repeat(64);
}
