-- =============================================================================
-- Phase 6 follow-up — minute-level precision for the scheduled morning nudge.
--
-- Adds `morning_minute` so a user can pick e.g. 8:35 (not just whole hours). The
-- cron selection matches hour AND minute within a small catch-up window, so the
-- cron should run at least every few minutes (see vercel.json: */5).
-- =============================================================================

alter table notification_preferences
  add column morning_minute smallint not null default 0
  check (morning_minute between 0 and 59);
