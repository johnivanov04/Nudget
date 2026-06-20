/**
 * Shared helpers for the integration suite.
 *
 * `integrationEnabled` gates every test file. When the local Supabase env is not
 * provided, the suites self-skip with a console note (and `npm test` is wholly
 * unaffected — these files are `*.itest.ts`, not part of the unit `include`).
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';

export const integrationEnabled =
  process.env.NUDGET_DB_TEST === '1' &&
  !!process.env.SUPABASE_TEST_URL &&
  !!process.env.SUPABASE_TEST_ANON_KEY &&
  !!process.env.SUPABASE_TEST_SERVICE_ROLE_KEY;

const TEST_URL = process.env.SUPABASE_TEST_URL ?? '';
const TEST_ANON = process.env.SUPABASE_TEST_ANON_KEY ?? '';
const TEST_SERVICE = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY ?? '';

if (!integrationEnabled) {
  // eslint-disable-next-line no-console
  console.warn(
    '[integration] skipped — set NUDGET_DB_TEST=1 and SUPABASE_TEST_URL / SUPABASE_TEST_ANON_KEY / SUPABASE_TEST_SERVICE_ROLE_KEY (e.g. from `supabase start`).',
  );
}

/** Service-role client: bypasses RLS. Mirrors what the server repositories use. */
export function adminClient(): SupabaseClient {
  return createClient(TEST_URL, TEST_SERVICE, { auth: { persistSession: false } });
}

/** Anon client: honors RLS. Used to prove cross-user isolation. */
export function anonClient(): SupabaseClient {
  return createClient(TEST_URL, TEST_ANON, { auth: { persistSession: false } });
}

export interface TestUser {
  userId: string;
  email: string;
  /** An anon client signed in as this user (RLS-scoped, like the real app). */
  client: SupabaseClient;
}

/** Create a confirmed auth user and return an RLS-scoped client signed in as them. */
export async function createUser(): Promise<TestUser> {
  const email = `it_${randomUUID()}@nudget.test`;
  const password = `Pw_${randomUUID()}`;
  const admin = adminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) throw error ?? new Error('createUser failed');
  const userId = data.user.id;

  const client = anonClient();
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw signInError;

  return { userId, email, client };
}

export async function deleteUser(userId: string): Promise<void> {
  // Cascades through profiles -> all user-scoped tables.
  await adminClient().auth.admin.deleteUser(userId);
}

/**
 * Insert one row per user-scoped table for `userId` using the service-role
 * client (bypasses RLS). Returns the ids so RLS tests can assert isolation.
 */
export async function seedUserGraph(
  admin: SupabaseClient,
  userId: string,
  encryptedToken: string,
): Promise<{ plaidItemId: string; accountId: string; transactionId: string }> {
  const plaidItemId = randomUUID();
  const accountId = randomUUID();
  const transactionId = randomUUID();

  const item = await admin
    .from('plaid_items')
    .insert({
      id: plaidItemId,
      user_id: userId,
      plaid_item_id: `item-${plaidItemId}`,
      encrypted_access_token: encryptedToken,
      institution_name: 'Test Bank',
      status: 'active',
    })
    .select('id')
    .single();
  if (item.error) throw item.error;

  const account = await admin
    .from('accounts')
    .insert({
      id: accountId,
      user_id: userId,
      plaid_item_id: plaidItemId,
      plaid_account_id: `acct-${accountId}`,
      name: 'Checking',
      type: 'depository',
      available_balance: 1000,
      current_balance: 1000,
      included_in_runway: true,
    })
    .select('id')
    .single();
  if (account.error) throw account.error;

  const txn = await admin
    .from('transactions')
    .insert({
      id: transactionId,
      user_id: userId,
      account_id: accountId,
      plaid_transaction_id: `txn-${transactionId}`,
      merchant_name: 'Test Merchant',
      amount: 25,
      date: '2026-06-20',
      pending: false,
      ignored: false,
    })
    .select('id')
    .single();
  if (txn.error) throw txn.error;

  await admin.from('paycheck_schedules').insert({
    user_id: userId,
    frequency: 'biweekly',
    last_paycheck_date: '2026-06-05',
    next_paycheck_date: '2026-07-03',
    weekend_rule: 'none',
  });
  await admin.from('recurring_bills').insert({
    user_id: userId,
    merchant_name: 'Rent',
    amount_estimate: 1200,
    next_expected_date: '2026-06-30',
    status: 'confirmed',
  });
  await admin.from('runway_snapshots').insert({
    user_id: userId,
    available_cash: 1000,
    spent_today: 25,
    bills_before_payday: 1200,
    safe_to_spend: -200,
    daily_safe_spend: 0,
    risk_level: 'danger',
    payday_date: '2026-07-03',
  });
  await admin.from('nudge_events').insert({
    user_id: userId,
    type: 'morning_runway',
    copy_key: 'danger.default',
    risk_level: 'danger',
  });
  await admin.from('feedback_events').insert({
    user_id: userId,
    event_type: 'nudge_helpful',
    rating: 5,
  });
  await admin.from('device_tokens').insert({
    user_id: userId,
    platform: 'ios',
    token_hash: `hash-${userId}`,
  });
  await admin.from('notification_preferences').insert({ user_id: userId });

  return { plaidItemId, accountId, transactionId };
}

/** Every user-scoped table, for sweeping RLS assertions. */
export const USER_SCOPED_TABLES = [
  'plaid_items',
  'accounts',
  'transactions',
  'paycheck_schedules',
  'recurring_bills',
  'runway_snapshots',
  'nudge_events',
  'feedback_events',
  'device_tokens',
  'notification_preferences',
] as const;
