import type { IsoDate } from './dateUtils';

/** How often the user is paid. Drives the runway horizon. */
export type PaydayFrequency = 'weekly' | 'biweekly' | 'semimonthly' | 'monthly' | 'custom';

/**
 * What to do when a computed payday lands on a weekend.
 * - 'none'   : leave it (employer pays on the weekend / it does not matter)
 * - 'before' : assume the deposit arrives the Friday before
 * - 'after'  : assume the deposit arrives the Monday after
 */
export type WeekendRule = 'none' | 'before' | 'after';

/** Lifecycle of a detected/edited recurring bill. */
export type BillStatus = 'candidate' | 'confirmed' | 'rejected' | 'archived';

/** Glanceable risk state shown in the app/widget. */
export type RiskLevel = 'safe' | 'caution' | 'danger';

/** Why a transaction was or was not counted toward daily spend. */
export type ClassificationReason =
  | 'spending'
  | 'income'
  | 'transfer'
  | 'card_payment'
  | 'ignored'
  | 'user_excluded';

/**
 * Minimal transaction shape the pure engine needs. This intentionally avoids
 * any persistence/Plaid concerns — repositories map DB rows into this.
 *
 * Amount convention (matches Plaid): POSITIVE = money out of the account
 * (a purchase/debit), NEGATIVE = money in (income/refund/deposit).
 */
export interface EngineTransaction {
  amount: number;
  date: IsoDate;
  /** Plaid personal-finance-category primary, or a coarse category label. */
  category?: string | null;
  pending?: boolean;
  /** User pressed "ignore" — always excluded from spend. */
  ignored?: boolean;
  /**
   * Explicit user override of the auto-classification:
   * - true  => force-count as spending
   * - false => force-exclude
   * - null/undefined => let the classifier decide
   */
  isSpendingOverride?: boolean | null;
}

/** A bill the engine should subtract from the runway. */
export interface EngineBill {
  amountEstimate: number;
  nextExpectedDate: IsoDate;
  status: BillStatus;
  confidence?: number | null;
}

/** The user's pay schedule, in the shape the payday calculator consumes. */
export interface EnginePaycheckSchedule {
  frequency: PaydayFrequency;
  /** The most recent known payday. Anchors weekly/biweekly/monthly cadence. */
  lastPaycheckDate: IsoDate;
  /**
   * Days-of-month for 'semimonthly'. Default [15, 31] where 31 means "last day
   * of the month" (clamped per month). Ignored for other frequencies.
   */
  semimonthlyDays?: [number, number];
  /**
   * A manual override of the next payday for the current cycle. Required for
   * 'custom'; optional for everything else (user correcting an off-by-one).
   */
  manualNextPaycheckDate?: IsoDate | null;
  weekendRule?: WeekendRule;
}
