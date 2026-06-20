/**
 * GET /api/runway/current — the latest persisted runway snapshot (dashboard).
 *
 * TODO(phase-4): authenticate and return the latest runway_snapshots row via
 * runwaySnapshotsRepo.getLatest, including its generated_at so the client can
 * show last-updated/stale context. Recompute on demand via POST /recalculate.
 */
import { notImplemented } from '@/lib/api/responses';

export async function GET() {
  return notImplemented({
    endpoint: 'GET /api/runway/current',
    phase: 'Phase 4',
    todo: 'Authenticate and return the latest persisted runway snapshot with last-updated context.',
  });
}
