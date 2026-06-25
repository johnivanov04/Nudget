/**
 * GET /api/cron/morning-nudges — fire scheduled morning nudges.
 *
 * NOT user-authed: authenticated by the `CRON_SECRET` bearer that the scheduler
 * attaches. Selects users whose chosen morning time (hour:minute, in their
 * timezone) has just arrived and sends each their (throttled) morning nudge.
 *
 * Not scheduled in `vercel.json` on the free tier (Hobby = daily crons only);
 * for minute-precision firing run it every few minutes via Vercel Pro cron or
 * an external scheduler hitting this endpoint with the CRON_SECRET bearer.
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
