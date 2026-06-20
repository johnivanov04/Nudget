import { getSupabaseAdmin } from '@/lib/supabase/admin';
import type { PaycheckScheduleRow } from '../types';

/** paycheck_schedules data access (one active schedule per user for the MVP). */
export const paycheckSchedulesRepo = {
  async getByUser(userId: string): Promise<PaycheckScheduleRow | null> {
    const { data, error } = await getSupabaseAdmin()
      .from('paycheck_schedules')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw error;
    return (data as PaycheckScheduleRow) ?? null;
  },

  async upsert(
    row: Partial<PaycheckScheduleRow> & Pick<PaycheckScheduleRow, 'user_id' | 'frequency'>,
  ): Promise<PaycheckScheduleRow> {
    const { data, error } = await getSupabaseAdmin()
      .from('paycheck_schedules')
      .upsert(row, { onConflict: 'user_id' })
      .select('*')
      .single();
    if (error) throw error;
    return data as PaycheckScheduleRow;
  },
};
