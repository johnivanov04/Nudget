/**
 * Runway snapshot composer.
 *
 * Ties the pure modules together into the single object the dashboard, widget,
 * and nudges consume: spent today, bills before payday, safe-to-spend, daily
 * safe spend, risk level, payday, and a last-updated/stale signal.
 *
 * This is still a PURE function — it takes plain inputs (sourced from mock data
 * in tests, or from the DB in API routes) and returns a plain result. It is the
 * seam the seed/mock data plugs into so the engine is testable without Plaid.
 */
import { calculateDailySpend } from './dailySpend';
import { calculateRunway } from './runway';
import { assignRiskLevel, type RiskReasonKey } from './risk';
import { nextPaydayOnOrAfter } from './payday';
import { dataFreshness } from './freshness';
import type { EngineBill, EnginePaycheckSchedule, EngineTransaction, RiskLevel } from './types';
import type { IsoDate } from './dateUtils';

export interface SnapshotInput {
  /** The user's "today" in their own timezone, as 'YYYY-MM-DD'. */
  today: IsoDate;
  /**
   * Spendable cash across accounts the user includes in runway. `null` means we
   * have no balance yet (e.g. Plaid not linked / first sync pending).
   */
  availableCash: number | null;
  transactions: EngineTransaction[];
  bills: EngineBill[];
  schedule: EnginePaycheckSchedule;
  safetyBuffer?: number;
  includeCandidateBills?: boolean;
  cautionDailyFloor?: number;

  /** ISO 8601 timestamp of the last data refresh (last Plaid sync), or null. */
  lastUpdatedAt?: string | null;
  /** ISO 8601 "now" for staleness math. Injected for deterministic tests. */
  now?: string;
  staleAfterMinutes?: number;
}

export interface RunwaySnapshot {
  status: 'ok' | 'needs_data';
  today: IsoDate;
  paydayDate: IsoDate;
  daysUntilPayday: number;

  spentToday: number;
  spentTodayHasPending: boolean;

  availableCash: number | null;
  confirmedBillsBeforePayday: number;
  predictedBillsBeforePayday: number;
  billsBeforePayday: number;

  safeToSpend: number | null;
  dailySafeSpend: number | null;

  riskLevel: RiskLevel | null;
  riskReasonKey: RiskReasonKey | null;

  /** Freshness signal — required on every shown number. */
  lastUpdatedAt: string | null;
  isStale: boolean;
}

/**
 * Build a runway snapshot. When `availableCash` is null we cannot compute a
 * trustworthy runway, so we return `status: 'needs_data'` with the parts we DO
 * know (payday, spent today) and null money figures — the UI shows an explainer
 * instead of a misleading number.
 */
export function buildRunwaySnapshot(input: SnapshotInput): RunwaySnapshot {
  const {
    today,
    availableCash,
    transactions,
    bills,
    schedule,
    safetyBuffer = 0,
    includeCandidateBills = true,
    cautionDailyFloor,
    lastUpdatedAt = null,
    now,
    staleAfterMinutes,
  } = input;

  const paydayDate = nextPaydayOnOrAfter(schedule, today);
  const daily = calculateDailySpend(transactions, today);

  const freshness = dataFreshness({
    lastUpdatedAt,
    now: now ?? lastUpdatedAt ?? today + 'T00:00:00.000Z',
    staleAfterMinutes,
  });

  // Without a balance we cannot honestly produce a safe-to-spend number.
  if (availableCash === null) {
    return {
      status: 'needs_data',
      today,
      paydayDate,
      daysUntilPayday: Math.max(0, daysBetweenForSnapshot(today, paydayDate)),
      spentToday: daily.spentToday,
      spentTodayHasPending: daily.hasPending,
      availableCash: null,
      confirmedBillsBeforePayday: 0,
      predictedBillsBeforePayday: 0,
      billsBeforePayday: 0,
      safeToSpend: null,
      dailySafeSpend: null,
      riskLevel: null,
      riskReasonKey: null,
      lastUpdatedAt,
      isStale: freshness.isStale,
    };
  }

  const runway = calculateRunway({
    availableCash,
    bills,
    paydayDate,
    today,
    safetyBuffer,
    includeCandidateBills,
  });

  const risk = assignRiskLevel({
    safeToSpend: runway.safeToSpend,
    availableCash: runway.availableCash,
    daysUntilPayday: runway.daysUntilPayday,
    dailySafeSpend: runway.dailySafeSpend,
    largestUpcomingBill: runway.largestUpcomingBill,
    cautionDailyFloor,
  });

  return {
    status: 'ok',
    today,
    paydayDate,
    daysUntilPayday: runway.daysUntilPayday,
    spentToday: daily.spentToday,
    spentTodayHasPending: daily.hasPending,
    availableCash: runway.availableCash,
    confirmedBillsBeforePayday: runway.confirmedBillsBeforePayday,
    predictedBillsBeforePayday: runway.predictedBillsBeforePayday,
    billsBeforePayday: runway.totalBillsBeforePayday,
    safeToSpend: runway.safeToSpend,
    dailySafeSpend: runway.dailySafeSpend,
    riskLevel: risk.level,
    riskReasonKey: risk.reasonKey,
    lastUpdatedAt,
    isStale: freshness.isStale,
  };
}

// Local re-implementation to avoid importing dateUtils for a single call in the
// needs_data branch (keeps the import surface tight).
function daysBetweenForSnapshot(from: IsoDate, to: IsoDate): number {
  const f = Date.parse(`${from}T00:00:00.000Z`);
  const t = Date.parse(`${to}T00:00:00.000Z`);
  return Math.round((t - f) / 86_400_000);
}
