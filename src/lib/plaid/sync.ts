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

  let collected: CollectedSync;
  try {
    collected = await collectTransactionSync(getPlaidClient(), accessToken, item.sync_cursor);
  } catch (err) {
    // Classify Plaid item errors so a broken connection stops being retried (and
    // stops spamming error reports) instead of failing on every scheduled run.
    const code = plaidErrorCode(err);
    if (code && REAUTH_ERROR_CODES.has(code)) {
      // Needs the user to re-authenticate — flag it so the app prompts a reconnect.
      await plaidItemsRepo.setStatus(item.id, 'login_required');
      throw new HandledItemError('login_required', err);
    }
    if (code && DEAD_ITEM_ERROR_CODES.has(code)) {
      // Permanently broken (revoked, invalid token, item gone) — mark it so the
      // cron skips it. The user can disconnect/relink.
      await plaidItemsRepo.setStatus(item.id, 'error');
      throw new HandledItemError('error', err);
    }
    throw err; // genuinely unexpected — let the caller report it
  }

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

  // Refresh stored balances so available cash tracks the real balance, not the
  // one captured at link time. Best-effort — the transaction sync already
  // committed, so a balance hiccup shouldn't fail it.
  try {
    const { data } = await getPlaidClient().accountsGet({ access_token: accessToken });
    await accountsRepo.updateBalances(
      data.accounts.map((a) => ({
        plaidAccountId: a.account_id,
        available: a.balances?.available ?? null,
        current: a.balances?.current ?? null,
      })),
    );
  } catch {
    // Leave the last-known balances in place.
  }

  // A successful sync means any prior re-auth/error state is resolved.
  if (item.status !== 'active') {
    await plaidItemsRepo.setStatus(item.id, 'active');
  }

  return {
    itemId: item.id,
    added: collected.added.length,
    modified: collected.modified.length,
    removed: collected.removed.length,
    skipped,
    pages: collected.pages,
  };
}

/**
 * A Plaid item error we've already handled (flagged the item's status). Callers
 * should NOT report these to Sentry — they're expected states, not bugs.
 */
export class HandledItemError extends Error {
  constructor(
    public readonly itemStatus: 'login_required' | 'error',
    public readonly plaidError?: unknown,
  ) {
    super(`Plaid item flagged: ${itemStatus}`);
    this.name = 'HandledItemError';
  }
}

/** The Plaid `error_code`, if this looks like a Plaid API error. */
function plaidErrorCode(err: unknown): string | undefined {
  return (err as { response?: { data?: { error_code?: string } } })?.response?.data?.error_code;
}

/** Errors that mean the user must re-authenticate (a reconnect fixes it). */
const REAUTH_ERROR_CODES = new Set(['ITEM_LOGIN_REQUIRED', 'PENDING_EXPIRATION']);

/** Errors that mean the connection is permanently broken (relink required). */
const DEAD_ITEM_ERROR_CODES = new Set([
  'INVALID_ACCESS_TOKEN',
  'INVALID_CREDENTIALS',
  'ITEM_NOT_FOUND',
  'ITEM_NO_LONGER_SUPPORTED',
  'ACCESS_NOT_GRANTED',
]);
