/**
 * Pure mappers from Plaid API shapes into our DB-insert shapes.
 *
 * Kept pure (no I/O) so they are unit-tested in isolation. The Plaid amount
 * convention (positive = money out of the account) already matches our
 * `transactions.amount` convention, so amounts pass through unchanged.
 */
import type { AccountRow, AccountType, TransactionRow } from '@/lib/db/types';

/** Minimal Plaid account shape we consume from `/accounts/get`. */
export interface PlaidAccount {
  account_id: string;
  name?: string | null;
  official_name?: string | null;
  mask?: string | null;
  type?: string | null;
  subtype?: string | null;
  balances?: { available?: number | null; current?: number | null } | null;
}

/** Minimal Plaid transaction shape we consume from `/transactions/sync`. */
export interface PlaidSyncTransaction {
  transaction_id: string;
  account_id: string;
  name?: string | null;
  merchant_name?: string | null;
  amount: number;
  date: string;
  pending?: boolean | null;
  personal_finance_category?: { primary?: string | null } | null;
  category?: string[] | null;
}

export type AccountInsert = Partial<AccountRow> &
  Pick<AccountRow, 'user_id' | 'plaid_item_id' | 'plaid_account_id'>;

export type TransactionInsert = Partial<TransactionRow> &
  Pick<TransactionRow, 'user_id' | 'account_id' | 'plaid_transaction_id'>;

const ACCOUNT_TYPES: AccountType[] = ['depository', 'credit', 'loan', 'investment', 'other'];

export function normalizeAccountType(type: string | null | undefined): AccountType {
  if (type && (ACCOUNT_TYPES as string[]).includes(type)) return type as AccountType;
  return 'other';
}

export function plaidAccountToRow(
  userId: string,
  plaidItemRowId: string,
  account: PlaidAccount,
): AccountInsert {
  return {
    user_id: userId,
    plaid_item_id: plaidItemRowId,
    plaid_account_id: account.account_id,
    name: account.name ?? account.official_name ?? null,
    type: normalizeAccountType(account.type),
    subtype: account.subtype ?? null,
    mask: account.mask ?? null,
    available_balance: account.balances?.available ?? null,
    current_balance: account.balances?.current ?? null,
  };
}

/**
 * Map a Plaid transaction to a DB insert, resolving the internal account id.
 * Returns null when the transaction's account is not (yet) linked locally so the
 * caller can skip + count it rather than violate the FK.
 */
export function plaidTransactionToRow(
  userId: string,
  accountIdByPlaidId: Map<string, string>,
  txn: PlaidSyncTransaction,
): TransactionInsert | null {
  const accountId = accountIdByPlaidId.get(txn.account_id);
  if (!accountId) return null;

  const category = txn.personal_finance_category?.primary ?? txn.category?.[0] ?? null;
  return {
    user_id: userId,
    account_id: accountId,
    plaid_transaction_id: txn.transaction_id,
    merchant_name: txn.merchant_name ?? txn.name ?? null,
    amount: txn.amount,
    date: txn.date,
    category,
    pending: txn.pending ?? false,
  };
}
