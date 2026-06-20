import { describe, it, expect } from 'vitest';
import {
  normalizeAccountType,
  plaidAccountToRow,
  plaidTransactionToRow,
  type PlaidAccount,
  type PlaidSyncTransaction,
} from './mappers';

describe('plaid mappers', () => {
  describe('normalizeAccountType', () => {
    it('passes through known types and falls back to other', () => {
      expect(normalizeAccountType('depository')).toBe('depository');
      expect(normalizeAccountType('credit')).toBe('credit');
      expect(normalizeAccountType('crypto')).toBe('other');
      expect(normalizeAccountType(null)).toBe('other');
    });
  });

  describe('plaidAccountToRow', () => {
    it('maps balances, mask, and falls back to official_name', () => {
      const acct: PlaidAccount = {
        account_id: 'plaid-acct-1',
        name: null,
        official_name: 'Premium Checking',
        mask: '0000',
        type: 'depository',
        subtype: 'checking',
        balances: { available: 500.25, current: 600 },
      };
      expect(plaidAccountToRow('u1', 'item1', acct)).toEqual({
        user_id: 'u1',
        plaid_item_id: 'item1',
        plaid_account_id: 'plaid-acct-1',
        name: 'Premium Checking',
        type: 'depository',
        subtype: 'checking',
        mask: '0000',
        available_balance: 500.25,
        current_balance: 600,
      });
    });
  });

  describe('plaidTransactionToRow', () => {
    const accountMap = new Map([['plaid-acct-1', 'internal-acct-1']]);

    it('maps a transaction and resolves the internal account id', () => {
      const txn: PlaidSyncTransaction = {
        transaction_id: 'txn-1',
        account_id: 'plaid-acct-1',
        name: 'SQ *BLUE BOTTLE',
        merchant_name: 'Blue Bottle',
        amount: 14.25, // Plaid: positive = money out (matches our convention)
        date: '2026-06-20',
        pending: true,
        personal_finance_category: { primary: 'FOOD_AND_DRINK' },
      };
      expect(plaidTransactionToRow('u1', accountMap, txn)).toEqual({
        user_id: 'u1',
        account_id: 'internal-acct-1',
        plaid_transaction_id: 'txn-1',
        merchant_name: 'Blue Bottle',
        amount: 14.25,
        date: '2026-06-20',
        category: 'FOOD_AND_DRINK',
        pending: true,
      });
    });

    it('falls back to name and legacy category', () => {
      const txn: PlaidSyncTransaction = {
        transaction_id: 'txn-2',
        account_id: 'plaid-acct-1',
        name: 'Unknown Merchant',
        merchant_name: null,
        amount: 9.99,
        date: '2026-06-20',
        category: ['Service', 'Subscription'],
      };
      const row = plaidTransactionToRow('u1', accountMap, txn)!;
      expect(row.merchant_name).toBe('Unknown Merchant');
      expect(row.category).toBe('Service');
      expect(row.pending).toBe(false);
    });

    it('returns null when the account is not linked locally', () => {
      const txn: PlaidSyncTransaction = {
        transaction_id: 'txn-3',
        account_id: 'unknown-acct',
        amount: 5,
        date: '2026-06-20',
      };
      expect(plaidTransactionToRow('u1', accountMap, txn)).toBeNull();
    });
  });
});
