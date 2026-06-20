/**
 * Anon Supabase client — safe to use with the public anon key. Honors RLS, so
 * it only ever sees the authenticated user's own rows. This is the client the
 * iOS app / web admin would authenticate against.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getEnv } from '@/lib/env';

let anonClient: SupabaseClient | null = null;

export function getSupabaseAnon(): SupabaseClient {
  if (anonClient) return anonClient;
  const env = getEnv();
  anonClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  return anonClient;
}
