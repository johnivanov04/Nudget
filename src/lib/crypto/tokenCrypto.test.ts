import { describe, it, expect } from 'vitest';
import {
  encryptToken,
  decryptToken,
  parseEncryptionKey,
  generateEncryptionKey,
} from './tokenCrypto';

const KEY_A = 'a'.repeat(64); // 32 bytes of 0xaa
const KEY_B = 'b'.repeat(64);

describe('tokenCrypto', () => {
  it('round-trips a Plaid access token', () => {
    const token = 'access-sandbox-1234-abcd-fake-token';
    const envelope = encryptToken(token, KEY_A);
    expect(envelope).not.toContain(token); // ciphertext must not leak plaintext
    expect(decryptToken(envelope, KEY_A)).toBe(token);
  });

  it('produces a different envelope each time (random IV)', () => {
    const a = encryptToken('secret', KEY_A);
    const b = encryptToken('secret', KEY_A);
    expect(a).not.toBe(b);
    expect(decryptToken(a, KEY_A)).toBe('secret');
    expect(decryptToken(b, KEY_A)).toBe('secret');
  });

  it('FAILURE: decrypting with the wrong key throws (auth tag mismatch)', () => {
    const envelope = encryptToken('secret', KEY_A);
    expect(() => decryptToken(envelope, KEY_B)).toThrow();
  });

  it('FAILURE: tampering with the envelope is detected', () => {
    const envelope = encryptToken('secret', KEY_A);
    const raw = Buffer.from(envelope, 'base64');
    const last = raw.length - 1;
    raw[last] = ((raw[last] ?? 0) ^ 0xff) & 0xff; // flip a ciphertext bit
    const tampered = raw.toString('base64');
    expect(() => decryptToken(tampered, KEY_A)).toThrow();
  });

  it('FAILURE: rejects malformed / too-short envelopes', () => {
    expect(() => decryptToken('AAAA', KEY_A)).toThrow();
  });

  it('FAILURE: rejects keys that are not 64 hex chars', () => {
    expect(() => parseEncryptionKey('tooshort')).toThrow();
    expect(() => parseEncryptionKey('z'.repeat(64))).toThrow(); // not hex
    expect(() => encryptToken('x', 'bad-key')).toThrow();
  });

  it('FAILURE: refuses to encrypt empty plaintext', () => {
    expect(() => encryptToken('', KEY_A)).toThrow();
  });

  it('generateEncryptionKey yields a usable 64-hex key', () => {
    const key = generateEncryptionKey();
    expect(key).toMatch(/^[0-9a-f]{64}$/);
    expect(decryptToken(encryptToken('hello', key), key)).toBe('hello');
  });
});
