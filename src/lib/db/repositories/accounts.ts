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

  async setIncludedInRunway(accountId: string, included: boolean): Promise<void> {
    const { error } = await getSupabaseAdmin()
      .from('accounts')
      .update({ included_in_runway: included })
      .eq('id', accountId);
    if (error) throw error;
  },
};
