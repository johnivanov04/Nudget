/**
 * DELETE /api/plaid/item/:id — disconnect a linked Plaid item.
 *
 * Ownership-scoped: a user can only disconnect their own item. Deleting the
 * item cascades to its accounts and transactions and stops future sync. The
 * disconnect is enforced both by the repository's user_id guard and by RLS.
 *
 * TODO(phase-3): also call Plaid `/item/remove` to invalidate the access token
 * upstream before deleting the row.
 */
import type { NextRequest } from 'next/server';
import { getUserFromRequest } from '@/lib/api/auth';
import { plaidItemsRepo } from '@/lib/db/repositories';
import { ok, unauthorized, badRequest, notFound } from '@/lib/api/responses';

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getUserFromRequest(req);
  if (!user) return unauthorized();

  const { id } = await ctx.params;
  if (!id) return badRequest('Missing Plaid item id');

  const deleted = await plaidItemsRepo.removeOwned(user.userId, id);
  if (!deleted) {
    return notFound('No such Plaid item for this user');
  }

  return ok({ disconnected: true, itemId: id });
}
