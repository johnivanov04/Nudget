/**
 * GET /api/transactions — paginated transaction list for the user's review.
 *
 * TODO(phase-3/5): authenticate and return the user's transactions via
 * transactionsRepo.listByUser with date/account/ignored filters + pagination.
 */
import { notImplemented } from '@/lib/api/responses';

export async function GET() {
  return notImplemented({
    endpoint: 'GET /api/transactions',
    phase: 'Phase 3/5',
    todo: 'Authenticate and return the user-scoped, paginated transaction list with filters.',
  });
}
