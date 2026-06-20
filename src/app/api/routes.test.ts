/**
 * Route-handler tests.
 *
 * Auth-gated routes are tested with mocked auth + repositories so they run
 * without a database here. The DB-level behavior (RLS isolation, token safety,
 * real CRUD) is covered by the integration suite in tests/integration/*.itest.ts
 * (gated behind a local Supabase — see README).
 *
 * The public demo routes (widget/recalculate) run unmocked over seed data.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// --- mocks (hoisted) -------------------------------------------------------
vi.mock('@/lib/api/auth', () => ({ getUserFromRequest: vi.fn() }));
vi.mock('@/lib/db/repositories', () => ({
  profilesRepo: { getById: vi.fn() },
  paycheckSchedulesRepo: { upsert: vi.fn() },
  feedbackEventsRepo: { insert: vi.fn() },
  plaidItemsRepo: { removeOwned: vi.fn() },
}));
vi.mock('@/lib/supabase/admin', () => ({ getSupabaseAdmin: vi.fn() }));

import { getUserFromRequest } from '@/lib/api/auth';
import {
  profilesRepo,
  paycheckSchedulesRepo,
  feedbackEventsRepo,
  plaidItemsRepo,
} from '@/lib/db/repositories';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

import { GET as me } from './me/route';
import { POST as onboardingPaycheck } from './onboarding/paycheck/route';
import { POST as feedback } from './feedback/route';
import { DELETE as deleteAccount } from './account/route';
import { DELETE as disconnectItem } from './plaid/item/[id]/route';
import { POST as runwayRecalculate } from './runway/recalculate/route';
import { GET as widgetSnapshot } from './widget/snapshot/route';

const authed = { userId: 'user-A', email: 'a@b.com' };

function jsonReq(url: string, body: unknown, method = 'POST'): NextRequest {
  return new NextRequest(url, {
    method,
    headers: { 'content-type': 'application/json', authorization: 'Bearer t' },
    body: JSON.stringify(body),
  });
}
function bareReq(url: string, method = 'GET'): NextRequest {
  return new NextRequest(url, { method, headers: { authorization: 'Bearer t' } });
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ===========================================================================
// GET /api/me
// ===========================================================================
describe('GET /api/me', () => {
  it('401 when unauthenticated', async () => {
    vi.mocked(getUserFromRequest).mockResolvedValue(null);
    const res = await me(bareReq('http://t/api/me'));
    expect(res.status).toBe(401);
  });

  it('returns the mapped profile for the authenticated user', async () => {
    vi.mocked(getUserFromRequest).mockResolvedValue(authed);
    vi.mocked(profilesRepo.getById).mockResolvedValue({
      id: 'user-A',
      email: 'a@b.com',
      timezone: 'America/Los_Angeles',
      onboarding_completed: true,
      privacy_acknowledged_at: '2026-06-20T00:00:00.000Z',
      created_at: '',
      updated_at: '',
    });
    const res = await me(bareReq('http://t/api/me'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      id: 'user-A',
      email: 'a@b.com',
      timezone: 'America/Los_Angeles',
      onboardingCompleted: true,
      privacyAcknowledgedAt: '2026-06-20T00:00:00.000Z',
    });
    expect(profilesRepo.getById).toHaveBeenCalledWith('user-A');
  });

  it('500 when the profile row is missing', async () => {
    vi.mocked(getUserFromRequest).mockResolvedValue(authed);
    vi.mocked(profilesRepo.getById).mockResolvedValue(null);
    const res = await me(bareReq('http://t/api/me'));
    expect(res.status).toBe(500);
  });
});

// ===========================================================================
// POST /api/onboarding/paycheck
// ===========================================================================
describe('POST /api/onboarding/paycheck', () => {
  it('401 when unauthenticated', async () => {
    vi.mocked(getUserFromRequest).mockResolvedValue(null);
    const res = await onboardingPaycheck(
      jsonReq('http://t/api/onboarding/paycheck', {
        frequency: 'biweekly',
        lastPaycheckDate: '2026-06-05',
      }),
    );
    expect(res.status).toBe(401);
    expect(paycheckSchedulesRepo.upsert).not.toHaveBeenCalled();
  });

  it('400 for an invalid schedule', async () => {
    vi.mocked(getUserFromRequest).mockResolvedValue(authed);
    const res = await onboardingPaycheck(
      jsonReq('http://t/api/onboarding/paycheck', { frequency: 'hourly' }),
    );
    expect(res.status).toBe(400);
  });

  it('persists the schedule with the computed next payday', async () => {
    vi.mocked(getUserFromRequest).mockResolvedValue(authed);
    vi.mocked(paycheckSchedulesRepo.upsert).mockResolvedValue({
      id: 'sched-1',
      user_id: 'user-A',
      frequency: 'biweekly',
      last_paycheck_date: '2026-06-05',
      next_paycheck_date: '2026-07-03',
      weekend_rule: 'before',
      custom_rules: null,
      created_at: '',
      updated_at: '',
    });
    const res = await onboardingPaycheck(
      jsonReq('http://t/api/onboarding/paycheck', {
        frequency: 'biweekly',
        lastPaycheckDate: '2026-06-05',
        weekendRule: 'before',
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.persisted).toBe(true);
    expect(body.nextPaydays).toHaveLength(3);
    // The repo was called with the caller's id and a computed next_paycheck_date.
    const arg = vi.mocked(paycheckSchedulesRepo.upsert).mock.calls[0]![0];
    expect(arg.user_id).toBe('user-A');
    expect(arg.next_paycheck_date).toBe(body.nextPayday);
  });
});

// ===========================================================================
// POST /api/feedback
// ===========================================================================
describe('POST /api/feedback', () => {
  it('401 when unauthenticated', async () => {
    vi.mocked(getUserFromRequest).mockResolvedValue(null);
    const res = await feedback(jsonReq('http://t/api/feedback', { eventType: 'nudge_helpful' }));
    expect(res.status).toBe(401);
    expect(feedbackEventsRepo.insert).not.toHaveBeenCalled();
  });

  it('400 for invalid feedback', async () => {
    vi.mocked(getUserFromRequest).mockResolvedValue(authed);
    const res = await feedback(jsonReq('http://t/api/feedback', { eventType: 'spam' }));
    expect(res.status).toBe(400);
  });

  it('persists valid feedback scoped to the user', async () => {
    vi.mocked(getUserFromRequest).mockResolvedValue(authed);
    vi.mocked(feedbackEventsRepo.insert).mockResolvedValue({
      id: 'fb-1',
      user_id: 'user-A',
      event_type: 'nudge_helpful',
      event_id: null,
      rating: 5,
      free_text: null,
      created_at: '',
    });
    const res = await feedback(
      jsonReq('http://t/api/feedback', { eventType: 'nudge_helpful', rating: 5 }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toEqual({ id: 'fb-1', accepted: true, persisted: true });
    expect(vi.mocked(feedbackEventsRepo.insert).mock.calls[0]![0].user_id).toBe('user-A');
  });
});

// ===========================================================================
// DELETE /api/account
// ===========================================================================
describe('DELETE /api/account', () => {
  it('401 when unauthenticated', async () => {
    vi.mocked(getUserFromRequest).mockResolvedValue(null);
    const res = await deleteAccount(bareReq('http://t/api/account', 'DELETE'));
    expect(res.status).toBe(401);
  });

  it('deletes the auth user (cascades all data)', async () => {
    vi.mocked(getUserFromRequest).mockResolvedValue(authed);
    const deleteUser = vi.fn().mockResolvedValue({ error: null });
    vi.mocked(getSupabaseAdmin).mockReturnValue({
      auth: { admin: { deleteUser } },
    } as unknown as ReturnType<typeof getSupabaseAdmin>);

    const res = await deleteAccount(bareReq('http://t/api/account', 'DELETE'));
    expect(res.status).toBe(200);
    expect(deleteUser).toHaveBeenCalledWith('user-A');
    expect(await res.json()).toEqual({ deleted: true });
  });

  it('500 when deletion fails', async () => {
    vi.mocked(getUserFromRequest).mockResolvedValue(authed);
    const deleteUser = vi.fn().mockResolvedValue({ error: { message: 'boom' } });
    vi.mocked(getSupabaseAdmin).mockReturnValue({
      auth: { admin: { deleteUser } },
    } as unknown as ReturnType<typeof getSupabaseAdmin>);
    const res = await deleteAccount(bareReq('http://t/api/account', 'DELETE'));
    expect(res.status).toBe(500);
  });
});

// ===========================================================================
// DELETE /api/plaid/item/:id
// ===========================================================================
describe('DELETE /api/plaid/item/:id', () => {
  function ctx(id: string) {
    return { params: Promise.resolve({ id }) };
  }

  it('401 when unauthenticated', async () => {
    vi.mocked(getUserFromRequest).mockResolvedValue(null);
    const res = await disconnectItem(bareReq('http://t/api/plaid/item/i1', 'DELETE'), ctx('i1'));
    expect(res.status).toBe(401);
    expect(plaidItemsRepo.removeOwned).not.toHaveBeenCalled();
  });

  it('disconnects an item owned by the caller', async () => {
    vi.mocked(getUserFromRequest).mockResolvedValue(authed);
    vi.mocked(plaidItemsRepo.removeOwned).mockResolvedValue(true);
    const res = await disconnectItem(bareReq('http://t/api/plaid/item/i1', 'DELETE'), ctx('i1'));
    expect(res.status).toBe(200);
    expect(plaidItemsRepo.removeOwned).toHaveBeenCalledWith('user-A', 'i1');
    const body = await res.json();
    expect(body).toEqual({ disconnected: true, itemId: 'i1' });
    // Token safety at the API surface: the response carries no token field.
    expect(JSON.stringify(body)).not.toMatch(/token/i);
  });

  it('404 when the item is not owned by the caller', async () => {
    vi.mocked(getUserFromRequest).mockResolvedValue(authed);
    vi.mocked(plaidItemsRepo.removeOwned).mockResolvedValue(false);
    const res = await disconnectItem(
      bareReq('http://t/api/plaid/item/other', 'DELETE'),
      ctx('other'),
    );
    expect(res.status).toBe(404);
  });
});

// ===========================================================================
// Public demo routes (no auth) — unaffected by the mocks above
// ===========================================================================
describe('public demo routes', () => {
  it('POST /api/runway/recalculate?demo=1 returns a seed snapshot', async () => {
    const res = await runwayRecalculate(
      new NextRequest('http://t/api/runway/recalculate?demo=1', { method: 'POST' }),
    );
    expect(res.status).toBe(200);
    expect((await res.json()).source).toBe('seed');
  });

  it('GET /api/widget/snapshot?demo=1&privacy=1 hides amounts', async () => {
    const res = await widgetSnapshot(
      new NextRequest('http://t/api/widget/snapshot?demo=1&privacy=1', { method: 'GET' }),
    );
    const body = await res.json();
    expect(body.widget.privacyMode).toBe(true);
    expect(body.widget.safeToSpend).toBeNull();
    expect(body.widget.riskLevel).not.toBeNull();
  });
});
