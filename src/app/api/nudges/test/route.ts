/**
 * POST /api/nudges/test — preview the nudge(s) that would fire right now.
 *
 * Auth-gated. By default returns the planned nudge copy keys WITHOUT recording
 * them or affecting throttling — the "send me a test nudge" settings affordance.
 * With `{ deliver: true }` it also pushes those nudges to the caller's own
 * registered devices via APNs, for verifying push on a real device.
 */
import type { NextRequest } from 'next/server';
import { getUserFromRequest } from '@/lib/api/auth';
import { testNudgeSchema } from '@/lib/api/schemas';
import { previewNudges } from '@/lib/services/nudges';
import { deliverNudges } from '@/lib/services/push';
import { ok, badRequest, unauthorized } from '@/lib/api/responses';

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return unauthorized();

  let body: unknown = {};
  try {
    const text = await req.text();
    if (text) body = JSON.parse(text);
  } catch {
    return badRequest('Request body must be valid JSON');
  }
  const parsed = testNudgeSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest('Invalid test nudge payload', parsed.error.flatten());
  }

  const planned = await previewNudges(user.userId, parsed.data.occasion);

  if (parsed.data.deliver) {
    const delivery = await deliverNudges(user.userId, planned);
    return ok({ planned, delivery, note: 'delivered to your registered devices (if any)' });
  }

  return ok({ planned, note: 'preview only — not sent or recorded' });
}
