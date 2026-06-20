/**
 * POST /api/runway/recalculate
 *
 * Phase 1: computes a runway snapshot directly from a posted scenario using the
 * pure engine — this makes the core calculation exercisable over HTTP without
 * Plaid or a database. Pass `?demo=1` to compute from the bundled seed data.
 *
 * TODO(phase-4): replace the posted scenario with "load this user's accounts,
 * transactions, bills, and schedule, recompute, and persist a runway_snapshot".
 */
import type { NextRequest } from 'next/server';
import { recalculateSchema } from '@/lib/api/schemas';
import { recalculateBodyToSnapshot } from '@/lib/api/runwayService';
import { buildRunwaySnapshot } from '@/lib/domain/snapshot';
import { mockSnapshotInput } from '@/lib/mock/seedData';
import { ok, badRequest } from '@/lib/api/responses';

export async function POST(req: NextRequest) {
  const demo = req.nextUrl.searchParams.get('demo') === '1';
  if (demo) {
    return ok({ snapshot: buildRunwaySnapshot(mockSnapshotInput), source: 'seed' });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return badRequest('Request body must be valid JSON (or use ?demo=1)');
  }

  const parsed = recalculateSchema.safeParse(json);
  if (!parsed.success) {
    return badRequest('Invalid runway recalculate payload', parsed.error.flatten());
  }

  return ok({ snapshot: recalculateBodyToSnapshot(parsed.data), source: 'request' });
}
