import { describe, it, expect } from 'vitest';
import { classifyTransaction } from './classification';
import type { EngineTransaction } from './types';

const base: EngineTransaction = { amount: 20, date: '2026-06-20' };

describe('classifyTransaction', () => {
  it('counts a normal positive purchase as spending', () => {
    expect(classifyTransaction({ ...base, amount: 42.5 })).toEqual({
      countsAsSpending: true,
      reason: 'spending',
    });
  });

  it('excludes money coming in (negative amount = income)', () => {
    expect(classifyTransaction({ ...base, amount: -1500 })).toEqual({
      countsAsSpending: false,
      reason: 'income',
    });
  });

  it('excludes income/payroll by category even if positive', () => {
    const r = classifyTransaction({ ...base, amount: 100, category: 'Payroll Deposit' });
    expect(r.countsAsSpending).toBe(false);
    expect(r.reason).toBe('income');
  });

  it('excludes transfers', () => {
    expect(classifyTransaction({ ...base, category: 'Transfer' }).reason).toBe('transfer');
    expect(classifyTransaction({ ...base, category: 'Zelle payment' }).reason).toBe('transfer');
  });

  it('excludes credit card payments', () => {
    expect(classifyTransaction({ ...base, category: 'Credit Card Payment' }).reason).toBe(
      'card_payment',
    );
  });

  it('respects an explicit ignore (highest precedence)', () => {
    const r = classifyTransaction({ ...base, amount: 30, ignored: true });
    expect(r).toEqual({ countsAsSpending: false, reason: 'ignored' });
  });

  it('lets a user override force-include an otherwise-excluded transaction', () => {
    // A "transfer" the user insists is real spending.
    const r = classifyTransaction({
      ...base,
      category: 'Transfer',
      isSpendingOverride: true,
    });
    expect(r).toEqual({ countsAsSpending: true, reason: 'spending' });
  });

  it('lets a user override force-exclude a normal purchase', () => {
    const r = classifyTransaction({ ...base, amount: 80, isSpendingOverride: false });
    expect(r).toEqual({ countsAsSpending: false, reason: 'user_excluded' });
  });

  it('ignore beats user override', () => {
    const r = classifyTransaction({
      ...base,
      ignored: true,
      isSpendingOverride: true,
    });
    expect(r.reason).toBe('ignored');
  });

  it('counts pending purchases (they are real spends)', () => {
    expect(classifyTransaction({ ...base, pending: true }).countsAsSpending).toBe(true);
  });
});
