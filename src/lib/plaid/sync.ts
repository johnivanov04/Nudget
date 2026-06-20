/**
 * Transaction sync (Plaid `/transactions/sync`).
 *
 * `collectTransactionSync` is the pure pagination loop: it walks pages until
 * `has_more` is false, accumulating added/modified/removed and the final cursor.
 * It takes a minimal client interface so it is unit-tested with a fake client.
 *
 * `syncTransactionsForItem` orchestrates persistence: it upserts added+modified,
 * deletes removed, and advances the stored cursor ONLY after all writes succeed
 * (so a mid-sync failure is safely retried from the previous cursor).
 */
import { plaidTransactionToRow, type PlaidSyncTransaction } from './mappers';
import { getPlaidClient } from './client';
import { plaidItemsRepo, accountsRepo, transactionsRepo } from '@/lib/db/repositories';
import type { PlaidItemRow } from '@/lib/db/types';

export interface PlaidSyncPage {
  added: PlaidSyncTransaction[];
  modified: PlaidSyncTransaction[];
  removed: Array<{ transaction_id: string }>;
  next_cursor: string;
  has_more: boolean;
}

/** The slice of the Plaid client `collectTransactionSync` needs. */
export interface TransactionsSyncClient {
  transactionsSync(args: {
    access_token: string;
    cursor?: string;
  }): Promise<{ data: PlaidSyncPage }>;
}

export interface CollectedSync {
  added: PlaidSyncTransaction[];
  modified: PlaidSyncTransaction[];
  removed: string[];
  nextCursor: string;
  pages: number;
}

const MAX_PAGES = 1000; // safety valve against a pathological has_more loop

export async function collectTransactionSync(
  client: TransactionsSyncClient,
  accessToken: string,
  startCursor: string | null,
): Promise<CollectedSync> {
  let cursor: string | undefined = startCursor ?? undefined;
  const added: PlaidSyncTransaction[] = [];
  const modified: PlaidSyncTransaction[] = [];
  const removed: string[] = [];
  let pages = 0;
  let hasMore = true;

  while (hasMore && pages < MAX_PAGES) {
    const { data } = await client.transactionsSync({ access_token: accessToken, cursor });
    added.push(...data.added);
    modified.push(...data.modified);
    removed.push(...data.removed.map((r) => r.transaction_id));
    cursor = data.next_cursor;
    hasMore = data.has_more;
    pages += 1;
  }

  return { added, modified, removed, nextCursor: cursor ?? '', pages };
}

export interface SyncSummary {
  itemId: string;
  added: number;
  modified: number;
  removed: number;
  skipped: number; // transactions whose account is not linked locally
  pages: number;
}

/**
 * Sync one Plaid item to the database. The caller is responsible for having
 * already verified ownership of `item` (the user route) or authenticity (the
 * webhook). Decryption happens in-memory and the token is never returned.
 */
export async function syncTransactionsForItem(item: PlaidItemRow): Promise<SyncSummary> {
  const accessToken = await plaidItemsRepo.getDecryptedAccessToken(item.id);

  const accounts = await accountsRepo.listByUser(item.user_id);
  const accountIdByPlaidId = new Map(accounts.map((a) => [a.plaid_account_id, a.id]));

  const collected = await collectTransactionSync(getPlaidClient(), accessToken, item.sync_cursor);

  let skipped = 0;
  const rows = [];
  for (const txn of [...collected.added, ...collected.modified]) {
    const row = plaidTransactionToRow(item.user_id, accountIdByPlaidId, txn);
    if (row) rows.push(row);
    else skipped += 1;
  }

  // Writes first; cursor advances only if all of these succeed.
  await transactionsRepo.upsertMany(rows);
  await transactionsRepo.deleteByPlaidIds(collected.removed);
  await plaidItemsRepo.updateSyncState(item.id, collected.nextCursor);

  return {
    itemId: item.id,
    added: collected.added.length,
    modified: collected.modified.length,
    removed: collected.removed.length,
    skipped,
    pages: collected.pages,
  };
}
