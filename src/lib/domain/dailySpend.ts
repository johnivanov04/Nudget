/**
 * Daily spend calculation — the "spent today" number.
 *
 * Sums the amounts of transactions dated on `today` that the classifier counts
 * as spending. Pending spends are included (they are real) but surfaced via a
 * `hasPending` flag so the UI can say "may change".
 */
import { classifyTransaction } from './classification';
import { roundCents } from './money';
import type { EngineTransaction } from './types';
import type { IsoDate } from './dateUtils';

export interface DailySpendResult {
  date: IsoDate;
  spentToday: number;
  includedCount: number;
  excludedCount: number;
  hasPending: boolean;
}

export function calculateDailySpend(
  transactions: EngineTransaction[],
  today: IsoDate,
): DailySpendResult {
  let spent = 0;
  let included = 0;
  let excluded = 0;
  let hasPending = false;

  for (const txn of transactions) {
    if (txn.date !== today) continue;
    const { countsAsSpending } = classifyTransaction(txn);
    if (countsAsSpending) {
      spent += txn.amount;
      included += 1;
      if (txn.pending === true) hasPending = true;
    } else {
      excluded += 1;
    }
  }

  return {
    date: today,
    spentToday: roundCents(spent),
    includedCount: included,
    excludedCount: excluded,
    hasPending,
  };
}
