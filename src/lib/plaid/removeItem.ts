/**
 * Invalidate a Plaid Item upstream via `/item/remove`.
 *
 * Plaid bills Transactions per active Item (an Item with a valid access token),
 * so when a user disconnects a bank or deletes their account we must tell Plaid
 * to release the Item — otherwise we keep paying for "orphaned" connections.
 *
 * Best-effort by contract: a failure here (e.g. the token is already invalid)
 * must NOT block the local disconnect/delete. We report and continue so the
 * user's data is always removed even if the upstream call fails.
 */
import { getPlaidClient } from './client';
import { plaidItemsRepo } from '@/lib/db/repositories';
import { reportError } from '@/lib/observability/report';

/** Remove a single Item upstream. Never throws. */
export async function removePlaidItemUpstream(itemId: string): Promise<void> {
  try {
    const accessToken = await plaidItemsRepo.getDecryptedAccessToken(itemId);
    await getPlaidClient().itemRemove({ access_token: accessToken });
  } catch (err) {
    reportError(err, { scope: 'plaid.item-remove', itemId });
  }
}

/** Remove all of a user's Items upstream (used on account deletion). */
export async function removeAllPlaidItemsUpstream(userId: string): Promise<void> {
  const items = await plaidItemsRepo.listByUser(userId);
  await Promise.all(items.map((item) => removePlaidItemUpstream(item.id)));
}
