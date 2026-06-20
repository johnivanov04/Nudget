-- =============================================================================
-- Phase 5 (backend slice) — nudges + notification preferences.
--
-- `device_tokens` stores a SHA-256 hash of the APNs device token for dedup +
-- identification. The raw token (needed to actually send a push) is stored
-- encrypted when APNs delivery lands in a later phase — this phase only handles
-- registration + preferences + the nudge decision logic.
-- =============================================================================

create type device_platform as enum ('ios', 'android');

create table device_tokens (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles (id) on delete cascade,
  platform    device_platform not null default 'ios',
  token_hash  text not null, -- sha256(device token); not the raw token
  enabled     boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, token_hash)
);
create index device_tokens_user_idx on device_tokens (user_id);
create trigger device_tokens_set_updated_at before update on device_tokens
  for each row execute function set_updated_at();

create table notification_preferences (
  user_id               uuid primary key references profiles (id) on delete cascade,
  enabled               boolean not null default true,
  morning_enabled       boolean not null default true,
  bill_approach_enabled boolean not null default true,
  danger_enabled        boolean not null default true,
  tone                  text not null default 'gentle' check (tone in ('gentle', 'direct', 'minimal')),
  morning_hour          smallint not null default 8 check (morning_hour between 0 and 23),
  allow_extra           boolean not null default false,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create trigger notification_preferences_set_updated_at before update on notification_preferences
  for each row execute function set_updated_at();

-- RLS — user-scoped, like every other table.
alter table device_tokens enable row level security;
alter table notification_preferences enable row level security;

create policy device_tokens_owner on device_tokens
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy notification_preferences_owner on notification_preferences
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
