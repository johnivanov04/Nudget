import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const h = vi.hoisted(() => ({
  getUserFromRequest: vi.fn(),
  listByUser: vi.fn(),
  setIncluded: vi.fn(),
  recompute: vi.fn(),
}));

vi.mock('@/lib/api/auth', () => ({ getUserFromRequest: h.getUserFromRequest }));
vi.mock('@/lib/db/repositories', () => ({
  accountsRepo: { listByUser: h.listByUser, setIncludedInRunway: h.setIncluded },
}));
vi.mock('@/lib/services/runway', () => ({ recomputeRunwayForUser: h.recompute }));

import { GET as listAccounts } from './accounts/route';
import { POST as setIncluded } from './accounts/[id]/included/route';

const authed = { userId: 'user-A', email: null };
const get = (url = 'http://t/api/accounts') =>
  new NextRequest(url, { headers: { authorization: 'Bearer t' } });
const post = (url: string, body?: unknown) =>
  new NextRequest(url, {
    method: 'POST',
    headers: { authorization: 'Bearer t' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  vi.clearAllMocks();
  h.recompute.mockResolvedValue({ status: 'ok' });
});

describe('GET /api/accounts', () => {
  it('401 when unauthenticated', async () => {
    h.getUserFromRequest.mockResolvedValue(null);
    expect((await listAccounts(get())).status).toBe(401);
  });

  it('returns the user’s accounts with balance + included flag', async () => {
    h.getUserFromRequest.mockResolvedValue(authed);
    h.listByUser.mockResolvedValue([
      {
        id: 'a1',
        name: 'Checking',
        mask: '0000',
        type: 'depository',
        subtype: 'checking',
        available_balance: 500,
        current_balance: 520,
        included_in_runway: true,
      },
      {
        id: 'a2',
        name: 'Savings',
        mask: '1111',
        type: 'depository',
        subtype: 'savings',
        available_balance: null,
        current_balance: 9000,
        included_in_runway: false,
      },
    ]);
    const body = await (await listAccounts(get())).json();
    expect(body.accounts).toHaveLength(2);
    expect(body.accounts[0]).toEqual({
      id: 'a1',
      name: 'Checking',
      mask: '0000',
      type: 'depository',
      subtype: 'checking',
      balance: 500, // available preferred
      includedInRunway: true,
    });
    expect(body.accounts[1].balance).toBe(9000); // falls back to current
  });
});

describe('POST /api/accounts/:id/included', () => {
  it('401 when unauthenticated', async () => {
    h.getUserFromRequest.mockResolvedValue(null);
    expect(
      (await setIncluded(post('http://t/api/accounts/a1/included', { included: false }), ctx('a1')))
        .status,
    ).toBe(401);
  });

  it('400 on an invalid body', async () => {
    h.getUserFromRequest.mockResolvedValue(authed);
    expect(
      (await setIncluded(post('http://t/api/accounts/a1/included', { included: 'no' }), ctx('a1')))
        .status,
    ).toBe(400);
  });

  it('404 when the account is not the caller’s', async () => {
    h.getUserFromRequest.mockResolvedValue(authed);
    h.setIncluded.mockResolvedValue(false);
    const res = await setIncluded(
      post('http://t/api/accounts/a1/included', { included: false }),
      ctx('a1'),
    );
    expect(res.status).toBe(404);
    expect(h.recompute).not.toHaveBeenCalled();
  });

  it('toggles and recomputes the runway', async () => {
    h.getUserFromRequest.mockResolvedValue(authed);
    h.setIncluded.mockResolvedValue(true);
    const res = await setIncluded(
      post('http://t/api/accounts/a1/included', { included: false }),
      ctx('a1'),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: 'a1', includedInRunway: false });
    expect(h.setIncluded).toHaveBeenCalledWith('user-A', 'a1', false);
    expect(h.recompute).toHaveBeenCalledWith('user-A');
  });
});
