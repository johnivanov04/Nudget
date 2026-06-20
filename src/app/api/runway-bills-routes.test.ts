/**
 * Route-handler tests for the Phase 4 bills + runway endpoints (mocked auth,
 * repositories, and the recompute service). The detection algorithm, recompute
 * service, and snapshot views are unit-tested separately.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const h = vi.hoisted(() => ({
  getUserFromRequest: vi.fn(),
  billsList: vi.fn(),
  billUpdate: vi.fn(),
  snapshotGetLatest: vi.fn(),
  profileGet: vi.fn(),
  recompute: vi.fn(),
}));

vi.mock('@/lib/api/auth', () => ({ getUserFromRequest: h.getUserFromRequest }));
vi.mock('@/lib/db/repositories', () => ({
  recurringBillsRepo: { listByUser: h.billsList, update: h.billUpdate },
  runwaySnapshotsRepo: { getLatest: h.snapshotGetLatest },
  profilesRepo: { getById: h.profileGet },
}));
vi.mock('@/lib/services/runway', () => ({ recomputeRunwayForUser: h.recompute }));

import { GET as billsDetected } from './bills/detected/route';
import { POST as confirmBill } from './bills/[id]/confirm/route';
import { POST as recalculate } from './runway/recalculate/route';
import { GET as runwayCurrent } from './runway/current/route';
import { GET as widgetSnapshot } from './widget/snapshot/route';

const authed = { userId: 'user-A', email: 'a@b.com' };

function post(url: string, body?: unknown): NextRequest {
  return new NextRequest(url, {
    method: 'POST',
    headers: { authorization: 'Bearer t' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
const get = (url: string) => new NextRequest(url, { headers: { authorization: 'Bearer t' } });

const snapshotRow = {
  id: 's1',
  user_id: 'user-A',
  available_cash: 1200,
  spent_today: 28,
  bills_before_payday: 540,
  safe_to_spend: 610,
  daily_safe_spend: 46.92,
  risk_level: 'safe',
  payday_date: '2026-07-03',
  generated_at: '2026-06-20T09:00:00.000Z',
};

beforeEach(() => {
  vi.clearAllMocks();
  h.profileGet.mockResolvedValue({ timezone: 'America/Los_Angeles' });
  h.recompute.mockResolvedValue({ status: 'ok' });
});

describe('GET /api/bills/detected', () => {
  it('401 when unauthenticated', async () => {
    h.getUserFromRequest.mockResolvedValue(null);
    expect((await billsDetected(get('http://t/api/bills/detected'))).status).toBe(401);
  });

  it('returns candidate + confirmed bills, marking candidates "likely"', async () => {
    h.getUserFromRequest.mockResolvedValue(authed);
    h.billsList.mockResolvedValue([
      {
        id: 'b1',
        merchant_name: 'Netflix',
        amount_estimate: 9.99,
        cadence: 'monthly',
        next_expected_date: '2026-07-15',
        confidence: 0.9,
        status: 'candidate',
      },
      {
        id: 'b2',
        merchant_name: 'Rent',
        amount_estimate: 1200,
        cadence: 'monthly',
        next_expected_date: '2026-06-30',
        confidence: 1,
        status: 'confirmed',
      },
    ]);
    const res = await billsDetected(get('http://t/api/bills/detected'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.bills).toHaveLength(2);
    expect(body.bills[0]).toMatchObject({ id: 'b1', likely: true });
    expect(body.bills[1]).toMatchObject({ id: 'b2', likely: false });
    expect(h.billsList).toHaveBeenCalledWith('user-A', ['candidate', 'confirmed']);
  });
});

describe('POST /api/bills/:id/confirm', () => {
  const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

  it('401 when unauthenticated', async () => {
    h.getUserFromRequest.mockResolvedValue(null);
    expect((await confirmBill(post('http://t/api/bills/b1/confirm'), ctx('b1'))).status).toBe(401);
  });

  it('confirms a bill (ownership-scoped) and recomputes the runway', async () => {
    h.getUserFromRequest.mockResolvedValue(authed);
    h.billUpdate.mockResolvedValue({
      id: 'b1',
      status: 'confirmed',
      amount_estimate: 9.99,
      next_expected_date: '2026-07-15',
      cadence: 'monthly',
    });
    const res = await confirmBill(
      post('http://t/api/bills/b1/confirm', { status: 'confirmed' }),
      ctx('b1'),
    );
    expect(res.status).toBe(200);
    expect(h.billUpdate.mock.calls[0]![0]).toBe('user-A'); // userId first arg
    expect(h.billUpdate.mock.calls[0]![1]).toBe('b1');
    expect(h.recompute).toHaveBeenCalledWith('user-A');
  });

  it('400 on an invalid status', async () => {
    h.getUserFromRequest.mockResolvedValue(authed);
    const res = await confirmBill(
      post('http://t/api/bills/b1/confirm', { status: 'maybe' }),
      ctx('b1'),
    );
    expect(res.status).toBe(400);
  });
});

describe('POST /api/runway/recalculate (authed)', () => {
  it('401 when unauthenticated and not demo', async () => {
    h.getUserFromRequest.mockResolvedValue(null);
    expect((await recalculate(post('http://t/api/runway/recalculate'))).status).toBe(401);
  });

  it('recomputes from the DB and returns the snapshot', async () => {
    h.getUserFromRequest.mockResolvedValue(authed);
    h.recompute.mockResolvedValue({ status: 'ok', snapshot: { safeToSpend: 700 } });
    const res = await recalculate(post('http://t/api/runway/recalculate'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.source).toBe('db');
    expect(body.snapshot.safeToSpend).toBe(700);
    expect(h.recompute).toHaveBeenCalledWith('user-A');
  });

  it('surfaces needs_schedule', async () => {
    h.getUserFromRequest.mockResolvedValue(authed);
    h.recompute.mockResolvedValue({ status: 'needs_schedule' });
    const body = await (await recalculate(post('http://t/api/runway/recalculate'))).json();
    expect(body.status).toBe('needs_schedule');
    expect(body.snapshot).toBeNull();
  });
});

describe('GET /api/runway/current', () => {
  it('401 when unauthenticated', async () => {
    h.getUserFromRequest.mockResolvedValue(null);
    expect((await runwayCurrent(get('http://t/api/runway/current'))).status).toBe(401);
  });

  it('returns needs_data when no snapshot exists', async () => {
    h.getUserFromRequest.mockResolvedValue(authed);
    h.snapshotGetLatest.mockResolvedValue(null);
    const body = await (await runwayCurrent(get('http://t/api/runway/current'))).json();
    expect(body.status).toBe('needs_data');
    expect(body.snapshot).toBeNull();
  });

  it('returns the mapped latest snapshot with freshness', async () => {
    h.getUserFromRequest.mockResolvedValue(authed);
    h.snapshotGetLatest.mockResolvedValue(snapshotRow);
    const body = await (await runwayCurrent(get('http://t/api/runway/current'))).json();
    expect(body.snapshot.safeToSpend).toBe(610);
    expect(body.snapshot.lastUpdatedAt).toBe('2026-06-20T09:00:00.000Z');
    expect(body.snapshot).toHaveProperty('isStale');
  });
});

describe('GET /api/widget/snapshot (authed)', () => {
  it('401 when unauthenticated and not demo', async () => {
    h.getUserFromRequest.mockResolvedValue(null);
    expect((await widgetSnapshot(get('http://t/api/widget/snapshot'))).status).toBe(401);
  });

  it('returns the cached widget view, hiding amounts in privacy mode', async () => {
    h.getUserFromRequest.mockResolvedValue(authed);
    h.snapshotGetLatest.mockResolvedValue(snapshotRow);
    const body = await (await widgetSnapshot(get('http://t/api/widget/snapshot?privacy=1'))).json();
    expect(body.widget.privacyMode).toBe(true);
    expect(body.widget.safeToSpend).toBeNull();
    expect(body.widget.riskLevel).toBe('safe');
  });
});
