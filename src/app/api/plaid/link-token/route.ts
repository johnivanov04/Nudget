/**
 * POST /api/plaid/link-token — create a short-lived Plaid Link token.
 *
 * TODO(phase-3): authenticate, call Plaid `/link/token/create` with the
 * server-only PLAID_CLIENT_ID/PLAID_SECRET, and return only the link_token to
 * the client. The Plaid secret must never reach the client.
 */
import { notImplemented } from '@/lib/api/responses';

export async function POST() {
  return notImplemented({
    endpoint: 'POST /api/plaid/link-token',
    phase: 'Phase 3',
    todo: 'Create a Plaid Link token server-side and return only link_token to the client.',
  });
}
