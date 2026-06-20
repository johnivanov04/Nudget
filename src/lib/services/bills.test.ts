import { describe, it, expect, vi, beforeEach } from 'vitest';

const m = vi.hoisted(() => ({
  txnList: vi.fn(),
  billList: vi.fn(),
  upsertDetected: vi.fn(),
  profileGet: vi.fn(),
}));

vi.mock('@/lib/db/repositories', () => ({
  transactionsRepo: { listByUser: m.txnList },
  recurringBillsRepo: { listByUser: m.billList, upsertDetected: m.upsertDetected },
  profilesRepo: { getById: m.profileGet },
}));

import { runBillDetection } from './bills';

function txn(over: Record<string, unknown>) {
  return { merchant_name: 'X', amount: 0, date: '2026-06-01', ignored: false, ...over };
}

beforeEach(() => {
  vi.clearAllMocks();
  m.upsertDetected.mockResolvedValue(undefined);
  m.billList.mockResolvedValue([]);
});

describe('runBillDetection', () => {
  it('detects recurring charges and persists them as candidates', async () => {
    m.txnList.mockResolvedValue([
      txn({ merchant_name: 'Netflix.com', amount: 9.99, date: '2026-03-15' }),
      txn({ merchant_name: 'Netflix.com', amount: 9.99, date: '2026-04-15' }),
      txn({ merchant_name: 'Netflix.com', amount: 9.99, date: '2026-05-15' }),
      txn({ merchant_name: 'Netflix.com', amount: 9.99, date: '2026-06-15' }),
    ]);

    const result = await runBillDetection('u1', { asOf: '2026-06-20' });

    expect(result.detected).toBe(1);
    expect(result.upserted).toBe(1);
    const rows = m.upsertDetected.mock.calls[0]![0];
    expect(rows[0]).toMatchObject({
      user_id: 'u1',
      merchant_key: 'netflix',
      status: 'candidate',
      cadence: 'monthly',
      amount_estimate: 9.99,
    });
  });

  it('excludes ignored transactions from detection', async () => {
    m.txnList.mockResolvedValue([
      txn({ merchant_name: 'Gym', amount: 40, date: '2026-04-10', ignored: true }),
      txn({ merchant_name: 'Gym', amount: 40, date: '2026-05-10', ignored: true }),
      txn({ merchant_name: 'Gym', amount: 40, date: '2026-06-10', ignored: true }),
    ]);
    const result = await runBillDetection('u1', { asOf: '2026-06-20' });
    expect(result.detected).toBe(0);
    expect(m.upsertDetected).toHaveBeenCalledWith([]);
  });

  it('does not re-write merchant keys the user confirmed or rejected', async () => {
    m.txnList.mockResolvedValue([
      txn({ merchant_name: 'Netflix.com', amount: 9.99, date: '2026-03-15' }),
      txn({ merchant_name: 'Netflix.com', amount: 9.99, date: '2026-04-15' }),
      txn({ merchant_name: 'Netflix.com', amount: 9.99, date: '2026-05-15' }),
      txn({ merchant_name: 'Netflix.com', amount: 9.99, date: '2026-06-15' }),
    ]);
    // User already rejected "netflix".
    m.billList.mockResolvedValue([{ merchant_key: 'netflix', status: 'rejected' }]);

    const result = await runBillDetection('u1', { asOf: '2026-06-20' });
    expect(result.detected).toBe(1);
    expect(result.upserted).toBe(0);
    expect(m.upsertDetected).toHaveBeenCalledWith([]);
  });

  it('derives the as-of date from the user timezone when not provided', async () => {
    m.txnList.mockResolvedValue([]);
    m.profileGet.mockResolvedValue({ timezone: 'America/Los_Angeles' });
    await runBillDetection('u1', { now: new Date('2026-06-20T12:00:00.000Z') });
    expect(m.profileGet).toHaveBeenCalledWith('u1');
    // listByUser called with a from/to window anchored on the LA date (2026-06-20).
    expect(m.txnList.mock.calls[0]![1].to).toBe('2026-06-20');
  });
});
