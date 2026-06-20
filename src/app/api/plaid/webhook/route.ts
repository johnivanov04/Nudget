/**
 * POST /api/plaid/webhook — receive Plaid webhooks.
 *
 * This endpoint is NOT behind user auth — it is authenticated by Plaid's signed
 * `Plaid-Verification` JWT, which we verify against the body before trusting any
 * payload. On SYNC_UPDATES_AVAILABLE we sync the affected item; on item errors we
 * flag the item. Unverified payloads are rejected with 401.
 *
 * TODO(phase-8): enqueue the sync on a durable queue instead of running it
 * inline, so the webhook returns immediately and retries are decoupled.
 */
import type { NextRequest } from 'next/server';
import type { JsonWebKey } from 'node:crypto';
import { getPlaidClient } from '@/lib/plaid/client';
import { verifyPlaidWebhook } from '@/lib/plaid/webhook';
import { plaidItemsRepo } from '@/lib/db/repositories';
import { syncTransactionsForItem } from '@/lib/plaid/sync';
import { ok, unauthorized } from '@/lib/api/responses';

interface PlaidWebhookBody {
  webhook_type?: string;
  webhook_code?: string;
  item_id?: string;
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  const verified = await verifyPlaidWebhook({
    rawBody,
    verificationHeader: req.headers.get('plaid-verification'),
    getVerificationKey: async (keyId) => {
      const { data } = await getPlaidClient().webhookVerificationKeyGet({ key_id: keyId });
      return data.key as unknown as JsonWebKey;
    },
  });
  if (!verified) return unauthorized('Invalid webhook signature');

  let body: PlaidWebhookBody;
  try {
    body = JSON.parse(rawBody) as PlaidWebhookBody;
  } catch {
    return unauthorized('Invalid webhook body');
  }

  if (
    body.webhook_type === 'TRANSACTIONS' &&
    body.webhook_code === 'SYNC_UPDATES_AVAILABLE' &&
    body.item_id
  ) {
    const item = await plaidItemsRepo.getByPlaidItemId(body.item_id);
    if (item) {
      try {
        await syncTransactionsForItem(item);
      } catch {
        // Best effort: Plaid will resend; do not 500 (it would retry-storm).
      }
    }
  } else if (body.webhook_type === 'ITEM' && body.webhook_code === 'ERROR' && body.item_id) {
    const item = await plaidItemsRepo.getByPlaidItemId(body.item_id);
    if (item) await plaidItemsRepo.setStatus(item.id, 'login_required');
  }

  return ok({ received: true });
}
