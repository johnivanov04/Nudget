/**
 * GET /api/cron/morning-nudges — fire scheduled morning nudges.
 *
 * NOT user-authed: authenticated by the `CRON_SECRET` bearer that Vercel Cron
 * attaches automatically. Selects users whose chosen `morning_hour` matches the
 * current hour in their timezone and sends each their (throttled) morning nudge.
 *
 * Configured to run hourly — see `vercel.json`.
 */
import type { NextRequest } from 'next/server';
import { isValidCronRequest } from '@/lib/api/cronAuth';
import { getEnv } from '@/lib/env';
import { runMorningNudges } from '@/lib/services/cron';
import { reportError } from '@/lib/observability/report';
import { ok, unauthorized, serverError } from '@/lib/api/responses';

export async function GET(req: NextRequest) {
  if (!isValidCronRequest(req.headers.get('authorization'), getEnv().CRON_SECRET)) {
    return unauthorized('Invalid cron secret');
  }

  try {
    const result = await runMorningNudges();
    return ok(result);
  } catch (err) {
    reportError(err, { scope: 'cron.morning-nudges' });
    return serverError('Morning nudge run failed');
  }
}
