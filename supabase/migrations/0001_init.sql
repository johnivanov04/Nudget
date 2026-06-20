-- =============================================================================
-- Nudget — initial schema (Phase 1 / 2)
--
-- Design notes:
-- * `profiles` IS the "users" entity from the spec; it is keyed 1:1 to
--   Supabase auth.users(id). We never duplicate auth credentials.
-- * Row Level Security is ENABLED on every table and every policy is scoped to
--   auth.uid() = user_id. The service-role key (server jobs) bypasses RLS; the
--   anon/user key only ever sees the caller's own rows.
-- * plaid_items.encrypted_access_token stores ONLY ciphertext (AES-256-GCM from
--   lib/crypto/tokenCrypto). The plaintext Plaid access token is never stored,
--   never returned to the client, and never logged.
-- =============================================================================

create extension if not exists pgcrypto; -- gen_random_uuid()

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type paycheck_frequency as enum ('weekly', 'biweekly', 'semimonthly', 'monthly', 'custom');
create type weekend_rule       as enum ('none', 'before', 'after');
create type bill_status        as enum ('candidate', 'confirmed', 'rejected', 'archived');
create type risk_level         as enum ('safe', 'caution', 'danger');
create type plaid_item_status  as enum ('active', 'login_required', 'error', 'disconnected');
create type account_type       as enum ('depository', 'credit', 'loan', 'investment', 'other');
create type nudge_type         as enum ('morning_runway', 'bill_approach', 'danger_state', 'spending_spike');
create type feedback_event_type as enum ('bill_prediction', 'nudge_helpful', 'runway_confusing', 'saved_fee', 'other');

-- ---------------------------------------------------------------------------
-- updated_at trigger helper
-- ---------------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles  (= users)
-- ---------------------------------------------------------------------------
create table profiles (
  id                       uuid primary key references auth.users (id) on delete cascade,
  email                    text,
  timezone                 text not null default 'America/Los_Angeles',
  onboarding_completed     boolean not null default false,
  privacy_acknowledged_at  timestamptz,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);
create trigger profiles_set_updated_at before update on profiles
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- plaid_items
-- ---------------------------------------------------------------------------
create table plaid_items (
  id                      uuid primary key default gen_random_uuid(),
  user_id                 uuid not null references profiles (id) on delete cascade,
  plaid_item_id           text not null unique,
  encrypted_access_token  text not null,            -- ciphertext only, never plaintext
  institution_name        text,
  sync_cursor             text,
  status                  plaid_item_status not null default 'active',
  last_sync_at            timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);
