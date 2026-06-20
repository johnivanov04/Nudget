import { describe, it, expect } from 'vitest';
import {
  createHash,
  createPrivateKey,
  generateKeyPairSync,
  sign as cryptoSign,
  type JsonWebKey,
  type KeyObject,
} from 'node:crypto';
import { verifyPlaidWebhook } from './webhook';

// Generate a P-256 keypair once; sign tokens with the private key, verify with
// the public JWK (mirrors how Plaid signs webhooks and publishes its key).
const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const publicJwk = publicKey.export({ format: 'jwk' }) as JsonWebKey;

function b64url(input: string | Buffer): string {
  return Buffer.from(input).toString('base64url');
}

function signJwt(
  claims: Record<string, unknown>,
  opts: { key?: KeyObject; alg?: string; kid?: string } = {},
): string {
  const header = { alg: opts.alg ?? 'ES256', kid: opts.kid ?? 'test-kid', typ: 'JWT' };
  const headerB64 = b64url(JSON.stringify(header));
  const payloadB64 = b64url(JSON.stringify(claims));
  const signature = cryptoSign('sha256', Buffer.from(`${headerB64}.${payloadB64}`), {
    key: opts.key ?? privateKey,
    dsaEncoding: 'ieee-p1363',
  });
  return `${headerB64}.${payloadB64}.${b64url(signature)}`;
}

function bodyHash(body: string): string {
  return createHash('sha256').update(body, 'utf8').digest('hex');
}

const NOW = 1_750_000_000_000; // fixed clock
const getKey = async () => publicJwk;

describe('verifyPlaidWebhook', () => {
  it('accepts a correctly signed, fresh webhook with a matching body hash', async () => {
    const rawBody = '{"webhook_type":"TRANSACTIONS","webhook_code":"SYNC_UPDATES_AVAILABLE"}';
    const token = signJwt({ iat: NOW / 1000, request_body_sha256: bodyHash(rawBody) });
    expect(
      await verifyPlaidWebhook({
        rawBody,
        verificationHeader: token,
        getVerificationKey: getKey,
        now: NOW,
      }),
    ).toBe(true);
  });

  it('rejects when the body does not match the signed hash (tampering)', async () => {
    const signedBody = '{"a":1}';
    const token = signJwt({ iat: NOW / 1000, request_body_sha256: bodyHash(signedBody) });
    expect(
      await verifyPlaidWebhook({
        rawBody: '{"a":2}', // different body
        verificationHeader: token,
        getVerificationKey: getKey,
        now: NOW,
      }),
    ).toBe(false);
  });

  it('rejects a signature made with a different key', async () => {
    const other = generateKeyPairSync('ec', { namedCurve: 'P-256' });
    const rawBody = '{}';
    const token = signJwt(
      { iat: NOW / 1000, request_body_sha256: bodyHash(rawBody) },
      { key: createPrivateKey(other.privateKey.export({ type: 'pkcs8', format: 'pem' })) },
    );
    expect(
      await verifyPlaidWebhook({
        rawBody,
        verificationHeader: token,
        getVerificationKey: getKey, // still the original public key
        now: NOW,
      }),
    ).toBe(false);
  });

  it('rejects a stale token (replay protection)', async () => {
    const rawBody = '{}';
    const oldIat = NOW / 1000 - 600; // 10 minutes old
    const token = signJwt({ iat: oldIat, request_body_sha256: bodyHash(rawBody) });
    expect(
      await verifyPlaidWebhook({
        rawBody,
        verificationHeader: token,
        getVerificationKey: getKey,
        now: NOW,
      }),
    ).toBe(false);
  });

  it('rejects a non-ES256 / "none" algorithm', async () => {
    const rawBody = '{}';
    const token = signJwt(
      { iat: NOW / 1000, request_body_sha256: bodyHash(rawBody) },
      { alg: 'none' },
    );
    expect(
      await verifyPlaidWebhook({
        rawBody,
        verificationHeader: token,
        getVerificationKey: getKey,
        now: NOW,
      }),
    ).toBe(false);
  });

  it('rejects missing or malformed headers', async () => {
    expect(
      await verifyPlaidWebhook({
        rawBody: '{}',
        verificationHeader: null,
        getVerificationKey: getKey,
      }),
    ).toBe(false);
    expect(
      await verifyPlaidWebhook({
        rawBody: '{}',
        verificationHeader: 'not-a-jwt',
        getVerificationKey: getKey,
      }),
    ).toBe(false);
  });

  it('rejects when the key cannot be fetched', async () => {
    const rawBody = '{}';
    const token = signJwt({ iat: NOW / 1000, request_body_sha256: bodyHash(rawBody) });
    expect(
      await verifyPlaidWebhook({
        rawBody,
        verificationHeader: token,
        getVerificationKey: async () => {
          throw new Error('key service down');
        },
        now: NOW,
      }),
    ).toBe(false);
  });
});
