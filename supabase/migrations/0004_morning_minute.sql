-- =============================================================================
-- Phase 6 follow-up — minute-level precision for the scheduled morning nudge.
--
-- Adds `morning_minute` so a user can pick e.g. 8:35 (not just whole hours). The
-- cron selection matches hour AND minute within a small catch-up window, so to
-- honor minute precision the cron must run every few minutes (*/5). That needs
-- Vercel Pro; on the free Hobby tier crons are daily-only, so the schedule is
-- left out of vercel.json until both Pro + APNs push delivery are in place.
-- =============================================================================

alter table notification_preferences
  add column morning_minute smallint not null default 0
  check (morning_minute between 0 and 59);
