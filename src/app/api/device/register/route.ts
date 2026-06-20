/**
 * POST /api/device/register — register an APNs device token for push delivery.
 *
 * Auth-gated. Only a SHA-256 hash of the token is stored (see device_tokens);
 * the raw token is never returned and never logged.
 */
import type { NextRequest } from 'next/server';
import { getUserFromRequest } from '@/lib/api/auth';
import { deviceRegisterSchema } from '@/lib/api/schemas';
import { deviceTokensRepo } from '@/lib/db/repositories';
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
  const parsed = deviceRegisterSchema.safeParse(json);
  if (!parsed.success) {
    return badRequest('Invalid device registration payload', parsed.error.flatten());
  }

  await deviceTokensRepo.register({
    userId: user.userId,
    rawToken: parsed.data.deviceToken,
    platform: parsed.data.platform,
  });

  return ok({ registered: true }, { status: 201 });
}
