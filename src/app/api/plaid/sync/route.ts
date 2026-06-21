/**
 * POST /api/plaid/sync — run a transaction sync for the caller's item(s).
 *
 * Auth-gated and user-scoped. Body `{ itemId? }` syncs one owned item; omitting
 * it syncs all the user's items. Cursor advances only on success (see
 * lib/plaid/sync). Returns counts only — never raw financial data.
 */
import type { NextRequest } from 'next/server';
import { getUserFromRequest } from '@/lib/api/auth';
import { plaidSyncSchema } from '@/lib/api/schemas';
import { plaidItemsRepo } from '@/lib/db/repositories';
import { syncTransactionsForItem } from '@/lib/plaid/sync';
import { runBillDetection } from '@/lib/services/bills';
import { recomputeRunwayForUser } from '@/lib/services/runway';
import { planAndRecordNudges } from '@/lib/services/nudges';
import { rateLimit } from '@/lib/api/rateLimit';
import { reportError } from '@/lib/observability/report';
import {
  ok,
  badRequest,
  unauthorized,
  notFound,
  serverError,
  tooManyRequests,
} from '@/lib/api/responses';
import type { PlaidItemRow } from '@/lib/db/types';

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return unauthorized();

  // Sync is expensive (Plaid + detection + recompute) — cap per user.
  const rl = rateLimit(`sync:${user.userId}`, { limit: 6, windowMs: 60_000 });
  if (!rl.allowed) return tooManyRequests(rl.resetAt);

  // Body is optional; default to syncing all items.
  let body: unknown = {};
  try {
    const text = await req.text();
    if (text) body = JSON.parse(text);
  } catch {
    return badRequest('Request body must be valid JSON');
  }
  const parsed = plaidSyncSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest('Invalid sync payload', parsed.error.flatten());
  }

  let items: PlaidItemRow[];
  if (parsed.data.itemId) {
    const item = await plaidItemsRepo.getOwned(user.userId, parsed.data.itemId);
    if (!item) return notFound('No such Plaid item for this user');
    items = [item];
  } else {
    items = await plaidItemsRepo.listByUser(user.userId);
  }

  try {
    const results = [];
    for (const item of items) {
      results.push(await syncTransactionsForItem(item));
    }

    // After new transactions land, re-detect recurring bills and recompute the
    // runway so the dashboard/widget reflect fresh data. Best-effort: a failure
    // here should not fail the sync the client just performed.
    let billsUpserted = 0;
    try {
      const detection = await runBillDetection(user.userId);
      billsUpserted = detection.upserted;
      await recomputeRunwayForUser(user.userId);
      // Event-occasion nudges (danger / bill-approach) — throttled in the engine.
      await planAndRecordNudges(user.userId, 'event');
    } catch (err) {
      // Sync itself succeeded; report the post-processing failure but don't fail.
      reportError(err, { scope: 'plaid.sync.postprocess', userId: user.userId });
    }

    return ok({ synced: results.length, results, billsUpserted });
  } catch (err) {
    reportError(err, { scope: 'plaid.sync', userId: user.userId });
    return serverError('Transaction sync failed');
  }
}
