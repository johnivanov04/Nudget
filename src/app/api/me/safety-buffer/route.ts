/**
 * POST /api/me/safety-buffer — set the caller's safety buffer.
 *
 * A per-user cushion (dollars, >= 0) subtracted from safe-to-spend so the runway
 * never encourages spending to zero. Persists it and recomputes the runway so
 * the dashboard/widget reflect the change immediately.
 */
import type { NextRequest } from 'next/server';
import { getUserFromRequest } from '@/lib/api/auth';
import { safetyBufferSchema } from '@/lib/api/schemas';
import { profilesRepo } from '@/lib/db/repositories';
import { recomputeRunwayForUser } from '@/lib/services/runway';
import { ok, badRequest, unauthorized } from '@/lib/api/responses';

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return unauthorized();

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return badRequest('Request body must be valid JSON');
  }
  const parsed = safetyBufferSchema.safeParse(json);
  if (!parsed.success) {
    return badRequest('Invalid safety buffer', parsed.error.flatten());
  }

  await profilesRepo.setSafetyBuffer(user.userId, parsed.data.safetyBuffer);
  await recomputeRunwayForUser(user.userId);

  return ok({ safetyBuffer: parsed.data.safetyBuffer });
}
