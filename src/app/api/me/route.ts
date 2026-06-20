/**
 * GET /api/me — current user profile + onboarding state.
 *
 * Authenticates via Supabase JWT and returns the caller's own profile. Never
 * includes raw financial data.
 */
import type { NextRequest } from 'next/server';
import { getUserFromRequest } from '@/lib/api/auth';
import { profilesRepo } from '@/lib/db/repositories';
import { ok, unauthorized, serverError } from '@/lib/api/responses';

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return unauthorized();

  const profile = await profilesRepo.getById(user.userId);
  if (!profile) {
    // The on_auth_user_created trigger should always create this; treat a miss
    // as a server-side inconsistency rather than exposing internals.
    return serverError('Profile not found for authenticated user');
  }

  return ok({
    id: profile.id,
    email: profile.email,
    timezone: profile.timezone,
    onboardingCompleted: profile.onboarding_completed,
    privacyAcknowledgedAt: profile.privacy_acknowledged_at,
  });
}
