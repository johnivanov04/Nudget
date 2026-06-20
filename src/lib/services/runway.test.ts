import { describe, it, expect, vi, beforeEach } from 'vitest';

const m = vi.hoisted(() => ({
  profileGet: vi.fn(),
  scheduleGet: vi.fn(),
  accountsList: vi.fn(),
  txnList: vi.fn(),
  billsList: vi.fn(),
  itemsList: vi.fn(),
  snapshotInsert: vi.fn(),
}));

vi.mock('@/lib/db/repositories', () => ({
  profilesRepo: { getById: m.profileGet },
  paycheckSchedulesRepo: { getByUser: m.scheduleGet },
  accountsRepo: { listByUser: m.accountsList },
  transactionsRepo: { listByUser: m.txnList },
  recurringBillsRepo: { listByUser: m.billsList },
  plaidItemsRepo: { listByUser: m.itemsList },
  runwaySnapshotsRepo: { insert: m.snapshotInsert },
}));

import { recomputeRunwayForUser } from './runway';

const NOW = new Date('2026-06-20T17:00:00.000Z'); // 2026-06-20 in LA

beforeEach(() => {
  vi.clearAllMocks();
  m.profileGet.mockResolvedValue({ timezone: 'America/Los_Angeles' });
  m.accountsList.mockResolvedValue([]);
  m.txnList.mockResolvedValue([]);
  m.billsList.mockResolvedValue([]);
  m.itemsList.mockResolvedValue([]);
  m.snapshotInsert.mockImplementation(async (r) => ({ id: 'snap1', generated_at: '', ...r }));
});

describe('recomputeRunwayForUser', () => {
  it('returns needs_schedule when the user has no paycheck schedule', async () => {
    m.scheduleGet.mockResolvedValue(null);
    const result = await recomputeRunwayForUser('u1', NOW);
    expect(result.status).toBe('needs_schedule');
    expect(m.snapshotInsert).not.toHaveBeenCalled();
  });

  it('computes + persists a snapshot from DB data', async () => {
    m.scheduleGet.mockResolvedValue({
      frequency: 'biweekly',
      last_paycheck_date: '2026-06-05',
      next_paycheck_date: '2026-07-03',
      weekend_rule: 'none',
      custom_rules: null,
    });
    m.accountsList.mockResolvedValue([
      {
        id: 'a1',
        plaid_account_id: 'pa1',
        type: 'depository',
        available_balance: 1200,
        current_balance: 1200,
        included_in_runway: true,
      },
    ]);
    m.txnList.mockResolvedValue([
      {
        amount: 18.5,
        date: '2026-06-20',
        category: null,
        pending: false,
        ignored: false,
        is_spending: null,
      },
      {
        amount: 9.5,
        date: '2026-06-20',
        category: null,
        pending: false,
        ignored: false,
        is_spending: null,
      },
    ]);
    m.billsList.mockResolvedValue([
      {
        amount_estimate: 500,
        next_expected_date: '2026-06-28',
        status: 'confirmed',
        confidence: 1,
      },
    ]);
    m.itemsList.mockResolvedValue([{ last_sync_at: '2026-06-20T16:00:00.000Z' }]);

    const result = await recomputeRunwayForUser('u1', NOW);

    expect(result.status).toBe('ok');
    expect(result.snapshot!.spentToday).toBe(28);
    expect(result.snapshot!.safeToSpend).toBe(700); // 1200 - 500
    expect(result.snapshot!.paydayDate).toBe('2026-07-03');
    // Persisted with the computed numbers.
    expect(m.snapshotInsert.mock.calls[0]![0]).toMatchObject({
      user_id: 'u1',
      safe_to_spend: 700,
      spent_today: 28,
      risk_level: result.snapshot!.riskLevel,
    });
  });

  it('persists a needs_data snapshot when there is no usable balance', async () => {
    m.scheduleGet.mockResolvedValue({
      frequency: 'weekly',
      last_paycheck_date: '2026-06-19',
      next_paycheck_date: null,
      weekend_rule: 'none',
      custom_rules: null,
    });
    // No accounts -> availableCash null.
    const result = await recomputeRunwayForUser('u1', NOW);
    expect(result.status).toBe('needs_data');
    expect(result.snapshot!.safeToSpend).toBeNull();
    expect(m.snapshotInsert).toHaveBeenCalledOnce();
  });
});
