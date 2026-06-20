/**
 * Safe-to-spend runway formula — the core of Nudget.
 *
 * Spec (Feature Spec §6.4 algorithm):
 *   safe_to_spend = available_cash
 *                 - confirmed_bills_before_payday
 *                 - predicted_bills_before_payday
 *                 - safety_buffer
 *   daily_safe_spend = max(safe_to_spend, 0) / max(days_until_payday, 1)
 *
 * Business rules applied here:
 * - "Bills before payday" = bills due in the window [today, payday). A bill due
 *   exactly on payday is treated as arriving with the paycheck, so it is NOT in
 *   the pre-payday window. (Pinned by tests.)
 * - Confirmed bills are summed separately from candidate ("predicted") bills.
 * - rejected/archived bills are ignored entirely.
 * - Candidate bills can be excluded via `includeCandidateBills: false`.
 */
import { isBefore, isOnOrBefore, daysBetween, type IsoDate } from './dateUtils';
import { roundCents } from './money';
import type { EngineBill } from './types';

export interface RunwayInput {
  availableCash: number;
  bills: EngineBill[];
  /** The next payday (already weekend-adjusted) as 'YYYY-MM-DD'. */
  paydayDate: IsoDate;
  today: IsoDate;
  safetyBuffer?: number;
  /** Default true: be conservative and include unconfirmed candidate bills. */
  includeCandidateBills?: boolean;
}

export interface RunwayResult {
  availableCash: number;
  confirmedBillsBeforePayday: number;
  predictedBillsBeforePayday: number;
  totalBillsBeforePayday: number;
  /** Largest single bill due before payday — feeds the danger rule. */
  largestUpcomingBill: number;
  safetyBuffer: number;
  /** Can be negative — that is a valid, important signal. */
  safeToSpend: number;
  daysUntilPayday: number;
  dailySafeSpend: number;
}

/** Is a bill due within [today, payday)? */
function isBeforePayday(due: IsoDate, today: IsoDate, payday: IsoDate): boolean {
  return isOnOrBefore(today, due) && isBefore(due, payday);
}

export function calculateRunway(input: RunwayInput): RunwayResult {
  const {
    availableCash,
    bills,
    paydayDate,
    today,
    safetyBuffer = 0,
    includeCandidateBills = true,
  } = input;

  if (!Number.isFinite(availableCash)) {
    throw new TypeError('availableCash must be a finite number');
  }
  if (safetyBuffer < 0) {
    throw new RangeError('safetyBuffer must be >= 0');
  }

  let confirmed = 0;
  let predicted = 0;
  let largest = 0;

  for (const bill of bills) {
    if (bill.status === 'rejected' || bill.status === 'archived') continue;
    if (!isBeforePayday(bill.nextExpectedDate, today, paydayDate)) continue;

    if (bill.status === 'confirmed') {
      confirmed += bill.amountEstimate;
    } else if (bill.status === 'candidate') {
      if (!includeCandidateBills) continue;
      predicted += bill.amountEstimate;
    }
    if (bill.amountEstimate > largest) largest = bill.amountEstimate;
  }

  confirmed = roundCents(confirmed);
  predicted = roundCents(predicted);
  const totalBills = roundCents(confirmed + predicted);
  const safeToSpend = roundCents(availableCash - confirmed - predicted - safetyBuffer);

  const daysUntilPayday = Math.max(0, daysBetween(today, paydayDate));
  const dailySafeSpend = roundCents(Math.max(safeToSpend, 0) / Math.max(daysUntilPayday, 1));

  return {
    availableCash: roundCents(availableCash),
    confirmedBillsBeforePayday: confirmed,
    predictedBillsBeforePayday: predicted,
    totalBillsBeforePayday: totalBills,
    largestUpcomingBill: roundCents(largest),
    safetyBuffer: roundCents(safetyBuffer),
    safeToSpend,
    daysUntilPayday,
    dailySafeSpend,
  };
}
