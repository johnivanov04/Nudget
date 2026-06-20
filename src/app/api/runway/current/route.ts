/**
 * GET /api/runway/current — the latest persisted runway snapshot (dashboard).
 *
 * Auth-gated. Reads the cached `runway_snapshots` row (cheap; recompute happens
 * on sync / recalculate / bill-confirm / ignore). Includes a last-updated +
 * stale signal. Returns `needs_data` when no snapshot exists yet.
 */
import type { NextRequest } from 'next/server';
import { getUserFromRequest } from '@/lib/api/auth';
import { runwaySnapshotsRepo, profilesRepo } from '@/lib/db/repositories';
import { snapshotRowToView } from '@/lib/services/snapshotView';
import { todayInTimeZone } from '@/lib/domain/dateUtils';
import { ok, unauthorized } from '@/lib/api/responses';

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return unauthorized();

  const row = await runwaySnapshotsRepo.getLatest(user.userId);
  if (!row) {
    return ok({ status: 'needs_data', snapshot: null });
  }

  const now = new Date();
  const profile = await profilesRepo.getById(user.userId);
  const today = todayInTimeZone(profile?.timezone ?? 'America/Los_Angeles', now);

  return ok({
    snapshot: snapshotRowToView(row, { today, now: now.toISOString() }),
  });
}
