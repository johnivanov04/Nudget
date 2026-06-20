/**
 * Glue between the validated API request and the pure engine. Pure + testable.
 */
import { buildRunwaySnapshot, type RunwaySnapshot } from '@/lib/domain/snapshot';
import { nextPaydays } from '@/lib/domain/payday';
import type { EnginePaycheckSchedule } from '@/lib/domain/types';
import type { IsoDate } from '@/lib/domain/dateUtils';
import type { RecalculateBody, PaycheckScheduleBody } from './schemas';

export function scheduleBodyToEngine(body: PaycheckScheduleBody): EnginePaycheckSchedule {
  return {
    frequency: body.frequency,
    lastPaycheckDate: body.lastPaycheckDate,
    manualNextPaycheckDate: body.manualNextPaycheckDate ?? null,
    weekendRule: body.weekendRule,
    ...(body.semimonthlyDays ? { semimonthlyDays: body.semimonthlyDays } : {}),
  };
}

/**
 * Preview the next paydays for an onboarding schedule, relative to `reference`
 * (defaults to lastPaycheckDate so the preview is deterministic when no "today"
 * is supplied). Used by POST /api/onboarding/paycheck.
 */
export function previewNextPaydays(
  body: PaycheckScheduleBody,
  reference: IsoDate,
  count = 3,
): IsoDate[] {
  return nextPaydays(scheduleBodyToEngine(body), reference, count);
}

export function recalculateBodyToSnapshot(body: RecalculateBody): RunwaySnapshot {
  return buildRunwaySnapshot({
    today: body.today,
    availableCash: body.availableCash,
    transactions: body.transactions.map((t) => ({
      amount: t.amount,
      date: t.date,
      category: t.category ?? null,
      pending: t.pending,
      ignored: t.ignored,
      isSpendingOverride: t.isSpendingOverride ?? null,
    })),
    bills: body.bills.map((b) => ({
      amountEstimate: b.amountEstimate,
      nextExpectedDate: b.nextExpectedDate,
      status: b.status,
      confidence: b.confidence ?? null,
    })),
    schedule: scheduleBodyToEngine(body.schedule),
    safetyBuffer: body.safetyBuffer,
    includeCandidateBills: body.includeCandidateBills,
    cautionDailyFloor: body.cautionDailyFloor,
    lastUpdatedAt: body.lastUpdatedAt ?? null,
    now: body.now,
  });
}
