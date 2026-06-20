/**
 * Integration: Plaid access tokens are never exposed to the client.
 *
 * Asserts that:
 *  1. The stored token is ciphertext (never the plaintext), and only the
 *     server-side helper can recover it.
 *  2. The RLS client path never yields a plaintext token: the owner only ever
 *     sees the encrypted column, and another user sees the row not at all.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { integrationEnabled, createUser, deleteUser, type TestUser } from './support';
import { plaidItemsRepo } from '@/lib/db/repositories';
import { decryptToken } from '@/lib/crypto/tokenCrypto';

const d = integrationEnabled ? describe : describe.skip;

d('Plaid token safety (integration)', () => {
  let owner: TestUser;
  let other: TestUser;
  const PLAINTEXT = 'access-sandbox-super-secret-do-not-leak';
  const key = process.env.TOKEN_ENCRYPTION_KEY ?? 'a'.repeat(64);
  let itemId: string;

  beforeAll(async () => {
    owner = await createUser();
    other = await createUser();
    const item = await plaidItemsRepo.create({
      userId: owner.userId,
      plaidItemId: `item-${owner.userId}`,
      accessToken: PLAINTEXT,
      institutionName: 'Vault Bank',
    });
    itemId = item.id;
  });
  afterAll(async () => {
    if (owner) await deleteUser(owner.userId);
    if (other) await deleteUser(other.userId);
  });

  it('stores ciphertext, not the plaintext token', async () => {
    const { data } = await owner.client.from('plaid_items').select('encrypted_access_token');
    const stored = (data ?? []) as Array<{ encrypted_access_token: string }>;
    expect(stored.length).toBe(1);
    expect(stored[0]!.encrypted_access_token).not.toContain(PLAINTEXT);
    expect(stored[0]!.encrypted_access_token).not.toBe(PLAINTEXT);
    // Only the server-side key recovers the plaintext.
    expect(decryptToken(stored[0]!.encrypted_access_token, key)).toBe(PLAINTEXT);
  });

  it('never exposes a column containing the plaintext token', async () => {
    const { data } = await owner.client.from('plaid_items').select('*');
    const row = (data ?? [])[0] as Record<string, unknown>;
    for (const value of Object.values(row)) {
      expect(String(value)).not.toContain(PLAINTEXT);
    }
  });

  it('another user cannot read the item at all (RLS)', async () => {
    const { data } = await other.client.from('plaid_items').select('*');
    expect(data ?? []).toHaveLength(0);
  });

  it('server-side decryption still works for the owner', async () => {
    expect(await plaidItemsRepo.getDecryptedAccessToken(itemId)).toBe(PLAINTEXT);
  });
});
