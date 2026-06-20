import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { encryptToken, decryptToken } from '@/lib/crypto/tokenCrypto';
import { getEnv } from '@/lib/env';
import type { PlaidItemRow, PlaidItemStatus } from '../types';

/**
 * plaid_items data access.
 *
 * The access token is ALWAYS encrypted before it touches the database and only
 * decrypted in-memory on the server when a Plaid call is about to be made. The
 * plaintext token is never returned to callers outside this module's helpers,
 * never logged, and never sent to the client.
 */
export const plaidItemsRepo = {
  async create(params: {
    userId: string;
    plaidItemId: string;
    accessToken: string;
    institutionName?: string | null;
  }): Promise<PlaidItemRow> {
    const encrypted = encryptToken(params.accessToken, getEnv().TOKEN_ENCRYPTION_KEY);
    const { data, error } = await getSupabaseAdmin()
      .from('plaid_items')
      .insert({
        user_id: params.userId,
        plaid_item_id: params.plaidItemId,
        encrypted_access_token: encrypted,
        institution_name: params.institutionName ?? null,
        status: 'active' satisfies PlaidItemStatus,
      })
      .select('*')
      .single();
    if (error) throw error;
    return data as PlaidItemRow;
  },

  async listByUser(userId: string): Promise<PlaidItemRow[]> {
    const { data, error } = await getSupabaseAdmin()
      .from('plaid_items')
      .select('*')
      .eq('user_id', userId);
    if (error) throw error;
    return (data as PlaidItemRow[]) ?? [];
  },

  /** Decrypt the access token for a single item. Server-side use only. */
  async getDecryptedAccessToken(itemId: string): Promise<string> {
    const { data, error } = await getSupabaseAdmin()
      .from('plaid_items')
      .select('encrypted_access_token')
      .eq('id', itemId)
      .single();
    if (error) throw error;
    return decryptToken(
      (data as { encrypted_access_token: string }).encrypted_access_token,
      getEnv().TOKEN_ENCRYPTION_KEY,
    );
  },

  async updateSyncState(itemId: string, cursor: string): Promise<void> {
    const { error } = await getSupabaseAdmin()
      .from('plaid_items')
      .update({ sync_cursor: cursor, last_sync_at: new Date().toISOString() })
      .eq('id', itemId);
    if (error) throw error;
  },

  async setStatus(itemId: string, status: PlaidItemStatus): Promise<void> {
    const { error } = await getSupabaseAdmin()
      .from('plaid_items')
      .update({ status })
      .eq('id', itemId);
    if (error) throw error;
  },

  /** Disconnect: spec requires removing the item and stopping sync. */
  async remove(itemId: string): Promise<void> {
    const { error } = await getSupabaseAdmin().from('plaid_items').delete().eq('id', itemId);
    if (error) throw error;
  },
};
