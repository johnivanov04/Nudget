import { describe, it, expect } from 'vitest';
import { calculateDailySpend } from './dailySpend';
import type { EngineTransaction } from './types';

const TODAY = '2026-06-20';

describe('calculateDailySpend', () => {
  it('sums only today’s spending transactions', () => {
    const txns: EngineTransaction[] = [
      { amount: 12.5, date: TODAY }, // counts
      { amount: 7.25, date: TODAY }, // counts
      { amount: 100, date: '2026-06-19' }, // wrong day
      { amount: -2000, date: TODAY, category: 'Payroll' }, // income excluded
      { amount: 50, date: TODAY, category: 'Transfer' }, // transfer excluded
    ];
    const r = calculateDailySpend(txns, TODAY);
    expect(r.spentToday).toBe(19.75);
    expect(r.includedCount).toBe(2);
    expect(r.excludedCount).toBe(2); // income + transfer on today; wrong-day not counted in either
  });

  it('returns zero when nothing was spent today', () => {
    const r = calculateDailySpend([{ amount: 30, date: '2026-06-19' }], TODAY);
    expect(r.spentToday).toBe(0);
    expect(r.includedCount).toBe(0);
  });

  it('flags pending when an included transaction is pending', () => {
    const r = calculateDailySpend(
      [
        { amount: 10, date: TODAY, pending: true },
        { amount: 5, date: TODAY },
      ],
      TODAY,
    );
    expect(r.spentToday).toBe(15);
    expect(r.hasPending).toBe(true);
  });

  it('excludes ignored transactions from the total', () => {
    const r = calculateDailySpend(
      [
        { amount: 40, date: TODAY, ignored: true },
        { amount: 10, date: TODAY },
      ],
      TODAY,
    );
    expect(r.spentToday).toBe(10);
  });

  it('rounds to cents without float drift', () => {
    const r = calculateDailySpend(
      [
        { amount: 0.1, date: TODAY },
        { amount: 0.2, date: TODAY },
      ],
      TODAY,
    );
    expect(r.spentToday).toBe(0.3);
  });
});
