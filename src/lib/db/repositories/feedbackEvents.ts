import { getSupabaseAdmin } from '@/lib/supabase/admin';
import type { FeedbackEventRow } from '../types';

/**
 * feedback_events data access. Feedback is tied to events (bill/nudge/snapshot),
 * NOT to raw financial data — free_text should be screened before storage.
 */
export const feedbackEventsRepo = {
  async insert(row: Omit<FeedbackEventRow, 'id' | 'created_at'>): Promise<FeedbackEventRow> {
    const { data, error } = await getSupabaseAdmin()
      .from('feedback_events')
      .insert(row)
      .select('*')
      .single();
    if (error) throw error;
    return data as FeedbackEventRow;
  },

  async listByUser(userId: string): Promise<FeedbackEventRow[]> {
    const { data, error } = await getSupabaseAdmin()
      .from('feedback_events')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data as FeedbackEventRow[]) ?? [];
  },
};
