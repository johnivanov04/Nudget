/**
 * POST /api/plaid/webhook — receive Plaid webhooks (e.g. SYNC_UPDATES_AVAILABLE).
 *
 * TODO(phase-3): VERIFY the webhook signature (Plaid JWT verification) before
 * trusting any payload, then enqueue a transaction sync for the affected item.
 * Never trust an unauthenticated payload; never log raw financial data.
 */
import { notImplemented } from '@/lib/api/responses';

export async function POST() {
  return notImplemented({
    endpoint: 'POST /api/plaid/webhook',
    phase: 'Phase 3',
    todo: 'Verify Plaid webhook signature, then enqueue a sync for the affected item. Reject unverified payloads.',
  });
}
