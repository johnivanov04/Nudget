/**
 * GET /api/widget/snapshot
 *
 * Returns the minimal, privacy-aware snapshot the iOS widget renders. Pass
 * `?demo=1` (and optionally `&privacy=1`) to get a snapshot computed from seed
 * data — this is how the widget UI is built before Plaid/DB exist.
 *
 * TODO(phase-4/8): authenticate, read the latest persisted runway_snapshot for
 * the user, apply their privacy-mode preference, and return it (cached).
 */
import type { NextRequest } from 'next/server';
import { buildRunwaySnapshot } from '@/lib/domain/snapshot';
import { toWidgetSnapshot } from '@/lib/domain/widget';
import { mockSnapshotInput } from '@/lib/mock/seedData';
import { ok, notImplemented } from '@/lib/api/responses';

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const demo = params.get('demo') === '1';

  if (demo) {
    const privacyMode = params.get('privacy') === '1';
    const snapshot = buildRunwaySnapshot(mockSnapshotInput);
    return ok({ widget: toWidgetSnapshot(snapshot, { privacyMode }), source: 'seed' });
  }

  return notImplemented({
    endpoint: 'GET /api/widget/snapshot',
    phase: 'Phase 4/8',
    todo: 'Authenticate and return the latest persisted runway snapshot for the user (privacy-mode aware, cached). Use ?demo=1 to preview from seed data.',
  });
}
