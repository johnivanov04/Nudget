/**
 * GET /api/widget/snapshot — the minimal, privacy-aware snapshot the iOS widget
 * renders. Reads the cached `runway_snapshots` row.
 *
 * `?privacy=1` hides dollar amounts (lock-screen default). `?demo=1` (no auth)
 * returns a snapshot computed from seed data for development.
 */
import type { NextRequest } from 'next/server';
import { getUserFromRequest } from '@/lib/api/auth';
import { runwaySnapshotsRepo, profilesRepo } from '@/lib/db/repositories';
import { snapshotRowToWidget } from '@/lib/services/snapshotView';
import { buildRunwaySnapshot } from '@/lib/domain/snapshot';
import { toWidgetSnapshot } from '@/lib/domain/widget';
import { mockSnapshotInput } from '@/lib/mock/seedData';
import { todayInTimeZone } from '@/lib/domain/dateUtils';
import { ok, unauthorized } from '@/lib/api/responses';

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const privacyMode = params.get('privacy') === '1';

  if (params.get('demo') === '1') {
    const snapshot = buildRunwaySnapshot(mockSnapshotInput);
    return ok({ widget: toWidgetSnapshot(snapshot, { privacyMode }), source: 'seed' });
  }

  const user = await getUserFromRequest(req);
  if (!user) return unauthorized();

  const row = await runwaySnapshotsRepo.getLatest(user.userId);
  if (!row) {
    return ok({ widget: null, status: 'needs_data' });
  }

  const now = new Date();
  const profile = await profilesRepo.getById(user.userId);
  const today = todayInTimeZone(profile?.timezone ?? 'America/Los_Angeles', now);

  return ok({
    widget: snapshotRowToWidget(row, { today, now: now.toISOString(), privacyMode }),
  });
}
