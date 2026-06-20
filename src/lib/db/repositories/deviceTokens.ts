import { createHash } from 'node:crypto';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import type { DevicePlatform, DeviceTokenRow } from '../types';

/** SHA-256 of a raw device token — what we store (never the raw token). */
export function hashDeviceToken(rawToken: string): string {
  return createHash('sha256').update(rawToken, 'utf8').digest('hex');
}

/** device_tokens data access. */
export const deviceTokensRepo = {
  /** Register (or re-enable) a device token for push delivery. Idempotent. */
  async register(params: {
    userId: string;
    rawToken: string;
    platform?: DevicePlatform;
  }): Promise<DeviceTokenRow> {
    const { data, error } = await getSupabaseAdmin()
      .from('device_tokens')
      .upsert(
        {
          user_id: params.userId,
          platform: params.platform ?? 'ios',
          token_hash: hashDeviceToken(params.rawToken),
          enabled: true,
        },
        { onConflict: 'user_id,token_hash' },
      )
      .select('*')
      .single();
    if (error) throw error;
    return data as DeviceTokenRow;
  },

  async listByUser(userId: string): Promise<DeviceTokenRow[]> {
    const { data, error } = await getSupabaseAdmin()
      .from('device_tokens')
      .select('*')
      .eq('user_id', userId);
    if (error) throw error;
    return (data as DeviceTokenRow[]) ?? [];
  },
};
