import { getSupabaseAdmin } from '@/lib/supabase/admin';
import type { ProfileRow } from '../types';

/** users / profiles data access. */
export const profilesRepo = {
  async getById(userId: string): Promise<ProfileRow | null> {
    const { data, error } = await getSupabaseAdmin()
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    if (error) throw error;
    return (data as ProfileRow) ?? null;
  },

  async markPrivacyAcknowledged(userId: string): Promise<void> {
    const { error } = await getSupabaseAdmin()
      .from('profiles')
      .update({ privacy_acknowledged_at: new Date().toISOString() })
      .eq('id', userId);
    if (error) throw error;
  },

  async setOnboardingCompleted(userId: string, completed: boolean): Promise<void> {
    const { error } = await getSupabaseAdmin()
      .from('profiles')
      .update({ onboarding_completed: completed })
      .eq('id', userId);
    if (error) throw error;
  },
};
