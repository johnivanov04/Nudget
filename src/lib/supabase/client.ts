/**
 * Anon Supabase client — safe to use with the public anon key. Honors RLS, so
 * it only ever sees the authenticated user's own rows. This is the client the
 * iOS app / web admin would authenticate against, and the one the server uses to
 * verify a caller's JWT (`auth.getUser(token)`).
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getEnv } from '@/lib/env';

let anonClient: SupabaseClient | null = null;

export function getSupabaseAnon(): SupabaseClient {
  if (anonClient) return anonClient;
  const env = getEnv();
  anonClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    // Server usage: do not persist or auto-refresh sessions.
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return anonClient;
}
