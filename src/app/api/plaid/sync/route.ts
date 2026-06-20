/**
 * POST /api/plaid/sync — run a (manual or scheduled) transaction sync.
 *
 * TODO(phase-3): authenticate (server/internal), decrypt the item's access token
 * in-memory, call Plaid `/transactions/sync` with the stored cursor, upsert
 * added/modified and delete removed transactions, advance the cursor only on
 * success, and update last_sync_at. Retryable; never advance cursor on failure.
 */
import { notImplemented } from '@/lib/api/responses';

export async function POST() {
  return notImplemented({
    endpoint: 'POST /api/plaid/sync',
    phase: 'Phase 3',
    todo: 'Cursor-based /transactions/sync: upsert added/modified, delete removed, advance cursor only on success.',
  });
}
