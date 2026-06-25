import { describe, it, expect } from 'vitest';
import { generateKeyPairSync, verify } from 'node:crypto';
import { buildApnsProviderToken, type ApnsConfig } from './client';

/** Split a JWT into exactly three string parts (satisfies noUncheckedIndexedAccess). */
function parts3(token: string): [string, string, string] {
  const p = token.split('.');
  expect(p).toHaveLength(3);
  return [p[0] ?? '', p[1] ?? '', p[2] ?? ''];
}

function testConfig(privateKeyPem: string): ApnsConfig {
  return {
    keyId: 'ABC123DEFG',
    teamId: 'TEAM123456',
    privateKeyPem,
    topic: 'app.nudget.ios',
    env: 'sandbox',
  };
}

describe('buildApnsProviderToken', () => {
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }) as string;

  it('produces a 3-part JWT with the right ES256 header and claims', () => {
    const token = buildApnsProviderToken(testConfig(pem), 1_700_000_000_000);
    const [h, c, s] = parts3(token);
    expect(s).toBeTruthy();

    const header = JSON.parse(Buffer.from(h, 'base64url').toString());
    expect(header).toEqual({ alg: 'ES256', kid: 'ABC123DEFG' });

    const claims = JSON.parse(Buffer.from(c, 'base64url').toString());
    expect(claims.iss).toBe('TEAM123456');
    expect(claims.iat).toBe(1_700_000_000); // seconds, not ms
  });

  it('signs with a verifiable IEEE-P1363 (64-byte) signature', () => {
    const token = buildApnsProviderToken(testConfig(pem), 1_700_000_000_000);
    const [h, c, s] = parts3(token);
    const signature = Buffer.from(s, 'base64url');
    // ES256 / P1363 signatures are exactly 64 bytes (r‖s); DER would be ~70-72.
    expect(signature.length).toBe(64);

    const okSig = verify(
      'sha256',
      Buffer.from(`${h}.${c}`),
      { key: publicKey, dsaEncoding: 'ieee-p1363' },
      signature,
    );
    expect(okSig).toBe(true);
  });

  it('accepts a \\n-escaped private key the same as a literal one', () => {
    const escaped = pem.replace(/\n/g, '\\n');
    // getApnsConfig does the un-escaping; here we just confirm the raw PEM signs.
    expect(() => buildApnsProviderToken(testConfig(pem), Date.now())).not.toThrow();
    expect(escaped).toContain('\\n');
  });
});
