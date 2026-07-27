/**
 * Scheduled background sync — keeps every user's data fresh without them
 * opening the app or pulling to refresh. Complements Plaid webhooks (which push
 * updates when available) as a safety net and to refresh balances regularly.
 *
 * Syncs each syncable item (transactions + balances), then re-detects bills and
 * recomputes the runway for each affected user so the cached snapshot the
 * dashboard/widget read stays current. One failure never aborts the batch.
 *
 * NOTE: this is a simple in-request loop — fine at small scale. At larger scale
 * move item syncs onto a durable queue (see webhook TODO).
 */
import { plaidItemsRepo } from '@/lib/db/repositories';
import { syncTransactionsForItem } from '@/lib/plaid/sync';
import { runBillDetection } from '@/lib/services/bills';
import { recomputeRunwayForUser } from '@/lib/services/runway';
import { reportError } from '@/lib/observability/report';

export interface ScheduledSyncResult {
  items: number;
  synced: number;
  users: number;
}

export async function runScheduledSync(): Promise<ScheduledSyncResult> {
  const items = await plaidItemsRepo.listAllSyncable();
  const affectedUsers = new Set<string>();
  let synced = 0;

  for (const item of items) {
    try {
      await syncTransactionsForItem(item);
      affectedUsers.add(item.user_id);
      synced += 1;
    } catch (err) {
      // e.g. an item needing re-auth — status is flagged inside the sync.
      reportError(err, { scope: 'cron.sync-all.item', userId: item.user_id, itemId: item.id });
    }
  }

  for (const userId of affectedUsers) {
    try {
      await runBillDetection(userId);
      await recomputeRunwayForUser(userId);
    } catch (err) {
      reportError(err, { scope: 'cron.sync-all.recompute', userId });
    }
  }

  return { items: items.length, synced, users: affectedUsers.size };
}
