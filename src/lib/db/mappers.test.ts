import { describe, it, expect } from 'vitest';
import {
  billRowToEngine,
  scheduleRowToEngine,
  sumAvailableCash,
  transactionRowToEngine,
} from './mappers';
import type { AccountRow, PaycheckScheduleRow, RecurringBillRow, TransactionRow } from './types';

function accountRow(p: Partial<AccountRow>): AccountRow {
  return {
    id: 'a',
    user_id: 'u',
    plaid_item_id: 'pi',
    plaid_account_id: 'pa',
    name: 'Checking',
    type: 'depository',
    subtype: 'checking',
    mask: '0000',
    available_balance: 100,
    current_balance: 100,
    included_in_runway: true,
    created_at: '',
    updated_at: '',
    ...p,
  };
}

describe('db mappers', () => {
  it('maps a transaction row to the engine shape', () => {
    const row = {
      amount: 25,
      date: '2026-06-20',
      category: 'Coffee',
      pending: true,
      ignored: false,
      is_spending: null,
    } as TransactionRow;
    expect(transactionRowToEngine(row)).toEqual({
      amount: 25,
      date: '2026-06-20',
      category: 'Coffee',
      pending: true,
      ignored: false,
      isSpendingOverride: null,
    });
  });

  it('drops bills without an expected date', () => {
    const row = {
      amount_estimate: 50,
      next_expected_date: null,
      status: 'candidate',
    } as RecurringBillRow;
    expect(billRowToEngine(row)).toBeNull();
  });

  it('maps semimonthly anchors from custom_rules', () => {
    const row: PaycheckScheduleRow = {
      id: 'sched',
      user_id: 'u',
      frequency: 'semimonthly',
      last_paycheck_date: '2026-05-31',
      next_paycheck_date: null,
      weekend_rule: 'before',
      custom_rules: { semimonthlyDays: [15, 31] },
      created_at: '',
      updated_at: '',
    };
    const engine = scheduleRowToEngine(row);
    expect(engine.semimonthlyDays).toEqual([15, 31]);
    expect(engine.weekendRule).toBe('before');
  });

  it('sums only runway-included depository balances', () => {
    const accounts = [
      accountRow({ available_balance: 500, type: 'depository' }),
      accountRow({ available_balance: 200, included_in_runway: false }), // excluded
      accountRow({ available_balance: 999, type: 'credit' }), // credit -> skip
    ];
    expect(sumAvailableCash(accounts)).toBe(500);
  });

  it('returns null when no usable balance exists', () => {
    const accounts = [accountRow({ available_balance: null, current_balance: null })];
    expect(sumAvailableCash(accounts)).toBeNull();
  });
});
