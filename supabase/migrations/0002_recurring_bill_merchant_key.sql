-- =============================================================================
-- Phase 4 — recurring bill detection support.
--
-- Adds a normalized `merchant_key` so detection can upsert candidates
-- idempotently (re-running detection updates the same row instead of creating
-- duplicates). The unique constraint is on (user_id, merchant_key); NULL keys
-- (manually added bills) do not conflict, since NULLs are distinct in Postgres.
-- =============================================================================

alter table recurring_bills
  add column merchant_key text;

alter table recurring_bills
  add constraint recurring_bills_user_merchant_key unique (user_id, merchant_key);
