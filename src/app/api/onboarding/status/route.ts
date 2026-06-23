/**
 * GET /api/onboarding/status — which onboarding steps the caller has completed.
 *
 * Lets the client resume onboarding at the first incomplete step (so a user who
 * already set their payday isn't asked again) and lets the dashboard route
 * correctly. Auth-gated; returns booleans only.
 */
import type { NextRequest } from 'next/server';
import { getUserFromRequest } from '@/lib/api/auth';
import { profilesRepo, paycheckSchedulesRepo, plaidItemsRepo } from '@/lib/db/repositories';
import { ok, unauthorized } from '@/lib/api/responses';

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return unauthorized();

  const [profile, schedule, items] = await Promise.all([
    profilesRepo.getById(user.userId),
    paycheckSchedulesRepo.getByUser(user.userId),
    plaidItemsRepo.listByUser(user.userId),
  ]);

  const privacyAcknowledged = Boolean(profile?.privacy_acknowledged_at);
  const hasPaydaySchedule = schedule !== null;
  const hasLinkedBank = items.length > 0;

  return ok({
    privacyAcknowledged,
    hasPaydaySchedule,
    hasLinkedBank,
    complete: privacyAcknowledged && hasPaydaySchedule && hasLinkedBank,
  });
}
