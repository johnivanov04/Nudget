/**
 * DELETE /api/plaid/item/:id — disconnect a linked Plaid item.
 *
 * Ownership-scoped: a user can only disconnect their own item. We release the
 * Item upstream via Plaid `/item/remove` (so we stop being billed for it), then
 * delete the row — which cascades to its accounts and transactions and stops
 * future sync — and recompute the runway.
 */
import type { NextRequest } from 'next/server';
import { getUserFromRequest } from '@/lib/api/auth';
import { plaidItemsRepo } from '@/lib/db/repositories';
import { removePlaidItemUpstream } from '@/lib/plaid/removeItem';
import { recomputeRunwayForUser } from '@/lib/services/runway';
import { ok, unauthorized, badRequest, notFound } from '@/lib/api/responses';

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getUserFromRequest(req);
  if (!user) return unauthorized();

  const { id } = await ctx.params;
  if (!id) return badRequest('Missing Plaid item id');

  // Ownership guard: only proceed if this item belongs to the caller.
  const item = await plaidItemsRepo.getOwned(user.userId, id);
  if (!item) {
    return notFound('No such Plaid item for this user');
  }

  // Release the Item at Plaid first (best-effort — never blocks the local delete),
  // then remove locally (cascades accounts/transactions) and recompute the runway.
  await removePlaidItemUpstream(id);
  await plaidItemsRepo.remove(id);
  await recomputeRunwayForUser(user.userId);

  return ok({ disconnected: true, itemId: id });
}
