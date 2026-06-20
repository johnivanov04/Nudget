/**
 * Server-only Supabase client using the SERVICE ROLE key.
 *
 * This client bypasses RLS and must NEVER be imported into client/browser code
 * or exposed to the iOS app. Use it only in server jobs, webhooks, and trusted
 * API route handlers that have already authenticated the caller.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getEnv } from '@/lib/env';

let adminClient: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (adminClient) return adminClient;
  const env = getEnv();
  adminClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return adminClient;
}
