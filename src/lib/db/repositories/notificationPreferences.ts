import { getSupabaseAdmin } from '@/lib/supabase/admin';
import type { NotificationPreferencesRow } from '../types';

/** notification_preferences data access (one row per user). */
export const notificationPreferencesRepo = {
  async getByUser(userId: string): Promise<NotificationPreferencesRow | null> {
    const { data, error } = await getSupabaseAdmin()
      .from('notification_preferences')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw error;
    return (data as NotificationPreferencesRow) ?? null;
  },

  async upsert(
    row: Partial<NotificationPreferencesRow> & Pick<NotificationPreferencesRow, 'user_id'>,
  ): Promise<NotificationPreferencesRow> {
    const { data, error } = await getSupabaseAdmin()
      .from('notification_preferences')
      .upsert(row, { onConflict: 'user_id' })
      .select('*')
      .single();
    if (error) throw error;
    return data as NotificationPreferencesRow;
  },
};
