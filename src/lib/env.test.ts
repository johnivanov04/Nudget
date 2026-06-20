import { describe, it, expect } from 'vitest';
import { parseEnv, safeParseEnv } from './env';

const validEnv = {
  NEXT_PUBLIC_SUPABASE_URL: 'https://abc.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
  PLAID_CLIENT_ID: 'client-id',
  PLAID_SECRET: 'plaid-secret',
  PLAID_ENV: 'sandbox',
  TOKEN_ENCRYPTION_KEY: 'f'.repeat(64),
};

describe('env validation', () => {
  it('accepts a fully valid environment', () => {
    expect(() => parseEnv(validEnv)).not.toThrow();
    const parsed = parseEnv(validEnv);
    expect(parsed.PLAID_ENV).toBe('sandbox');
  });

  it('FAILURE: rejects a missing required variable', () => {
    const { SUPABASE_SERVICE_ROLE_KEY, ...rest } = validEnv;
    void SUPABASE_SERVICE_ROLE_KEY;
    expect(safeParseEnv(rest).success).toBe(false);
  });

  it('FAILURE: rejects a non-URL Supabase URL', () => {
    const r = safeParseEnv({ ...validEnv, NEXT_PUBLIC_SUPABASE_URL: 'not-a-url' });
    expect(r.success).toBe(false);
  });

  it('FAILURE: rejects an invalid PLAID_ENV', () => {
    const r = safeParseEnv({ ...validEnv, PLAID_ENV: 'staging' });
    expect(r.success).toBe(false);
  });

  it('FAILURE: rejects an encryption key that is not 64 hex chars', () => {
    expect(safeParseEnv({ ...validEnv, TOKEN_ENCRYPTION_KEY: 'abc' }).success).toBe(false);
    expect(safeParseEnv({ ...validEnv, TOKEN_ENCRYPTION_KEY: 'z'.repeat(64) }).success).toBe(false);
  });
});
