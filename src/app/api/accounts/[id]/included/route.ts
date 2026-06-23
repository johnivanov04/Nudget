/**
 * POST /api/accounts/:id/included — include/exclude an account from the runway.
 *
 * Auth-gated and ownership-scoped. After the change the runway is recomputed so
 * the dashboard/widget reflect the new set of counted accounts immediately.
 */
import type { NextRequest } from 'next/server';
import { getUserFromRequest } from '@/lib/api/auth';
import { accountIncludedSchema } from '@/lib/api/schemas';
import { accountsRepo } from '@/lib/db/repositories';
import { recomputeRunwayForUser } from '@/lib/services/runway';
import { ok, badRequest, unauthorized, notFound } from '@/lib/api/responses';

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getUserFromRequest(req);
  if (!user) return unauthorized();

  const { id } = await ctx.params;
  if (!id) return badRequest('Missing account id');

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return badRequest('Request body must be valid JSON');
  }
  const parsed = accountIncludedSchema.safeParse(json);
  if (!parsed.success) {
    return badRequest('Invalid payload', parsed.error.flatten());
  }

  const updated = await accountsRepo.setIncludedInRunway(user.userId, id, parsed.data.included);
  if (!updated) return notFound('No such account for this user');

  await recomputeRunwayForUser(user.userId);
  return ok({ id, includedInRunway: parsed.data.included });
}
