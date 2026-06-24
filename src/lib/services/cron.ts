/**
 * Scheduled morning-nudge job. A cron hits the endpoint every few minutes; this
 * selects the users whose chosen morning time (hour:minute, in their own
 * timezone) has just arrived and fires their morning nudge.
 *
 * A user is "due" when their local time is at or just past their target, within
 * a small catch-up window. The window tolerates cron jitter / a missed run, and
 * the nudge engine's once-per-day throttle dedups when several runs fall inside
 * it — so the cron should run at least every `windowMinutes`.
 */
import { hourInTimeZone, minuteInTimeZone } from '@/lib/domain/dateUtils';
import { notificationPreferencesRepo, type NudgeCandidate } from '@/lib/db/repositories';
import { planAndRecordNudges } from './nudges';
import { reportError } from '@/lib/observability/report';

export const DEFAULT_NUDGE_WINDOW_MINUTES = 15;

/** Pure: which candidates are due for their morning nudge at `now`. */
export function selectDueUsers(
  candidates: NudgeCandidate[],
  now: Date,
  windowMinutes: number = DEFAULT_NUDGE_WINDOW_MINUTES,
): string[] {
  return candidates
    .filter((c) => {
      if (!c.enabled || !c.morningEnabled) return false;
      const nowMinutes = hourInTimeZone(c.timezone, now) * 60 + minuteInTimeZone(c.timezone, now);
      const targetMinutes = c.morningHour * 60 + c.morningMinute;
      return nowMinutes >= targetMinutes && nowMinutes < targetMinutes + windowMinutes;
    })
    .map((c) => c.userId);
}

export interface MorningNudgeRunResult {
  candidates: number;
  due: number;
  sent: number;
}

export async function runMorningNudges(now: Date = new Date()): Promise<MorningNudgeRunResult> {
  const candidates = await notificationPreferencesRepo.listNudgeCandidates();
  const due = selectDueUsers(candidates, now);

  let sent = 0;
  for (const userId of due) {
    try {
      const result = await planAndRecordNudges(userId, 'morning', now);
      if (result.status === 'sent') sent += 1;
    } catch (err) {
      // One user's failure must not abort the batch.
      reportError(err, { scope: 'cron.morning-nudges', userId });
    }
  }

  return { candidates: candidates.length, due: due.length, sent };
}
