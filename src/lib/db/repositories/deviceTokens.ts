import { createHash } from 'node:crypto';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { encryptToken, decryptToken } from '@/lib/crypto/tokenCrypto';
import { getEnv } from '@/lib/env';
import type { DevicePlatform, DeviceTokenRow } from '../types';

/** SHA-256 of a raw device token — the privacy-safe dedup key (never the raw token). */
export function hashDeviceToken(rawToken: string): string {
  return createHash('sha256').update(rawToken, 'utf8').digest('hex');
}

/** A token ready for APNs delivery: the row id plus the decrypted raw token. */
export interface DeliverableToken {
  id: string;
  rawToken: string;
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
          // Raw token encrypted at rest so the server can address APNs.
          token_encrypted: encryptToken(params.rawToken, getEnv().TOKEN_ENCRYPTION_KEY),
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

  /**
   * Enabled tokens for a user with the raw token decrypted, ready to push to.
   * Server-only — the raw token never leaves this layer. Rows missing the
   * encrypted column (legacy hash-only) or that fail to decrypt are skipped.
   */
  async listDeliverable(userId: string): Promise<DeliverableToken[]> {
    const key = getEnv().TOKEN_ENCRYPTION_KEY;
    const { data, error } = await getSupabaseAdmin()
      .from('device_tokens')
      .select('id, token_encrypted, enabled')
      .eq('user_id', userId)
      .eq('enabled', true);
    if (error) throw error;

    const out: DeliverableToken[] = [];
    for (const row of (data as Pick<DeviceTokenRow, 'id' | 'token_encrypted'>[]) ?? []) {
      if (!row.token_encrypted) continue;
      try {
        out.push({ id: row.id, rawToken: decryptToken(row.token_encrypted, key) });
      } catch {
        // A tampered/undecryptable envelope is unusable — skip it silently.
      }
    }
    return out;
  },

  /** Disable a token (e.g. APNs reported it Unregistered/BadDeviceToken). */
  async disableById(id: string): Promise<void> {
    const { error } = await getSupabaseAdmin()
      .from('device_tokens')
      .update({ enabled: false })
      .eq('id', id);
    if (error) throw error;
  },
};
