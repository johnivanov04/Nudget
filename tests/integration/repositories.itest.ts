/**
 * Integration: every repository against a real local Supabase Postgres.
 *
 * Exercises the actual service-role data-access path the server uses. Gated by
 * `integrationEnabled` (see tests/integration/setup.ts + support.ts).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { integrationEnabled, createUser, deleteUser, type TestUser } from './support';

import {
  profilesRepo,
  plaidItemsRepo,
  accountsRepo,
  transactionsRepo,
  paycheckSchedulesRepo,
  recurringBillsRepo,
  runwaySnapshotsRepo,
  nudgeEventsRepo,
  feedbackEventsRepo,
  deviceTokensRepo,
  hashDeviceToken,
  notificationPreferencesRepo,
} from '@/lib/db/repositories';

const d = integrationEnabled ? describe : describe.skip;

d('repositories (integration)', () => {
  let user: TestUser;

  beforeAll(async () => {
    user = await createUser();
  });
  afterAll(async () => {
    if (user) await deleteUser(user.userId);
  });

  it('profilesRepo: trigger creates a profile; flags update', async () => {
    const profile = await profilesRepo.getById(user.userId);
    expect(profile?.id).toBe(user.userId);

    await profilesRepo.markPrivacyAcknowledged(user.userId);
    await profilesRepo.setOnboardingCompleted(user.userId, true);
    const updated = await profilesRepo.getById(user.userId);
    expect(updated?.onboarding_completed).toBe(true);
    expect(updated?.privacy_acknowledged_at).not.toBeNull();
  });

  it('plaidItemsRepo: create encrypts, decrypt round-trips, sync + status + remove', async () => {
    const item = await plaidItemsRepo.create({
      userId: user.userId,
      plaidItemId: `item-${user.userId}`,
      accessToken: 'access-sandbox-secret-token',
      institutionName: 'Test Bank',
    });
    expect(item.encrypted_access_token).not.toContain('access-sandbox');

    const decrypted = await plaidItemsRepo.getDecryptedAccessToken(item.id);
    expect(decrypted).toBe('access-sandbox-secret-token');

    await plaidItemsRepo.updateSyncState(item.id, 'cursor-1');
    await plaidItemsRepo.setStatus(item.id, 'login_required');
    const list = await plaidItemsRepo.listByUser(user.userId);
    expect(list.find((i) => i.id === item.id)?.sync_cursor).toBe('cursor-1');

    // Ownership-scoped remove: wrong user is a no-op, right user deletes.
    expect(await plaidItemsRepo.removeOwned('00000000-0000-0000-0000-000000000000', item.id)).toBe(
      false,
    );
    expect(await plaidItemsRepo.removeOwned(user.userId, item.id)).toBe(true);
    expect((await plaidItemsRepo.listByUser(user.userId)).length).toBe(0);
  });

  it('plaidItemsRepo: getOwned + getByPlaidItemId lookups (Phase 3 sync paths)', async () => {
    const plaidItemId = `lookup-${user.userId}`;
    const item = await plaidItemsRepo.create({
      userId: user.userId,
      plaidItemId,
      accessToken: 'tok',
    });

    // getOwned: returns the item only for its owner.
    expect((await plaidItemsRepo.getOwned(user.userId, item.id))?.id).toBe(item.id);
    expect(
      await plaidItemsRepo.getOwned('00000000-0000-0000-0000-000000000000', item.id),
    ).toBeNull();

    // getByPlaidItemId: webhook path (no user context).
    expect((await plaidItemsRepo.getByPlaidItemId(plaidItemId))?.id).toBe(item.id);
    expect(await plaidItemsRepo.getByPlaidItemId('does-not-exist')).toBeNull();

    await plaidItemsRepo.removeOwned(user.userId, item.id);
  });

  it('accountsRepo + transactionsRepo: upsert, list, ignore, delete', async () => {
    const item = await plaidItemsRepo.create({
      userId: user.userId,
      plaidItemId: `item2-${user.userId}`,
      accessToken: 'tok',
    });
    await accountsRepo.upsertMany([
      {
        user_id: user.userId,
        plaid_item_id: item.id,
        plaid_account_id: `acct-${user.userId}`,
        name: 'Checking',
        type: 'depository',
        available_balance: 500,
        current_balance: 500,
        included_in_runway: true,
      },
    ]);
    const accounts = await accountsRepo.listByUser(user.userId);
    expect(accounts.length).toBeGreaterThan(0);
    const account = accounts[0]!;
    await accountsRepo.setIncludedInRunway(account.id, false);

    await transactionsRepo.upsertMany([
      {
        user_id: user.userId,
        account_id: account.id,
        plaid_transaction_id: `txn-${user.userId}`,
        merchant_name: 'Coffee',
        amount: 12,
        date: '2026-06-20',
        pending: false,
        ignored: false,
      },
    ]);
    const txns = await transactionsRepo.listByUser(user.userId, { from: '2026-06-01' });
    expect(txns.length).toBe(1);
    await transactionsRepo.setIgnored(user.userId, txns[0]!.id, true);
    await transactionsRepo.deleteByPlaidIds([`txn-${user.userId}`]);
    expect((await transactionsRepo.listByUser(user.userId)).length).toBe(0);
  });

  it('paycheckSchedulesRepo: upsert + re-upsert (one per user)', async () => {
    await paycheckSchedulesRepo.upsert({
      user_id: user.userId,
      frequency: 'biweekly',
      last_paycheck_date: '2026-06-05',
      next_paycheck_date: '2026-07-03',
      weekend_rule: 'before',
    });
    await paycheckSchedulesRepo.upsert({
      user_id: user.userId,
      frequency: 'monthly',
      last_paycheck_date: '2026-06-01',
      next_paycheck_date: '2026-07-01',
      weekend_rule: 'none',
    });
    const schedule = await paycheckSchedulesRepo.getByUser(user.userId);
    expect(schedule?.frequency).toBe('monthly'); // upsert replaced, not duplicated
  });

  it('recurringBillsRepo: upsert, filter by status, update', async () => {
    await recurringBillsRepo.upsertMany([
      { user_id: user.userId, merchant_name: 'Gym', amount_estimate: 40, status: 'candidate' },
    ]);
    const candidates = await recurringBillsRepo.listByUser(user.userId, ['candidate']);
    expect(candidates.length).toBe(1);
    const updated = await recurringBillsRepo.update(user.userId, candidates[0]!.id, {
      status: 'confirmed',
      amount_estimate: 45,
    });
    expect(updated.status).toBe('confirmed');
    expect(Number(updated.amount_estimate)).toBe(45);
  });

  it('recurringBillsRepo: upsertDetected is idempotent on (user_id, merchant_key)', async () => {
    await recurringBillsRepo.upsertDetected([
      {
        user_id: user.userId,
        merchant_key: 'spotify',
        merchant_name: 'Spotify',
        amount_estimate: 9.99,
        cadence: 'monthly',
        status: 'candidate',
      },
    ]);
    // Re-run with an updated amount: same key updates in place, no duplicate.
    await recurringBillsRepo.upsertDetected([
      {
        user_id: user.userId,
        merchant_key: 'spotify',
        merchant_name: 'Spotify',
        amount_estimate: 11.99,
        cadence: 'monthly',
        status: 'candidate',
      },
    ]);
    const rows = (await recurringBillsRepo.listByUser(user.userId)).filter(
      (b) => b.merchant_key === 'spotify',
    );
    expect(rows).toHaveLength(1);
    expect(Number(rows[0]!.amount_estimate)).toBe(11.99);
  });

  it('runwaySnapshotsRepo: insert + getLatest', async () => {
    await runwaySnapshotsRepo.insert({
      user_id: user.userId,
      available_cash: 1000,
      spent_today: 25,
      bills_before_payday: 200,
      safe_to_spend: 775,
      daily_safe_spend: 59,
      risk_level: 'safe',
      payday_date: '2026-07-03',
    });
    const latest = await runwaySnapshotsRepo.getLatest(user.userId);
    expect(latest?.risk_level).toBe('safe');
  });

  it('nudgeEventsRepo + feedbackEventsRepo: insert + list', async () => {
    const nudge = await nudgeEventsRepo.insert({
      user_id: user.userId,
      type: 'morning_runway',
      copy_key: 'safe.default',
      risk_level: 'safe',
      sent_at: new Date().toISOString(),
      opened_at: null,
      feedback: null,
    });
    await nudgeEventsRepo.markOpened(nudge.id);
    expect((await nudgeEventsRepo.listByUser(user.userId)).length).toBeGreaterThan(0);

    await feedbackEventsRepo.insert({
      user_id: user.userId,
      event_type: 'saved_fee',
      event_id: null,
      rating: 5,
      free_text: 'saved me an overdraft',
    });
    expect((await feedbackEventsRepo.listByUser(user.userId)).length).toBeGreaterThan(0);
  });

  it('deviceTokensRepo: stores a hash (not the raw token), idempotent register', async () => {
    const raw = 'apns-raw-device-token';
    const first = await deviceTokensRepo.register({ userId: user.userId, rawToken: raw });
    expect(first.token_hash).toBe(hashDeviceToken(raw));
    expect(first.token_hash).not.toContain(raw);
    // Re-registering the same token does not duplicate.
    await deviceTokensRepo.register({ userId: user.userId, rawToken: raw });
    const tokens = await deviceTokensRepo.listByUser(user.userId);
    expect(tokens.filter((t) => t.token_hash === hashDeviceToken(raw))).toHaveLength(1);
  });

  it('notificationPreferencesRepo: upsert + read (one per user)', async () => {
    await notificationPreferencesRepo.upsert({ user_id: user.userId, tone: 'direct' });
    await notificationPreferencesRepo.upsert({ user_id: user.userId, morning_enabled: false });
    const prefs = await notificationPreferencesRepo.getByUser(user.userId);
    expect(prefs?.tone).toBe('direct');
    expect(prefs?.morning_enabled).toBe(false);
  });
});
