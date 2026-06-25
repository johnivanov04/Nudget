/**
 * Nudge service: decides + records the nudges to send for a user.
 *
 * Loads the user's preferences, a freshly computed runway snapshot + bills, and
 * today's nudge history, runs the pure `planNudges` engine, records each planned
 * nudge in `nudge_events`, and emits a privacy-safe `nudge_sent` analytics event.
 * Actual APNs delivery is a later phase — this produces the decision + record.
 */
import {
  planNudges,
  DEFAULT_NUDGE_PREFERENCES,
  type NudgePreferences,
  type NudgeType,
  type PlannedNudge,
} from '@/lib/domain/nudges';
import { computeRunwayForUser } from './runway';
import { deliverNudges } from './push';
import { notificationPreferencesRepo, nudgeEventsRepo } from '@/lib/db/repositories';
import { analyticsEvents, emitAnalytics } from '@/lib/analytics/events';
import type { NotificationPreferencesRow } from '@/lib/db/types';

export function preferencesRowToEngine(row: NotificationPreferencesRow | null): NudgePreferences {
  if (!row) return DEFAULT_NUDGE_PREFERENCES;
  return {
    enabled: row.enabled,
    morningEnabled: row.morning_enabled,
    billApproachEnabled: row.bill_approach_enabled,
    dangerEnabled: row.danger_enabled,
    tone: row.tone,
    allowExtra: row.allow_extra,
  };
}

export interface PlanAndRecordResult {
  status: 'sent' | 'none' | 'disabled' | 'needs_data';
  planned: PlannedNudge[];
}

export async function planAndRecordNudges(
  userId: string,
  occasion: 'morning' | 'event',
  now: Date = new Date(),
): Promise<PlanAndRecordResult> {
  const prefs = preferencesRowToEngine(await notificationPreferencesRepo.getByUser(userId));
  if (!prefs.enabled) return { status: 'disabled', planned: [] };

  const { snapshot, bills, today } = await computeRunwayForUser(userId, now);
  if (!snapshot) return { status: 'needs_data', planned: [] };

  // Throttle window: nudges already sent since the start of the user's local day.
  const startOfToday = `${today}T00:00:00.000Z`;
  const sentRows = await nudgeEventsRepo.listSentSince(userId, startOfToday);
  const sentToday = sentRows.map((r) => r.type) as NudgeType[];

  const planned = planNudges({ snapshot, upcomingBills: bills, today, occasion, sentToday }, prefs);

  for (const nudge of planned) {
    await nudgeEventsRepo.insert({
      user_id: userId,
      type: nudge.type,
      copy_key: nudge.copyKey,
      risk_level: nudge.riskLevel,
      sent_at: now.toISOString(),
      opened_at: null,
      feedback: null,
    });
    emitAnalytics(
      analyticsEvents.nudgeSent({
        nudgeType: nudge.type,
        riskLevel: nudge.riskLevel,
        copyKey: nudge.copyKey,
      }),
    );
  }

  // Best-effort APNs delivery. No-ops if push isn't configured, and never throws
  // — recording the nudge above is the source of truth, delivery is downstream.
  if (planned.length > 0) {
    await deliverNudges(userId, planned, now.getTime());
  }

  return { status: planned.length > 0 ? 'sent' : 'none', planned };
}

/**
 * Preview what nudge(s) would fire right now WITHOUT recording or throttling —
 * for the "send me a test nudge" settings affordance.
 */
export async function previewNudges(
  userId: string,
  occasion: 'morning' | 'event',
  now: Date = new Date(),
): Promise<PlannedNudge[]> {
  const prefs = preferencesRowToEngine(await notificationPreferencesRepo.getByUser(userId));
  const { snapshot, bills, today } = await computeRunwayForUser(userId, now);
  if (!snapshot) return [];
  return planNudges({ snapshot, upcomingBills: bills, today, occasion, sentToday: [] }, prefs);
}
