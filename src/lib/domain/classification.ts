/**
 * Transaction classification: does a transaction count toward "spent today"?
 *
 * Spec references (Feature Spec §4 + Algorithm spec):
 * - "Transfers, credit card payments, payroll deposits, and account-to-account
 *    movement should not count as daily spending where identifiable."
 * - "Given a transaction is income, transfer, or card payment, when daily spend
 *    is calculated, then it is excluded unless the user marks it as spending."
 * - "Given a user marks a transaction ignored ... ignored transactions are
 *    excluded from daily spend."
 * - Pending transactions DO count (they are real spends) but are flagged
 *    elsewhere as "may change".
 *
 * Amount convention (Plaid): POSITIVE = money out (spend), NEGATIVE = money in.
 */
import type { ClassificationReason, EngineTransaction } from './types';

export interface ClassificationResult {
  countsAsSpending: boolean;
  reason: ClassificationReason;
}

/** Substrings (lowercased) that mark a transaction category as a transfer. */
const TRANSFER_HINTS = ['transfer', 'account transfer', 'internal', 'venmo', 'zelle', 'wire'];

/** Substrings that mark a category as income / payroll / deposit. */
const INCOME_HINTS = ['income', 'payroll', 'deposit', 'wages', 'salary', 'interest earned'];

/** Substrings that mark a category as a credit-card payment (not a purchase). */
const CARD_PAYMENT_HINTS = ['credit card payment', 'card payment', 'cc payment', 'loan payment'];

function categoryMatches(category: string | null | undefined, hints: string[]): boolean {
  if (!category) return false;
  const c = category.toLowerCase();
  return hints.some((h) => c.includes(h));
}

/**
 * Classify a single transaction. The order matters and encodes precedence:
 *   1. ignored            -> excluded (explicit user action)
 *   2. user override      -> wins over auto-classification
 *   3. money in (amount<=0) -> income
 *   4. transfer category  -> excluded
 *   5. card payment category -> excluded
 *   6. otherwise          -> counts as spending
 */
export function classifyTransaction(txn: EngineTransaction): ClassificationResult {
  if (txn.ignored === true) {
    return { countsAsSpending: false, reason: 'ignored' };
  }

  if (txn.isSpendingOverride === true) {
    return { countsAsSpending: true, reason: 'spending' };
  }
  if (txn.isSpendingOverride === false) {
    return { countsAsSpending: false, reason: 'user_excluded' };
  }

  // Money coming in is never daily spend.
  if (txn.amount <= 0) {
    return { countsAsSpending: false, reason: 'income' };
  }

  if (categoryMatches(txn.category, INCOME_HINTS)) {
    return { countsAsSpending: false, reason: 'income' };
  }
  if (categoryMatches(txn.category, TRANSFER_HINTS)) {
    return { countsAsSpending: false, reason: 'transfer' };
  }
  if (categoryMatches(txn.category, CARD_PAYMENT_HINTS)) {
    return { countsAsSpending: false, reason: 'card_payment' };
  }

  return { countsAsSpending: true, reason: 'spending' };
}
