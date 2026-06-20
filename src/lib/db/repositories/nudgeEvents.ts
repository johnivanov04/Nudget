import { getSupabaseAdmin } from '@/lib/supabase/admin';
import type { NudgeEventRow } from '../types';

/** nudge_events data access. Stores delivery + feedback, never raw money copy. */
export const nudgeEventsRepo = {
  async insert(row: Omit<NudgeEventRow, 'id' | 'created_at'>): Promise<NudgeEventRow> {
    const { data, error } = await getSupabaseAdmin()
      .from('nudge_events')
      .insert(row)
      .select('*')
      .single();
    if (error) throw error;
    return data as NudgeEventRow;
  },

  async listByUser(userId: string): Promise<NudgeEventRow[]> {
    const { data, error } = await getSupabaseAdmin()
      .from('nudge_events')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data as NudgeEventRow[]) ?? [];
  },

  async markOpened(nudgeId: string): Promise<void> {
    const { error } = await getSupabaseAdmin()
      .from('nudge_events')
      .update({ opened_at: new Date().toISOString() })
      .eq('id', nudgeId);
    if (error) throw error;
  },
};
