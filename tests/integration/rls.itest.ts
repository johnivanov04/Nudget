/**
 * Integration: Row Level Security isolation.
 *
 * Proves that, through the RLS-enforced anon client (the path the iOS app uses),
 * user A can only ever see their own rows — not user B's — across every
 * user-scoped table, and that an unauthenticated client sees nothing.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  integrationEnabled,
  createUser,
  deleteUser,
  adminClient,
  anonClient,
  seedUserGraph,
  USER_SCOPED_TABLES,
  type TestUser,
} from './support';
import { encryptToken } from '@/lib/crypto/tokenCrypto';

const d = integrationEnabled ? describe : describe.skip;

d('RLS isolation (integration)', () => {
  let userA: TestUser;
  let userB: TestUser;
  const key = process.env.TOKEN_ENCRYPTION_KEY ?? 'a'.repeat(64);

  beforeAll(async () => {
    userA = await createUser();
    userB = await createUser();
    const admin = adminClient();
    await seedUserGraph(admin, userA.userId, encryptToken('tokenA', key));
    await seedUserGraph(admin, userB.userId, encryptToken('tokenB', key));
  });
  afterAll(async () => {
    if (userA) await deleteUser(userA.userId);
    if (userB) await deleteUser(userB.userId);
  });

  it('a user reads only their own rows in every user-scoped table', async () => {
    for (const table of USER_SCOPED_TABLES) {
      const { data, error } = await userA.client.from(table).select('user_id');
      expect(error, `select ${table}`).toBeNull();
      expect(data, `rows in ${table}`).not.toBeNull();
      // Every visible row belongs to user A; none belong to user B.
      for (const row of data as Array<{ user_id: string }>) {
        expect(row.user_id).toBe(userA.userId);
      }
      expect((data as unknown[]).length).toBeGreaterThan(0);
    }
  });

  it('a user cannot read another user’s rows even by explicit filter', async () => {
    for (const table of USER_SCOPED_TABLES) {
      const { data } = await userA.client.from(table).select('user_id').eq('user_id', userB.userId);
      expect(data ?? [], `cross-user read of ${table}`).toHaveLength(0);
    }
  });

  it('a user cannot write rows for another user (WITH CHECK)', async () => {
    const { error } = await userA.client.from('feedback_events').insert({
      user_id: userB.userId, // attempt to write as B
      event_type: 'other',
    });
    expect(error).not.toBeNull(); // RLS WITH CHECK rejects it
  });

  it('an unauthenticated anon client sees no rows', async () => {
    const anon = anonClient();
    for (const table of USER_SCOPED_TABLES) {
      const { data } = await anon.from(table).select('user_id');
      expect(data ?? [], `anon read of ${table}`).toHaveLength(0);
    }
  });

  it('profiles are isolated too', async () => {
    const { data } = await userA.client.from('profiles').select('id');
    const ids = (data ?? []).map((r: { id: string }) => r.id);
    expect(ids).toContain(userA.userId);
    expect(ids).not.toContain(userB.userId);
  });
});
