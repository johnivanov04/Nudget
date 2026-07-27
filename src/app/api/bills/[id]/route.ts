/**
 * DELETE /api/bills/:id — delete a bill the caller owns.
 *
 * Ownership-scoped. Primarily for manual bills the user added; removing one
 * recomputes the runway. (Auto-detected bills are usually rejected via the
 * confirm endpoint so detection doesn't re-add them, but a hard delete is
 * allowed for any owned bill.)
 */
import type { NextRequest } from 'next/server';
import { getUserFromRequest } from '@/lib/api/auth';
import { recurringBillsRepo } from '@/lib/db/repositories';
import { recomputeRunwayForUser } from '@/lib/services/runway';
import { ok, badRequest, unauthorized, notFound } from '@/lib/api/responses';

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getUserFromRequest(req);
  if (!user) return unauthorized();

  const { id } = await ctx.params;
  if (!id) return badRequest('Missing bill id');

  const deleted = await recurringBillsRepo.deleteOwned(user.userId, id);
  if (!deleted) return notFound('No such bill for this user');

  await recomputeRunwayForUser(user.userId);

  return ok({ deleted: true, id });
}
