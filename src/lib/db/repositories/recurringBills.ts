import { getSupabaseAdmin } from '@/lib/supabase/admin';
import type { BillStatus } from '@/lib/domain/types';
import type { RecurringBillRow } from '../types';

/** recurring_bills data access. */
export const recurringBillsRepo = {
  async listByUser(userId: string, statuses?: BillStatus[]): Promise<RecurringBillRow[]> {
    let q = getSupabaseAdmin().from('recurring_bills').select('*').eq('user_id', userId);
    if (statuses && statuses.length > 0) q = q.in('status', statuses);
    const { data, error } = await q;
    if (error) throw error;
    return (data as RecurringBillRow[]) ?? [];
  },

  async upsertMany(
    rows: Array<Partial<RecurringBillRow> & Pick<RecurringBillRow, 'user_id'>>,
  ): Promise<void> {
    if (rows.length === 0) return;
    const { error } = await getSupabaseAdmin().from('recurring_bills').upsert(rows);
    if (error) throw error;
  },

  /**
   * Idempotent detection upsert keyed by (user_id, merchant_key). Re-running
   * detection updates the same candidate rather than duplicating it. The caller
   * must exclude merchant keys the user has already confirmed/rejected so those
   * decisions are not overwritten.
   */
  async upsertDetected(
    rows: Array<Partial<RecurringBillRow> & Pick<RecurringBillRow, 'user_id' | 'merchant_key'>>,
  ): Promise<void> {
    if (rows.length === 0) return;
    const { error } = await getSupabaseAdmin()
      .from('recurring_bills')
      .upsert(rows, { onConflict: 'user_id,merchant_key' });
    if (error) throw error;
  },

  /** Confirm/reject/edit a bill. Confirmed user data outranks guesses. */
  async update(
    userId: string,
    billId: string,
    patch: Partial<
      Pick<RecurringBillRow, 'status' | 'amount_estimate' | 'next_expected_date' | 'cadence'>
    >,
  ): Promise<RecurringBillRow> {
    const { data, error } = await getSupabaseAdmin()
      .from('recurring_bills')
      .update(patch)
      .eq('id', billId)
      .eq('user_id', userId) // ownership guard
      .select('*')
      .single();
    if (error) throw error;
    return data as RecurringBillRow;
  },
};
