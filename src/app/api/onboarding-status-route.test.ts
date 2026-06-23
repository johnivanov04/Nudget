import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const h = vi.hoisted(() => ({
  getUserFromRequest: vi.fn(),
  profileGet: vi.fn(),
  scheduleGet: vi.fn(),
  itemsList: vi.fn(),
}));

vi.mock('@/lib/api/auth', () => ({ getUserFromRequest: h.getUserFromRequest }));
vi.mock('@/lib/db/repositories', () => ({
  profilesRepo: { getById: h.profileGet },
  paycheckSchedulesRepo: { getByUser: h.scheduleGet },
  plaidItemsRepo: { listByUser: h.itemsList },
}));

import { GET as onboardingStatus } from './onboarding/status/route';

const get = () => new NextRequest('http://t/api/onboarding/status', { headers: { authorization: 'Bearer t' } });

beforeEach(() => vi.clearAllMocks());

describe('GET /api/onboarding/status', () => {
  it('401 when unauthenticated', async () => {
    h.getUserFromRequest.mockResolvedValue(null);
    expect((await onboardingStatus(get())).status).toBe(401);
  });

  it('reports each step independently and complete=false until all done', async () => {
    h.getUserFromRequest.mockResolvedValue({ userId: 'user-A', email: null });
    h.profileGet.mockResolvedValue({ privacy_acknowledged_at: '2026-06-20T00:00:00Z' });
    h.scheduleGet.mockResolvedValue({ id: 's1' });
    h.itemsList.mockResolvedValue([]); // no bank yet
    const body = await (await onboardingStatus(get())).json();
    expect(body).toEqual({
      privacyAcknowledged: true,
      hasPaydaySchedule: true,
      hasLinkedBank: false,
      complete: false,
    });
  });

  it('complete=true when privacy + payday + bank all present', async () => {
    h.getUserFromRequest.mockResolvedValue({ userId: 'user-A', email: null });
    h.profileGet.mockResolvedValue({ privacy_acknowledged_at: '2026-06-20T00:00:00Z' });
    h.scheduleGet.mockResolvedValue({ id: 's1' });
    h.itemsList.mockResolvedValue([{ id: 'item1' }]);
    const body = await (await onboardingStatus(get())).json();
    expect(body.complete).toBe(true);
  });

  it('all false for a brand-new user', async () => {
    h.getUserFromRequest.mockResolvedValue({ userId: 'user-A', email: null });
    h.profileGet.mockResolvedValue({ privacy_acknowledged_at: null });
    h.scheduleGet.mockResolvedValue(null);
    h.itemsList.mockResolvedValue([]);
    const body = await (await onboardingStatus(get())).json();
    expect(body).toEqual({
      privacyAcknowledged: false,
      hasPaydaySchedule: false,
      hasLinkedBank: false,
      complete: false,
    });
  });
});
