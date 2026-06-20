/**
 * POST /api/nudges/test — preview the nudge(s) that would fire right now.
 *
 * Auth-gated. Returns the planned nudge copy keys WITHOUT recording them or
 * affecting throttling — the "send me a test nudge" settings affordance.
 */
import type { NextRequest } from 'next/server';
import { getUserFromRequest } from '@/lib/api/auth';
import { testNudgeSchema } from '@/lib/api/schemas';
import { previewNudges } from '@/lib/services/nudges';
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
  return ok({ planned, note: 'preview only — not sent or recorded' });
}
