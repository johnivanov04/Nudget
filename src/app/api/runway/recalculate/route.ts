/**
 * POST /api/runway/recalculate
 *
 * Auth-gated. Loads the user's accounts, transactions, bills, and schedule from
 * the database, recomputes the runway with the pure engine, and persists a
 * `runway_snapshots` row. Returns the fresh snapshot.
 *
 * `?demo=1` (no auth) computes from the bundled seed data — kept for the iOS
 * team to build against before a user has linked real data.
 */
import type { NextRequest } from 'next/server';
import { getUserFromRequest } from '@/lib/api/auth';
import { recomputeRunwayForUser } from '@/lib/services/runway';
import { buildRunwaySnapshot } from '@/lib/domain/snapshot';
import { mockSnapshotInput } from '@/lib/mock/seedData';
import { ok, unauthorized, serverError } from '@/lib/api/responses';

export async function POST(req: NextRequest) {
  if (req.nextUrl.searchParams.get('demo') === '1') {
    return ok({ snapshot: buildRunwaySnapshot(mockSnapshotInput), source: 'seed' });
  }

  const user = await getUserFromRequest(req);
  if (!user) return unauthorized();

  try {
    const result = await recomputeRunwayForUser(user.userId);
    if (result.status === 'needs_schedule') {
      return ok({ status: 'needs_schedule', snapshot: null, source: 'db' });
    }
    return ok({ status: result.status, snapshot: result.snapshot, source: 'db' });
  } catch {
    return serverError('Failed to recompute runway');
  }
}
