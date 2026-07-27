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

  /**
   * Create a user-entered bill. Stored as `confirmed` (the user is certain) with
   * no merchant_key/confidence so detection never touches it. It flows into the
   * runway like any confirmed bill.
   */
  async createManual(params: {
    userId: string;
    merchantName: string;
    amountEstimate: number;
    nextExpectedDate: string;
    cadence: string;
  }): Promise<RecurringBillRow> {
    const { data, error } = await getSupabaseAdmin()
      .from('recurring_bills')
      .insert({
        user_id: params.userId,
        merchant_name: params.merchantName,
        amount_estimate: params.amountEstimate,
        next_expected_date: params.nextExpectedDate,
        cadence: params.cadence,
        merchant_key: null,
        confidence: null,
        status: 'confirmed',
      })
      .select('*')
      .single();
    if (error) throw error;
    return data as RecurringBillRow;
  },

  /** Delete a bill the caller owns. Returns true if a row was removed. */
  async deleteOwned(userId: string, billId: string): Promise<boolean> {
    const { data, error } = await getSupabaseAdmin()
      .from('recurring_bills')
      .delete()
      .eq('id', billId)
      .eq('user_id', userId) // ownership guard
      .select('id');
    if (error) throw error;
    return Array.isArray(data) && data.length > 0;
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
