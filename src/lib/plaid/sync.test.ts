import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PlaidItemRow } from '@/lib/db/types';

const m = vi.hoisted(() => ({
  transactionsSync: vi.fn(),
  getDecryptedAccessToken: vi.fn(),
  listAccounts: vi.fn(),
  upsertMany: vi.fn(),
  deleteByPlaidIds: vi.fn(),
  updateSyncState: vi.fn(),
}));

vi.mock('@/lib/plaid/client', () => ({
  getPlaidClient: () => ({ transactionsSync: m.transactionsSync }),
}));
vi.mock('@/lib/db/repositories', () => ({
  plaidItemsRepo: {
    getDecryptedAccessToken: m.getDecryptedAccessToken,
    updateSyncState: m.updateSyncState,
  },
  accountsRepo: { listByUser: m.listAccounts },
  transactionsRepo: { upsertMany: m.upsertMany, deleteByPlaidIds: m.deleteByPlaidIds },
}));

import { collectTransactionSync, syncTransactionsForItem } from './sync';

const page = (over: Partial<Record<string, unknown>>) => ({
  data: {
    added: [],
    modified: [],
    removed: [],
    next_cursor: 'c',
    has_more: false,
    ...over,
  },
});

const item = {
  id: 'item1',
  user_id: 'u1',
  sync_cursor: 'old-cursor',
} as PlaidItemRow;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('collectTransactionSync', () => {
  it('walks pages until has_more is false and accumulates everything', async () => {
    const client = {
      transactionsSync: vi
        .fn()
        .mockResolvedValueOnce(
          page({ added: [{ transaction_id: 't1' }], next_cursor: 'c1', has_more: true }),
        )
        .mockResolvedValueOnce(
          page({
            added: [{ transaction_id: 't2' }],
            modified: [{ transaction_id: 'm1' }],
            removed: [{ transaction_id: 'r1' }],
            next_cursor: 'c2',
            has_more: false,
          }),
        ),
    };
    const result = await collectTransactionSync(client as never, 'tok', 'start');
    expect(result.added.map((t) => t.transaction_id)).toEqual(['t1', 't2']);
    expect(result.modified.map((t) => t.transaction_id)).toEqual(['m1']);
    expect(result.removed).toEqual(['r1']);
    expect(result.nextCursor).toBe('c2');
    expect(result.pages).toBe(2);
    // First call uses the provided start cursor.
    expect(client.transactionsSync.mock.calls[0]![0]).toEqual({
      access_token: 'tok',
      cursor: 'start',
    });
  });

  it('passes undefined cursor for an initial sync', async () => {
    const client = { transactionsSync: vi.fn().mockResolvedValue(page({})) };
    await collectTransactionSync(client as never, 'tok', null);
    expect(client.transactionsSync.mock.calls[0]![0].cursor).toBeUndefined();
  });
});

describe('syncTransactionsForItem', () => {
  beforeEach(() => {
    m.getDecryptedAccessToken.mockResolvedValue('decrypted-token');
    m.listAccounts.mockResolvedValue([{ id: 'acct-internal', plaid_account_id: 'plaid-acct' }]);
    m.upsertMany.mockResolvedValue(undefined);
    m.deleteByPlaidIds.mockResolvedValue(undefined);
    m.updateSyncState.mockResolvedValue(undefined);
  });

  it('upserts mapped rows, deletes removed, then advances the cursor', async () => {
    m.transactionsSync.mockResolvedValue(
      page({
        added: [
          { transaction_id: 'ta', account_id: 'plaid-acct', amount: 10, date: '2026-06-20' },
          // Unknown account -> skipped, not upserted.
          { transaction_id: 'tb', account_id: 'unknown', amount: 5, date: '2026-06-20' },
        ],
        modified: [
          { transaction_id: 'tc', account_id: 'plaid-acct', amount: 7, date: '2026-06-20' },
        ],
        removed: [{ transaction_id: 'tr' }],
        next_cursor: 'new-cursor',
        has_more: false,
      }),
    );

    const summary = await syncTransactionsForItem(item);

    expect(m.getDecryptedAccessToken).toHaveBeenCalledWith('item1');
    const upserted = m.upsertMany.mock.calls[0]![0] as Array<{ plaid_transaction_id: string }>;
    expect(upserted.map((r) => r.plaid_transaction_id)).toEqual(['ta', 'tc']);
    expect(m.deleteByPlaidIds).toHaveBeenCalledWith(['tr']);
    expect(m.updateSyncState).toHaveBeenCalledWith('item1', 'new-cursor');
    expect(summary).toMatchObject({ added: 2, modified: 1, removed: 1, skipped: 1, pages: 1 });
  });

  it('does NOT advance the cursor when a write fails (safe retry)', async () => {
    m.transactionsSync.mockResolvedValue(
      page({
        added: [{ transaction_id: 'ta', account_id: 'plaid-acct', amount: 1, date: '2026-06-20' }],
      }),
    );
    m.upsertMany.mockRejectedValue(new Error('db down'));

    await expect(syncTransactionsForItem(item)).rejects.toThrow('db down');
    expect(m.updateSyncState).not.toHaveBeenCalled();
  });
});
