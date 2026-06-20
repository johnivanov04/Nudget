/**
 * Plaid access-token encryption (at rest).
 *
 * Hard requirements from the spec:
 * - Plaid access tokens must be encrypted server-side.
 * - Tokens must never be exposed to the client or logged.
 *
 * Implementation: AES-256-GCM (authenticated encryption) using Node's built-in
 * `crypto` — no third-party dependency. The key comes from TOKEN_ENCRYPTION_KEY
 * (32 bytes as 64 hex chars). The output is a single base64 string laid out as:
 *
 *     [ iv (12 bytes) | auth tag (16 bytes) | ciphertext (n bytes) ]
 *
 * GCM's auth tag means any tampering with the stored value fails decryption,
 * rather than silently returning garbage.
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12; // 96-bit nonce, the GCM standard
const TAG_BYTES = 16;
const KEY_BYTES = 32; // AES-256

/** Marker so callers/tests can detect "this is one of our envelopes". */
export const ENCRYPTION_VERSION = 'v1';

/** Parse and validate the 64-hex-char encryption key into a 32-byte buffer. */
export function parseEncryptionKey(hexKey: string): Buffer {
  if (typeof hexKey !== 'string' || !/^[0-9a-fA-F]{64}$/.test(hexKey)) {
    throw new Error(
      'TOKEN_ENCRYPTION_KEY must be 64 hex characters (32 bytes). Generate one with: openssl rand -hex 32',
    );
  }
  return Buffer.from(hexKey, 'hex');
}

/**
 * Encrypt a plaintext secret (e.g. a Plaid access token).
 * Returns an opaque base64 envelope safe to store in Postgres.
 */
export function encryptToken(plaintext: string, hexKey: string): string {
  if (typeof plaintext !== 'string' || plaintext.length === 0) {
    throw new Error('encryptToken: plaintext must be a non-empty string');
  }
  const key = parseEncryptionKey(hexKey);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]).toString('base64');
}

/**
 * Decrypt an envelope produced by {@link encryptToken}. Throws if the key is
 * wrong, the data was tampered with, or the envelope is malformed.
 */
export function decryptToken(envelopeB64: string, hexKey: string): string {
  const key = parseEncryptionKey(hexKey);
  let raw: Buffer;
  try {
    raw = Buffer.from(envelopeB64, 'base64');
  } catch {
    throw new Error('decryptToken: invalid base64 envelope');
  }
  if (raw.length < IV_BYTES + TAG_BYTES + 1) {
    throw new Error('decryptToken: envelope too short / malformed');
  }
  const iv = raw.subarray(0, IV_BYTES);
  const tag = raw.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
  const ciphertext = raw.subarray(IV_BYTES + TAG_BYTES);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString('utf8');
}

/** Generate a fresh key (hex) — handy for local dev/tests. */
export function generateEncryptionKey(): string {
  return randomBytes(KEY_BYTES).toString('hex');
}
