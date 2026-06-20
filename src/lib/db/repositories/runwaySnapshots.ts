import { getSupabaseAdmin } from '@/lib/supabase/admin';
import type { RunwaySnapshotRow } from '../types';

/** runway_snapshots data access. Snapshots are immutable calculation records. */
export const runwaySnapshotsRepo = {
  /** Latest snapshot for a user — what the widget/dashboard reads. */
  async getLatest(userId: string): Promise<RunwaySnapshotRow | null> {
    const { data, error } = await getSupabaseAdmin()
      .from('runway_snapshots')
      .select('*')
      .eq('user_id', userId)
      .order('generated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return (data as RunwaySnapshotRow) ?? null;
  },

  async insert(
    row: Omit<RunwaySnapshotRow, 'id' | 'generated_at'> & { generated_at?: string },
  ): Promise<RunwaySnapshotRow> {
    const { data, error } = await getSupabaseAdmin()
      .from('runway_snapshots')
      .insert(row)
      .select('*')
      .single();
    if (error) throw error;
    return data as RunwaySnapshotRow;
  },
};
