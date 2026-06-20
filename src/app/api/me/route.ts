/**
 * GET /api/me — current user profile + onboarding state.
 *
 * TODO(phase-2): verify Supabase Auth JWT, load profile via profilesRepo.getById,
 * and return { id, email, timezone, onboardingCompleted, privacyAcknowledgedAt }.
 * Must never include raw financial data.
 */
import { notImplemented } from '@/lib/api/responses';

export async function GET() {
  return notImplemented({
    endpoint: 'GET /api/me',
    phase: 'Phase 2',
    todo: 'Authenticate (Supabase Auth) and return the current user profile + onboarding state.',
  });
}
