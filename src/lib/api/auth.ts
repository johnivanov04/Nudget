/**
 * Request authentication.
 *
 * The iOS app / web client authenticates with Supabase Auth and sends the
 * resulting JWT as `Authorization: Bearer <jwt>`. We verify that token via
 * Supabase (`auth.getUser(token)`), which validates the signature/expiry against
 * the project and returns the user. The returned `userId` is then used to scope
 * every data access on the server (RLS is the backstop for the anon-key path).
 *
 * We verify through Supabase rather than checking the JWT secret locally so the
 * env surface stays minimal (no extra JWT secret) and revoked/rotated tokens are
 * rejected. Local HS256 verification is a possible future optimization.
 */
import type { NextRequest } from 'next/server';
import { getSupabaseAnon } from '@/lib/supabase/client';

export interface AuthedUser {
  userId: string;
  email: string | null;
}

/** Pure helper: pull the bearer token out of an Authorization header value. */
export function extractBearerToken(authHeader: string | null | undefined): string | null {
  if (!authHeader) return null;
  const match = /^Bearer\s+(.+)$/i.exec(authHeader.trim());
  const token = match?.[1]?.trim();
  return token && token.length > 0 ? token : null;
}

/**
 * Resolve the authenticated user for a request, or null if the request is
 * unauthenticated / the token is invalid. Never throws on a bad token.
 */
export async function getUserFromRequest(req: NextRequest): Promise<AuthedUser | null> {
  const token = extractBearerToken(req.headers.get('authorization'));
  if (!token) return null;

  try {
    const { data, error } = await getSupabaseAnon().auth.getUser(token);
    if (error || !data?.user) return null;
    return { userId: data.user.id, email: data.user.email ?? null };
  } catch {
    // Network/verification failure -> treat as unauthenticated, never leak details.
    return null;
  }
}
