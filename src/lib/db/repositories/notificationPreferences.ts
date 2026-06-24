import { getSupabaseAdmin } from '@/lib/supabase/admin';
import type { NotificationPreferencesRow } from '../types';

/** A user eligible for scheduled morning nudges, with their timezone. */
export interface NudgeCandidate {
  userId: string;
  timezone: string;
  morningHour: number;
  morningMinute: number;
  enabled: boolean;
  morningEnabled: boolean;
}

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

  /**
   * Users with nudges + morning nudges enabled, joined to their timezone. The
   * cron job filters these down to whoever's `morning_hour` matches now.
   */
  async listNudgeCandidates(): Promise<NudgeCandidate[]> {
    const { data, error } = await getSupabaseAdmin()
      .from('notification_preferences')
      .select('user_id, enabled, morning_enabled, morning_hour, morning_minute, profiles(timezone)')
      .eq('enabled', true)
      .eq('morning_enabled', true);
    if (error) throw error;
    type Row = {
      user_id: string;
      enabled: boolean;
      morning_enabled: boolean;
      morning_hour: number;
      morning_minute: number;
      profiles: { timezone: string } | { timezone: string }[] | null;
    };
    return ((data as Row[]) ?? []).map((r) => {
      const profile = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
      return {
        userId: r.user_id,
        timezone: profile?.timezone ?? 'America/Los_Angeles',
        morningHour: r.morning_hour,
        morningMinute: r.morning_minute ?? 0,
        enabled: r.enabled,
        morningEnabled: r.morning_enabled,
      };
    });
  },
};
