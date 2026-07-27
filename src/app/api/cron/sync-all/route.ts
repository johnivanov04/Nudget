/**
 * GET /api/cron/sync-all — background refresh of every user's Plaid data.
 *
 * NOT user-authed: authenticated by the `CRON_SECRET` bearer. Runs on a schedule
 * (GitHub Actions) so balances + transactions stay current without the user
 * refreshing anything — the point of a glanceable runway/widget.
 */
import type { NextRequest } from 'next/server';
import { isValidCronRequest } from '@/lib/api/cronAuth';
import { getEnv } from '@/lib/env';
import { runScheduledSync } from '@/lib/services/scheduledSync';
import { reportError } from '@/lib/observability/report';
import { ok, unauthorized, serverError } from '@/lib/api/responses';

// Syncing several items + recompute can take a while; allow generous time.
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  if (!isValidCronRequest(req.headers.get('authorization'), getEnv().CRON_SECRET)) {
    return unauthorized('Invalid cron secret');
  }
  try {
    const result = await runScheduledSync();
    return ok(result);
  } catch (err) {
    reportError(err, { scope: 'cron.sync-all' });
    return serverError('Scheduled sync failed');
  }
}
