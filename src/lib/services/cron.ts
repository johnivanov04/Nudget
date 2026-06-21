/**
 * Scheduled morning-nudge job. A cron hits the endpoint hourly; this selects the
 * users whose chosen `morning_hour` matches the current hour *in their own
 * timezone* and fires their morning nudge (throttled by the nudge engine).
 */
import { hourInTimeZone } from '@/lib/domain/dateUtils';
import { notificationPreferencesRepo, type NudgeCandidate } from '@/lib/db/repositories';
import { planAndRecordNudges } from './nudges';
import { reportError } from '@/lib/observability/report';

/** Pure: which candidates are due for their morning nudge at `now`. */
export function selectDueUsers(candidates: NudgeCandidate[], now: Date): string[] {
  return candidates
    .filter(
      (c) => c.enabled && c.morningEnabled && hourInTimeZone(c.timezone, now) === c.morningHour,
    )
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
