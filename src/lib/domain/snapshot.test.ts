import { describe, it, expect } from 'vitest';
import { buildRunwaySnapshot } from './snapshot';
import type { SnapshotInput } from './snapshot';

const baseInput: SnapshotInput = {
  today: '2026-06-20',
  availableCash: 1200,
  transactions: [
    { amount: 18.5, date: '2026-06-20' }, // spent today
    { amount: 9.5, date: '2026-06-20' },
    { amount: -2400, date: '2026-06-20', category: 'Payroll' }, // income, excluded
    { amount: 60, date: '2026-06-19' }, // not today
  ],
  bills: [
    { amountEstimate: 500, nextExpectedDate: '2026-06-28', status: 'confirmed' },
    { amountEstimate: 40, nextExpectedDate: '2026-06-25', status: 'candidate' },
  ],
  schedule: { frequency: 'biweekly', lastPaycheckDate: '2026-06-05' },
  safetyBuffer: 50,
  lastUpdatedAt: '2026-06-20T08:00:00.000Z',
  now: '2026-06-20T09:00:00.000Z',
};

describe('buildRunwaySnapshot', () => {
  it('composes the full runway picture end to end', () => {
    const s = buildRunwaySnapshot(baseInput);
    expect(s.status).toBe('ok');
    expect(s.paydayDate).toBe('2026-07-03'); // next biweekly after 06-19
    expect(s.daysUntilPayday).toBe(13);
    expect(s.spentToday).toBe(28); // 18.5 + 9.5
    expect(s.availableCash).toBe(1200);
    expect(s.confirmedBillsBeforePayday).toBe(500);
    expect(s.predictedBillsBeforePayday).toBe(40);
    expect(s.billsBeforePayday).toBe(540);
    // 1200 - 540 - 50 = 610
    expect(s.safeToSpend).toBe(610);
    expect(s.riskLevel).toBe('safe');
    expect(s.lastUpdatedAt).toBe('2026-06-20T08:00:00.000Z');
    expect(s.isStale).toBe(false);
  });

  it('EDGE: returns needs_data when there is no balance yet', () => {
    const s = buildRunwaySnapshot({ ...baseInput, availableCash: null });
    expect(s.status).toBe('needs_data');
    expect(s.safeToSpend).toBeNull();
    expect(s.dailySafeSpend).toBeNull();
    expect(s.riskLevel).toBeNull();
    // We still know spent-today and payday even without a balance.
    expect(s.spentToday).toBe(28);
    expect(s.paydayDate).toBe('2026-07-03');
  });

  it('EDGE: surfaces a stale flag when the last sync is old', () => {
    const s = buildRunwaySnapshot({
      ...baseInput,
      lastUpdatedAt: '2026-06-19T00:00:00.000Z', // ~33h before "now"
      now: '2026-06-20T09:00:00.000Z',
    });
    expect(s.isStale).toBe(true);
    expect(s.status).toBe('ok'); // stale but still computable
  });

  it('EDGE: missing lastUpdatedAt is treated as stale', () => {
    const s = buildRunwaySnapshot({ ...baseInput, lastUpdatedAt: null });
    expect(s.isStale).toBe(true);
  });

  it('flags danger when bills swamp the balance', () => {
    const s = buildRunwaySnapshot({
      ...baseInput,
      availableCash: 300,
      bills: [{ amountEstimate: 800, nextExpectedDate: '2026-06-25', status: 'confirmed' }],
    });
    expect(s.riskLevel).toBe('danger');
    expect(s.safeToSpend).toBeLessThan(0);
  });
});
