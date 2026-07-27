import { getSupabaseAdmin } from '@/lib/supabase/admin';
import type { AccountRow } from '../types';

/** accounts data access. */
export const accountsRepo = {
  async listByUser(userId: string): Promise<AccountRow[]> {
    const { data, error } = await getSupabaseAdmin()
      .from('accounts')
      .select('*')
      .eq('user_id', userId);
    if (error) throw error;
    return (data as AccountRow[]) ?? [];
  },

  /**
   * Refresh stored balances for a set of accounts (keyed by plaid_account_id).
   * Only touches balance columns, so account-inclusion toggles are preserved.
   */
  async updateBalances(
    balances: Array<{
      plaidAccountId: string;
      available: number | null;
      current: number | null;
    }>,
  ): Promise<void> {
    const admin = getSupabaseAdmin();
    for (const b of balances) {
      const { error } = await admin
        .from('accounts')
        .update({ available_balance: b.available, current_balance: b.current })
        .eq('plaid_account_id', b.plaidAccountId);
      if (error) throw error;
    }
  },

  /** Upsert accounts returned by a Plaid sync, keyed by plaid_account_id. */
  async upsertMany(
    rows: Array<
      Partial<AccountRow> & Pick<AccountRow, 'user_id' | 'plaid_item_id' | 'plaid_account_id'>
    >,
  ): Promise<void> {
    if (rows.length === 0) return;
    const { error } = await getSupabaseAdmin()
      .from('accounts')
      .upsert(rows, { onConflict: 'plaid_account_id' });
    if (error) throw error;
  },

  /**
   * Ownership-scoped toggle of whether an account's cash counts toward the
   * runway. Returns true if a row was updated, false if no such account exists
   * for this user (caller maps that to 404).
   */
  async setIncludedInRunway(
    userId: string,
    accountId: string,
    included: boolean,
  ): Promise<boolean> {
    const { data, error } = await getSupabaseAdmin()
      .from('accounts')
      .update({ included_in_runway: included })
      .eq('id', accountId)
      .eq('user_id', userId) // ownership guard
      .select('id');
    if (error) throw error;
    return Array.isArray(data) && data.length > 0;
  },
};
