/**
 * Pure mappers from database rows into the shapes the runway engine consumes.
 *
 * These are deliberately pure (no I/O) so they can be unit-tested and so the
 * engine never imports persistence types. Repositories fetch rows; routes map
 * them with these helpers, then call the engine.
 */
import type {
  EngineBill,
  EnginePaycheckSchedule,
  EngineTransaction,
  PaydayFrequency,
} from '@/lib/domain/types';
import type { AccountRow, PaycheckScheduleRow, RecurringBillRow, TransactionRow } from './types';

export function transactionRowToEngine(row: TransactionRow): EngineTransaction {
  return {
    amount: row.amount,
    date: row.date,
    category: row.category,
    pending: row.pending,
    ignored: row.ignored,
    isSpendingOverride: row.is_spending,
  };
}

export function billRowToEngine(row: RecurringBillRow): EngineBill | null {
  // A bill with no expected date cannot be placed in the runway window.
  if (!row.next_expected_date) return null;
  return {
    amountEstimate: row.amount_estimate,
    nextExpectedDate: row.next_expected_date,
    status: row.status,
    confidence: row.confidence,
  };
}

const SUPPORTED_FREQUENCIES: PaydayFrequency[] = [
  'weekly',
  'biweekly',
  'semimonthly',
  'monthly',
  'custom',
];

export function scheduleRowToEngine(row: PaycheckScheduleRow): EnginePaycheckSchedule {
  if (!SUPPORTED_FREQUENCIES.includes(row.frequency)) {
    throw new Error(`Unsupported paycheck frequency: ${row.frequency}`);
  }
  const custom = row.custom_rules ?? {};
  const semimonthlyDays = Array.isArray(custom.semimonthlyDays)
    ? (custom.semimonthlyDays as [number, number])
    : undefined;

  // last_paycheck_date anchors cadence; custom schedules rely on next_paycheck_date.
  const lastPaycheckDate = row.last_paycheck_date ?? row.next_paycheck_date;
  if (!lastPaycheckDate) {
    throw new Error('Paycheck schedule is missing both last and next paycheck dates');
  }

  return {
    frequency: row.frequency,
    lastPaycheckDate,
    manualNextPaycheckDate: row.next_paycheck_date,
    weekendRule: row.weekend_rule,
    ...(semimonthlyDays ? { semimonthlyDays } : {}),
  };
}

/**
 * Sum spendable cash across runway-included accounts. Prefers available balance
 * (what can actually be spent) and falls back to current balance. Returns null
 * when no included account has a usable balance (drives a `needs_data` snapshot).
 */
export function sumAvailableCash(accounts: AccountRow[]): number | null {
  const included = accounts.filter((a) => a.included_in_runway);
  let total = 0;
  let sawBalance = false;
  for (const a of included) {
    const balance = a.available_balance ?? a.current_balance;
    if (balance === null || balance === undefined) continue;
    // Credit accounts carry a balance owed, not spendable cash — skip them here.
    if (a.type === 'credit' || a.type === 'loan') continue;
    total += balance;
    sawBalance = true;
  }
  return sawBalance ? total : null;
}
