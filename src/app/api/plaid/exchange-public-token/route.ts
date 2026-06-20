/**
 * POST /api/plaid/exchange-public-token — exchange a public token for an access
 * token and persist the item.
 *
 * TODO(phase-3): authenticate, call Plaid `/item/public_token/exchange`,
 * ENCRYPT the access token with lib/crypto/tokenCrypto, store it via
 * plaidItemsRepo.create, fetch accounts, and return only non-sensitive item
 * metadata. The plaintext access token must never be returned or logged.
 */
import { notImplemented } from '@/lib/api/responses';

export async function POST() {
  return notImplemented({
    endpoint: 'POST /api/plaid/exchange-public-token',
    phase: 'Phase 3',
    todo: 'Exchange public token, encrypt + store the access token server-side (never to client), fetch accounts.',
  });
}
