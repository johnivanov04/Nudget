/**
 * Risk-level assignment.
 *
 * Spec (Feature Spec business rules):
 *   "Safe if safe_to_spend >= daily_safe_spend threshold and no major bills
 *    imminent; caution if buffer is thin; danger if safe_to_spend <= 0 or
 *    upcoming bill exceeds available cash."
 *
 * We make the thresholds explicit and injectable so the rule is deterministic
 * and unit-testable, and so product can tune them without code spelunking.
 * The output also carries a `reasonKey` that maps to non-shaming copy (the copy
 * itself lives in the presentation layer / nudge templates).
 */
import type { RiskLevel } from './types';

export interface RiskInput {
  safeToSpend: number;
  availableCash: number;
  daysUntilPayday: number;
  dailySafeSpend: number;
  /** Largest single bill due before payday. */
  largestUpcomingBill?: number;
  /** If daily-safe-spend falls below this, we flag caution. Default $15/day. */
  cautionDailyFloor?: number;
}

export type RiskReasonKey =
  | 'negative_runway' // safe-to-spend <= 0
  | 'bill_exceeds_cash' // an upcoming bill is larger than available cash
  | 'thin_buffer' // positive but little daily room
  | 'on_track'; // safe

export interface RiskResult {
  level: RiskLevel;
  reasonKey: RiskReasonKey;
}

export const DEFAULT_CAUTION_DAILY_FLOOR = 15;

export function assignRiskLevel(input: RiskInput): RiskResult {
  const {
    safeToSpend,
    availableCash,
    largestUpcomingBill = 0,
    dailySafeSpend,
    cautionDailyFloor = DEFAULT_CAUTION_DAILY_FLOOR,
  } = input;

  // Danger: out of room, or a single bill is bigger than the cash on hand.
  if (safeToSpend <= 0) {
    return { level: 'danger', reasonKey: 'negative_runway' };
  }
  if (largestUpcomingBill > availableCash) {
    return { level: 'danger', reasonKey: 'bill_exceeds_cash' };
  }

  // Caution: positive runway but the daily room is thin.
  if (dailySafeSpend < cautionDailyFloor) {
    return { level: 'caution', reasonKey: 'thin_buffer' };
  }

  return { level: 'safe', reasonKey: 'on_track' };
}
