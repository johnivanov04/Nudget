-- =============================================================================
-- Safety buffer — a per-user cushion subtracted from safe-to-spend so the runway
-- never encourages spending to zero. The pure engine already supports it
-- (buildRunwaySnapshot's `safetyBuffer`); this stores the user's chosen amount.
-- Dollars (matches balances/amounts elsewhere). Defaults to 0 (no cushion).
-- =============================================================================

alter table profiles
  add column safety_buffer numeric not null default 0 check (safety_buffer >= 0);
