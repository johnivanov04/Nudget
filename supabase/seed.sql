-- =============================================================================
-- Local development seed.
--
-- NOTE: The runway engine is already testable WITHOUT a database via the
-- TypeScript seed at src/lib/mock/seedData.ts (run `npm run demo:runway`). This
-- SQL seed populates Postgres so the DB-backed routes (Phase 4+) have realistic
-- data once they exist.
--
-- It inserts a demo auth user; this works against a LOCAL Supabase stack
-- (`supabase db reset`). Do not run against production. All values are fictional.
-- The encrypted_access_token here is a PLACEHOLDER string, not a real Plaid
-- ciphertext — no real banking data ever lives in fixtures.
-- =============================================================================

-- Demo auth user (local only). The on_auth_user_created trigger creates profiles.
insert into auth.users (id, email, created_at, updated_at)
values ('00000000-0000-0000-0000-000000000001', 'demo@nudget.test', now(), now())
on conflict (id) do nothing;

-- Ensure the profile exists and is configured.
insert into profiles (id, email, timezone, onboarding_completed, privacy_acknowledged_at)
values ('00000000-0000-0000-0000-000000000001', 'demo@nudget.test', 'America/Los_Angeles', true, now())
on conflict (id) do update
  set onboarding_completed = excluded.onboarding_completed,
      privacy_acknowledged_at = excluded.privacy_acknowledged_at;

-- Plaid item (placeholder ciphertext — NOT a real token).
insert into plaid_items (id, user_id, plaid_item_id, encrypted_access_token, institution_name, status, last_sync_at)
values (
  '00000000-0000-0000-0000-0000000000a1',
  '00000000-0000-0000-0000-000000000001',
  'demo-item-1',
  'PLACEHOLDER_CIPHERTEXT_NOT_A_REAL_TOKEN',
  'Demo Bank',
  'active',
  now()
) on conflict (plaid_item_id) do nothing;

-- Checking account included in runway.
insert into accounts (id, user_id, plaid_item_id, plaid_account_id, name, type, subtype, mask, available_balance, current_balance, included_in_runway)
values (
  '00000000-0000-0000-0000-0000000000b1',
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-0000000000a1',
  'demo-acct-checking',
  'Everyday Checking', 'depository', 'checking', '0000', 1842.55, 1842.55, true
) on conflict (plaid_account_id) do nothing;

-- Biweekly paycheck schedule (last paid 2026-06-05; next 2026-07-03).
insert into paycheck_schedules (user_id, frequency, last_paycheck_date, next_paycheck_date, weekend_rule, custom_rules)
values (
  '00000000-0000-0000-0000-000000000001',
  'biweekly', date '2026-06-05', date '2026-07-03', 'before', null
) on conflict (user_id) do nothing;

-- A few transactions (positive = money out).
insert into transactions (user_id, account_id, plaid_transaction_id, merchant_name, amount, date, category, pending, ignored)
values
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000b1', 'demo-txn-1', 'Blue Bottle',  14.25, date '2026-06-20', 'Coffee Shops', false, false),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000b1', 'demo-txn-2', 'Trader Joes',  63.40, date '2026-06-20', 'Groceries',    true,  false),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000b1', 'demo-txn-3', 'Netflix',       9.99, date '2026-06-20', 'Streaming',    false, false),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000b1', 'demo-txn-4', 'Employer Inc', -2400.00, date '2026-06-20', 'Payroll Deposit', false, false)
on conflict (plaid_transaction_id) do nothing;

-- Recurring bills (rent + phone confirmed, gym candidate, insurance after payday).
insert into recurring_bills (user_id, merchant_name, amount_estimate, cadence, next_expected_date, confidence, status)
values
  ('00000000-0000-0000-0000-000000000001', 'Landlord',       1200.00, 'monthly', date '2026-06-30', 1.000, 'confirmed'),
  ('00000000-0000-0000-0000-000000000001', 'Mobile Carrier',   85.00, 'monthly', date '2026-06-28', 0.950, 'confirmed'),
  ('00000000-0000-0000-0000-000000000001', 'Fitness Club',     39.99, 'monthly', date '2026-06-26', 0.700, 'candidate'),
  ('00000000-0000-0000-0000-000000000001', 'Auto Insurance',  140.00, 'monthly', date '2026-07-10', 1.000, 'confirmed')
on conflict do nothing;
