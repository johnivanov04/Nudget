import { getSupabaseAdmin } from '@/lib/supabase/admin';
import type { TransactionRow } from '../types';

/** transactions data access. */
export const transactionsRepo = {
  async listByUser(
    userId: string,
    opts: { from?: string; to?: string; limit?: number; offset?: number } = {},
  ): Promise<TransactionRow[]> {
    let q = getSupabaseAdmin()
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false });
    if (opts.from) q = q.gte('date', opts.from);
    if (opts.to) q = q.lte('date', opts.to);
    const limit = opts.limit ?? 100;
    const offset = opts.offset ?? 0;
    q = q.range(offset, offset + limit - 1);
    const { data, error } = await q;
    if (error) throw error;
    return (data as TransactionRow[]) ?? [];
  },

  /** Upsert added/modified transactions from a Plaid sync. */
  async upsertMany(
    rows: Array<
      Partial<TransactionRow> &
        Pick<TransactionRow, 'user_id' | 'account_id' | 'plaid_transaction_id'>
    >,
  ): Promise<void> {
    if (rows.length === 0) return;
    const { error } = await getSupabaseAdmin()
      .from('transactions')
      .upsert(rows, { onConflict: 'plaid_transaction_id' });
    if (error) throw error;
  },

  /** Remove transactions Plaid reported as deleted. */
  async deleteByPlaidIds(plaidTransactionIds: string[]): Promise<void> {
    if (plaidTransactionIds.length === 0) return;
    const { error } = await getSupabaseAdmin()
      .from('transactions')
      .delete()
      .in('plaid_transaction_id', plaidTransactionIds);
    if (error) throw error;
  },

  async setIgnored(userId: string, transactionId: string, ignored: boolean): Promise<void> {
    const { error } = await getSupabaseAdmin()
      .from('transactions')
      .update({ ignored })
      .eq('id', transactionId)
      .eq('user_id', userId); // ownership guard
    if (error) throw error;
  },
};