create index plaid_items_user_id_idx on plaid_items (user_id);
create trigger plaid_items_set_updated_at before update on plaid_items
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- accounts
-- ---------------------------------------------------------------------------
create table accounts (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references profiles (id) on delete cascade,
  plaid_item_id      uuid not null references plaid_items (id) on delete cascade,
  plaid_account_id   text not null unique,
  name               text,
  type               account_type,
  subtype            text,
  mask               text,
  available_balance  numeric(14, 2),
  current_balance    numeric(14, 2),
  included_in_runway boolean not null default true,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index accounts_user_id_idx on accounts (user_id);
create index accounts_plaid_item_id_idx on accounts (plaid_item_id);
create trigger accounts_set_updated_at before update on accounts
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- transactions
--   amount: Plaid convention -> positive = money out (spend), negative = money in
-- ---------------------------------------------------------------------------
create table transactions (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references profiles (id) on delete cascade,
  account_id            uuid not null references accounts (id) on delete cascade,
  plaid_transaction_id  text not null unique,
  merchant_name         text,
  amount                numeric(14, 2) not null,
  date                  date not null,
  category              text,
  pending               boolean not null default false,
  is_spending           boolean,        -- null = auto-classify; true/false = user override
  ignored               boolean not null default false,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index transactions_user_date_idx on transactions (user_id, date desc);
create index transactions_account_idx on transactions (account_id);
create trigger transactions_set_updated_at before update on transactions
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- paycheck_schedules  (one active schedule per user for the MVP)
-- ---------------------------------------------------------------------------
create table paycheck_schedules (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references profiles (id) on delete cascade,
  frequency           paycheck_frequency not null,
  last_paycheck_date  date,
  next_paycheck_date  date,
  weekend_rule        weekend_rule not null default 'none',
  custom_rules        jsonb,            -- e.g. { "semimonthlyDays": [15, 31] }
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (user_id)
);
create trigger paycheck_schedules_set_updated_at before update on paycheck_schedules
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- recurring_bills
-- ---------------------------------------------------------------------------
create table recurring_bills (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references profiles (id) on delete cascade,
  merchant_name       text,
  amount_estimate     numeric(14, 2) not null,
  cadence             text,             -- 'monthly' | 'weekly' | 'annual' | ...
  next_expected_date  date,
  confidence          numeric(4, 3),    -- 0.000 .. 1.000
  status              bill_status not null default 'candidate',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index recurring_bills_user_idx on recurring_bills (user_id);
create index recurring_bills_next_date_idx on recurring_bills (user_id, next_expected_date);
create trigger recurring_bills_set_updated_at before update on recurring_bills
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- runway_snapshots  (immutable calculation records)
-- ---------------------------------------------------------------------------
create table runway_snapshots (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references profiles (id) on delete cascade,
  available_cash      numeric(14, 2),
  spent_today         numeric(14, 2) not null default 0,
  bills_before_payday numeric(14, 2) not null default 0,
  safe_to_spend       numeric(14, 2),
  daily_safe_spend    numeric(14, 2),
  risk_level          risk_level,
  payday_date         date,
  generated_at        timestamptz not null default now()
);
create index runway_snapshots_user_generated_idx on runway_snapshots (user_id, generated_at desc);

-- ---------------------------------------------------------------------------
-- nudge_events
-- ---------------------------------------------------------------------------
create table nudge_events (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles (id) on delete cascade,
  type        nudge_type not null,
  copy_key    text,             -- template key, NOT rendered text with dollar amounts
  risk_level  risk_level,
  sent_at     timestamptz,
  opened_at   timestamptz,
  feedback    text,
  created_at  timestamptz not null default now()
);
create index nudge_events_user_idx on nudge_events (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- feedback_events
-- ---------------------------------------------------------------------------
create table feedback_events (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles (id) on delete cascade,
  event_type  feedback_event_type not null,
  event_id    uuid,             -- references a bill / nudge / snapshot, when relevant
  rating      smallint check (rating between 1 and 5),
  free_text   text,
  created_at  timestamptz not null default now()
);
create index feedback_events_user_idx on feedback_events (user_id, created_at desc);

-- ===========================================================================
-- Row Level Security — enable + user-scoped policies on every table.
-- ===========================================================================
alter table profiles           enable row level security;
alter table plaid_items        enable row level security;
alter table accounts           enable row level security;
alter table transactions       enable row level security;
alter table paycheck_schedules enable row level security;
alter table recurring_bills    enable row level security;
alter table runway_snapshots   enable row level security;
alter table nudge_events       enable row level security;
alter table feedback_events    enable row level security;

-- profiles: a user can read/update only their own row.
create policy profiles_self_select on profiles for select using (auth.uid() = id);
create policy profiles_self_update on profiles for update using (auth.uid() = id);

-- Generic "owner can do everything to their own rows" for user-scoped tables.
create policy plaid_items_owner on plaid_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy accounts_owner on accounts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy transactions_owner on transactions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy paycheck_schedules_owner on paycheck_schedules
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy recurring_bills_owner on recurring_bills
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy runway_snapshots_owner on runway_snapshots
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy nudge_events_owner on nudge_events
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy feedback_events_owner on feedback_events
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ===========================================================================
-- Auto-provision a profile row when a new auth user is created.
-- ===========================================================================
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
