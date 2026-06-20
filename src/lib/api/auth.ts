/**
 * Request authentication.
 *
 * Phase 1 stub: real implementation verifies the Supabase Auth JWT from the
 * Authorization header and returns the user id. Until Supabase Auth is wired up
 * (Phase 2 / Week 2), this returns null so protected routes can short-circuit
 * with a 401 and a clear TODO.
 *
 * TODO(phase-2): verify `Authorization: Bearer <supabase-jwt>` using the
 * project's JWT secret / `supabase.auth.getUser(token)`, and enforce that every
 * data access is scoped to the returned user id (RLS is the backstop).
 */
import type { NextRequest } from 'next/server';

export interface AuthedUser {
  userId: string;
}

export async function getUserFromRequest(_req: NextRequest): Promise<AuthedUser | null> {
  // Intentionally unauthenticated until Supabase Auth is integrated.
  return null;
}
