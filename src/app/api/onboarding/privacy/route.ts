/**
 * POST /api/onboarding/privacy — record the user's privacy acknowledgement.
 *
 * Auth-gated. Sets `profiles.privacy_acknowledged_at`. The iOS onboarding calls
 * this after the user reads the data-use/privacy screen, before Plaid linking.
 */
import type { NextRequest } from 'next/server';
import { getUserFromRequest } from '@/lib/api/auth';
import { profilesRepo } from '@/lib/db/repositories';
import { ok, unauthorized, serverError } from '@/lib/api/responses';

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return unauthorized();

  try {
    await profilesRepo.markPrivacyAcknowledged(user.userId);
    return ok({ acknowledged: true });
  } catch {
    return serverError('Failed to record privacy acknowledgement');
  }
}
