import { describe, it, expect } from 'vitest';
import { scrubContext, reportError } from './report';

describe('scrubContext', () => {
  it('redacts sensitive keys at any depth', () => {
    const scrubbed = scrubContext({
      userId: 'u1',
      scope: 'sync',
      access_token: 'access-sandbox-secret',
      nested: { balance: 1234.56, merchant_name: 'Whole Foods', ok: 'keep' },
      list: [{ password: 'p' }],
    }) as Record<string, unknown>;

    expect(scrubbed.userId).toBe('u1');
    expect(scrubbed.scope).toBe('sync');
    expect(scrubbed.access_token).toBe('[redacted]');
    const nested = scrubbed.nested as Record<string, unknown>;
    expect(nested.balance).toBe('[redacted]');
    expect(nested.merchant_name).toBe('[redacted]');
    expect(nested.ok).toBe('keep');
    expect((scrubbed.list as Array<Record<string, unknown>>)[0]!.password).toBe('[redacted]');
  });

  it('leaves primitives untouched', () => {
    expect(scrubContext('hello')).toBe('hello');
    expect(scrubContext(42)).toBe(42);
  });
});

describe('reportError', () => {
  it('never throws, even on weird input', () => {
    expect(() => reportError(new Error('boom'), { userId: 'u1' })).not.toThrow();
    expect(() => reportError('string error')).not.toThrow();
    expect(() => reportError(null)).not.toThrow();
  });
});
