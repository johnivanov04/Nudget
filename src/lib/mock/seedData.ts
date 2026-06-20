/**
 * Seed / mock data for local development and the runway demo.
 *
 * This lets the entire runway calculation be exercised end-to-end WITHOUT Plaid
 * or a database — it plugs straight into `buildRunwaySnapshot`. The scenario is a
 * realistic biweekly earner a few days before payday with a couple of bills due.
 *
 * NOTE: all values are fictional. No real banking data ever lives in fixtures.
 */
import type { SnapshotInput } from '@/lib/domain/snapshot';

/** "Today" anchor for the deterministic demo scenario. */
export const MOCK_TODAY = '2026-06-20';

export const mockSnapshotInput: SnapshotInput = {
  today: MOCK_TODAY,
  availableCash: 1842.55,
  transactions: [
    // --- today's activity ---
    { amount: 14.25, date: MOCK_TODAY, category: 'Coffee Shops', pending: false },
    { amount: 63.4, date: MOCK_TODAY, category: 'Groceries', pending: true }, // pending -> flagged
    { amount: 9.99, date: MOCK_TODAY, category: 'Streaming', pending: false },
    { amount: -2400, date: MOCK_TODAY, category: 'Payroll Deposit' }, // income, excluded
    { amount: 200, date: MOCK_TODAY, category: 'Transfer to Savings' }, // transfer, excluded
    // --- earlier in the week (not today; not in "spent today") ---
    { amount: 52.1, date: '2026-06-19', category: 'Restaurants' },
    { amount: 30.0, date: '2026-06-18', category: 'Gas' },
  ],
  bills: [
    // Rent: large confirmed bill, due before payday.
    { amountEstimate: 1200, nextExpectedDate: '2026-06-30', status: 'confirmed', confidence: 1 },
    // Phone: confirmed, due before payday.
    { amountEstimate: 85, nextExpectedDate: '2026-06-28', status: 'confirmed', confidence: 0.95 },
    // Gym: detected candidate (not yet confirmed), due before payday.
    { amountEstimate: 39.99, nextExpectedDate: '2026-06-26', status: 'candidate', confidence: 0.7 },
    // Insurance: due AFTER payday -> should not affect this runway.
    { amountEstimate: 140, nextExpectedDate: '2026-07-10', status: 'confirmed', confidence: 1 },
  ],
  schedule: {
    frequency: 'biweekly',
    lastPaycheckDate: '2026-06-05', // Friday; next is 2026-07-03
    weekendRule: 'before',
  },
  safetyBuffer: 100,
  lastUpdatedAt: '2026-06-20T13:30:00.000Z',
  now: '2026-06-20T14:00:00.000Z',
};
