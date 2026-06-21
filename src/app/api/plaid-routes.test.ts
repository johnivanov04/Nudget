/**
 * Route-handler tests for the Phase 3 Plaid endpoints (mocked auth, Plaid client,
 * repositories, and sync/verify services — no network or DB here). The real
 * pagination, mapping, and JWT-verification logic is unit-tested in
 * src/lib/plaid/*.test.ts.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const h = vi.hoisted(() => ({
  getUserFromRequest: vi.fn(),
  linkTokenCreate: vi.fn(),
  itemPublicTokenExchange: vi.fn(),
  itemGet: vi.fn(),
  institutionsGetById: vi.fn(),
  accountsGet: vi.fn(),
  plaidCreate: vi.fn(),
  accountsUpsert: vi.fn(),
  getOwned: vi.fn(),
  listByUser: vi.fn(),
  getByPlaidItemId: vi.fn(),
  setStatus: vi.fn(),
  txnList: vi.fn(),
  setIgnored: vi.fn(),
  syncItem: vi.fn(),
  verifyWebhook: vi.fn(),
  getEnv: vi.fn(),
  runBillDetection: vi.fn(),
  recomputeRunway: vi.fn(),
  planAndRecordNudges: vi.fn(),
}));

vi.mock('@/lib/api/auth', () => ({ getUserFromRequest: h.getUserFromRequest }));
vi.mock('@/lib/plaid/client', () => ({
  getPlaidClient: () => ({
    linkTokenCreate: h.linkTokenCreate,
    itemPublicTokenExchange: h.itemPublicTokenExchange,
    itemGet: h.itemGet,
    institutionsGetById: h.institutionsGetById,
    accountsGet: h.accountsGet,
  }),
}));
vi.mock('@/lib/db/repositories', () => ({
  plaidItemsRepo: {
    create: h.plaidCreate,
    getOwned: h.getOwned,
    listByUser: h.listByUser,
    getByPlaidItemId: h.getByPlaidItemId,
    setStatus: h.setStatus,
  },
  accountsRepo: { upsertMany: h.accountsUpsert },
  transactionsRepo: { listByUser: h.txnList, setIgnored: h.setIgnored },
}));
vi.mock('@/lib/plaid/sync', () => ({ syncTransactionsForItem: h.syncItem }));
vi.mock('@/lib/plaid/webhook', () => ({ verifyPlaidWebhook: h.verifyWebhook }));
vi.mock('@/lib/env', () => ({ getEnv: h.getEnv }));
vi.mock('@/lib/services/bills', () => ({ runBillDetection: h.runBillDetection }));
vi.mock('@/lib/services/runway', () => ({ recomputeRunwayForUser: h.recomputeRunway }));
vi.mock('@/lib/services/nudges', () => ({ planAndRecordNudges: h.planAndRecordNudges }));

import { __resetRateLimitStore } from '@/lib/api/rateLimit';
import { POST as linkToken } from './plaid/link-token/route';
import { POST as exchange } from './plaid/exchange-public-token/route';
import { POST as sync } from './plaid/sync/route';
import { POST as webhook } from './plaid/webhook/route';
import { GET as listTransactions } from './transactions/route';
import { POST as ignoreTransaction } from './transactions/[id]/ignore/route';

const authed = { userId: 'user-A', email: 'a@b.com' };

function post(url: string, body?: unknown, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(url, {
    method: 'POST',
    headers: { authorization: 'Bearer t', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  __resetRateLimitStore();
  h.getEnv.mockReturnValue({ PLAID_WEBHOOK_URL: undefined });
  h.runBillDetection.mockResolvedValue({ detected: 0, upserted: 0 });
  h.recomputeRunway.mockResolvedValue({ status: 'ok' });
  h.planAndRecordNudges.mockResolvedValue({ status: 'none', planned: [] });
});

describe('POST /api/plaid/link-token', () => {
  it('401 when unauthenticated', async () => {
    h.getUserFromRequest.mockResolvedValue(null);
    expect((await linkToken(post('http://t/api/plaid/link-token'))).status).toBe(401);
  });

  it('returns only the link token (never the secret)', async () => {
    h.getUserFromRequest.mockResolvedValue(authed);
    h.linkTokenCreate.mockResolvedValue({
      data: { link_token: 'link-sandbox-abc', expiration: '2026-06-20T15:00:00Z' },
    });
    const res = await linkToken(post('http://t/api/plaid/link-token'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.linkToken).toBe('link-sandbox-abc');
    expect(JSON.stringify(body)).not.toMatch(/secret/i);
    expect(h.linkTokenCreate.mock.calls[0]![0].user.client_user_id).toBe('user-A');
  });
});

describe('POST /api/plaid/exchange-public-token', () => {
  it('401 when unauthenticated', async () => {
    h.getUserFromRequest.mockResolvedValue(null);
    expect((await exchange(post('http://t/api/plaid/exchange', { publicToken: 'p' }))).status).toBe(
      401,
    );
  });

  it('400 when publicToken is missing', async () => {
    h.getUserFromRequest.mockResolvedValue(authed);
    expect((await exchange(post('http://t/api/plaid/exchange', {}))).status).toBe(400);
  });

  it('exchanges, stores the encrypted token, upserts accounts, returns no token', async () => {
    h.getUserFromRequest.mockResolvedValue(authed);
    h.itemPublicTokenExchange.mockResolvedValue({
      data: { access_token: 'access-sandbox-TOPSECRET', item_id: 'plaid-item-1' },
    });
    h.itemGet.mockResolvedValue({ data: { item: { institution_id: null } } });
    h.accountsGet.mockResolvedValue({
      data: {
        accounts: [
          {
            account_id: 'pa1',
            name: 'Checking',
            mask: '0000',
            type: 'depository',
            subtype: 'checking',
            balances: { available: 100, current: 100 },
          },
        ],
      },
    });
    h.plaidCreate.mockResolvedValue({ id: 'item-row-1' });
    h.accountsUpsert.mockResolvedValue(undefined);

    const res = await exchange(post('http://t/api/plaid/exchange', { publicToken: 'public-abc' }));
    expect(res.status).toBe(201);
    const body = await res.json();

    // The access token was handed to the repo (which encrypts it)...
    expect(h.plaidCreate.mock.calls[0]![0].accessToken).toBe('access-sandbox-TOPSECRET');
    // ...and never appears in the client response.
    expect(JSON.stringify(body)).not.toContain('TOPSECRET');
    expect(body.accounts).toHaveLength(1);
    expect(body.accounts[0].plaidAccountId).toBe('pa1');
    expect(h.accountsUpsert).toHaveBeenCalledOnce();
  });
});

describe('POST /api/plaid/sync', () => {
  it('401 when unauthenticated', async () => {
    h.getUserFromRequest.mockResolvedValue(null);
    expect((await sync(post('http://t/api/plaid/sync'))).status).toBe(401);
  });

  it('404 when a specified item is not owned by the caller', async () => {
    h.getUserFromRequest.mockResolvedValue(authed);
    h.getOwned.mockResolvedValue(null);
    const res = await sync(
      post('http://t/api/plaid/sync', { itemId: '11111111-1111-1111-1111-111111111111' }),
    );
    expect(res.status).toBe(404);
    expect(h.syncItem).not.toHaveBeenCalled();
  });

  it('syncs all of the user’s items when no itemId is given', async () => {
    h.getUserFromRequest.mockResolvedValue(authed);
    h.listByUser.mockResolvedValue([{ id: 'i1' }, { id: 'i2' }]);
    h.syncItem.mockResolvedValue({
      itemId: 'i',
      added: 1,
      modified: 0,
      removed: 0,
      skipped: 0,
      pages: 1,
    });
    const res = await sync(post('http://t/api/plaid/sync'));
    expect(res.status).toBe(200);
    expect((await res.json()).synced).toBe(2);
    expect(h.syncItem).toHaveBeenCalledTimes(2);
    // After syncing, detection + runway recompute + event nudges run for the user.
    expect(h.runBillDetection).toHaveBeenCalledWith('user-A');
    expect(h.recomputeRunway).toHaveBeenCalledWith('user-A');
    expect(h.planAndRecordNudges).toHaveBeenCalledWith('user-A', 'event');
  });

  it('rate-limits a user hammering sync (429 after the cap)', async () => {
    h.getUserFromRequest.mockResolvedValue(authed);
    h.listByUser.mockResolvedValue([]);
    let lastStatus = 0;
    for (let i = 0; i < 8; i += 1) {
      lastStatus = (await sync(post('http://t/api/plaid/sync'))).status;
    }
    expect(lastStatus).toBe(429); // limit is 6/min
  });
});

describe('POST /api/plaid/webhook', () => {
  it('401 on an invalid signature (does not process)', async () => {
    h.verifyWebhook.mockResolvedValue(false);
    const res = await webhook(
      post(
        'http://t/api/plaid/webhook',
        { webhook_type: 'TRANSACTIONS' },
        { 'plaid-verification': 'jwt' },
      ),
    );
    expect(res.status).toBe(401);
    expect(h.syncItem).not.toHaveBeenCalled();
  });

  it('syncs the affected item on SYNC_UPDATES_AVAILABLE', async () => {
    h.verifyWebhook.mockResolvedValue(true);
    h.getByPlaidItemId.mockResolvedValue({ id: 'item-row-1', user_id: 'user-A' });
    h.syncItem.mockResolvedValue({});
    const res = await webhook(
      post(
        'http://t/api/plaid/webhook',
        {
          webhook_type: 'TRANSACTIONS',
          webhook_code: 'SYNC_UPDATES_AVAILABLE',
          item_id: 'plaid-item-1',
        },
        { 'plaid-verification': 'jwt' },
      ),
    );
    expect(res.status).toBe(200);
    expect(h.getByPlaidItemId).toHaveBeenCalledWith('plaid-item-1');
    expect(h.syncItem).toHaveBeenCalledOnce();
  });

  it('flags the item on an ITEM ERROR webhook', async () => {
    h.verifyWebhook.mockResolvedValue(true);
    h.getByPlaidItemId.mockResolvedValue({ id: 'item-row-1', user_id: 'user-A' });
    await webhook(
      post(
        'http://t/api/plaid/webhook',
        { webhook_type: 'ITEM', webhook_code: 'ERROR', item_id: 'plaid-item-1' },
        { 'plaid-verification': 'jwt' },
      ),
    );
    expect(h.setStatus).toHaveBeenCalledWith('item-row-1', 'login_required');
  });
});

describe('GET /api/transactions', () => {
  it('401 when unauthenticated', async () => {
    h.getUserFromRequest.mockResolvedValue(null);
    const res = await listTransactions(new NextRequest('http://t/api/transactions'));
    expect(res.status).toBe(401);
  });

  it('returns the user’s mapped transactions', async () => {
    h.getUserFromRequest.mockResolvedValue(authed);
    h.txnList.mockResolvedValue([
      {
        id: 'tx1',
        merchant_name: 'Coffee',
        amount: 12,
        date: '2026-06-20',
        category: 'FOOD',
        pending: false,
        ignored: false,
        is_spending: null,
      },
    ]);
    const res = await listTransactions(
      new NextRequest('http://t/api/transactions?from=2026-06-01&limit=50'),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.transactions[0]).toMatchObject({ id: 'tx1', merchantName: 'Coffee', amount: 12 });
    expect(h.txnList.mock.calls[0]![1]).toMatchObject({ from: '2026-06-01', limit: 50 });
  });
});

describe('POST /api/transactions/:id/ignore', () => {
  const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

  it('401 when unauthenticated', async () => {
    h.getUserFromRequest.mockResolvedValue(null);
    const res = await ignoreTransaction(post('http://t/api/transactions/tx1/ignore'), ctx('tx1'));
    expect(res.status).toBe(401);
  });

  it('defaults to ignoring and scopes to the caller', async () => {
    h.getUserFromRequest.mockResolvedValue(authed);
    h.setIgnored.mockResolvedValue(undefined);
    const res = await ignoreTransaction(post('http://t/api/transactions/tx1/ignore'), ctx('tx1'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: 'tx1', ignored: true });
    expect(h.setIgnored).toHaveBeenCalledWith('user-A', 'tx1', true);
    // The runway is recomputed so the change is reflected immediately.
    expect(h.recomputeRunway).toHaveBeenCalledWith('user-A');
  });

  it('can un-ignore', async () => {
    h.getUserFromRequest.mockResolvedValue(authed);
    const res = await ignoreTransaction(
      post('http://t/api/transactions/tx1/ignore', { ignored: false }),
      ctx('tx1'),
    );
    expect((await res.json()).ignored).toBe(false);
    expect(h.setIgnored).toHaveBeenCalledWith('user-A', 'tx1', false);
  });
});
