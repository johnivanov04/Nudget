/**
 * Route-handler tests for the Phase-5 notification + admin endpoints (mocked
 * auth, repositories, and services).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const h = vi.hoisted(() => ({
  getUserFromRequest: vi.fn(),
  deviceRegister: vi.fn(),
  prefsGet: vi.fn(),
  prefsUpsert: vi.fn(),
  previewNudges: vi.fn(),
  adminMetrics: vi.fn(),
  getEnv: vi.fn(),
}));

vi.mock('@/lib/api/auth', () => ({ getUserFromRequest: h.getUserFromRequest }));
vi.mock('@/lib/db/repositories', () => ({
  deviceTokensRepo: { register: h.deviceRegister },
  notificationPreferencesRepo: { getByUser: h.prefsGet, upsert: h.prefsUpsert },
  adminRepo: { metrics: h.adminMetrics },
}));
vi.mock('@/lib/services/nudges', () => ({ previewNudges: h.previewNudges }));
vi.mock('@/lib/env', () => ({ getEnv: h.getEnv }));

import { POST as deviceRegister } from './device/register/route';
import { GET as prefsGet, POST as prefsPost } from './nudges/preferences/route';
import { POST as testNudge } from './nudges/test/route';
import { GET as adminMetrics } from './admin/metrics/route';

const authed = { userId: 'user-A', email: 'a@b.com' };

function post(url: string, body?: unknown): NextRequest {
  return new NextRequest(url, {
    method: 'POST',
    headers: { authorization: 'Bearer t' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
const get = (url: string) => new NextRequest(url, { headers: { authorization: 'Bearer t' } });

const prefsRow = {
  user_id: 'user-A',
  enabled: true,
  morning_enabled: true,
  bill_approach_enabled: true,
  danger_enabled: true,
  tone: 'gentle',
  morning_hour: 8,
  morning_minute: 30,
  allow_extra: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  h.getEnv.mockReturnValue({ ADMIN_USER_IDS: 'user-A' });
});

describe('POST /api/device/register', () => {
  it('401 when unauthenticated', async () => {
    h.getUserFromRequest.mockResolvedValue(null);
    expect(
      (await deviceRegister(post('http://t/api/device/register', { deviceToken: 'x' }))).status,
    ).toBe(401);
  });

  it('400 when deviceToken is missing', async () => {
    h.getUserFromRequest.mockResolvedValue(authed);
    expect((await deviceRegister(post('http://t/api/device/register', {}))).status).toBe(400);
  });

  it('registers the token and never echoes it back', async () => {
    h.getUserFromRequest.mockResolvedValue(authed);
    h.deviceRegister.mockResolvedValue({ id: 'd1' });
    const res = await deviceRegister(
      post('http://t/api/device/register', { deviceToken: 'apns-raw-token-SECRET' }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(JSON.stringify(body)).not.toContain('SECRET');
    expect(h.deviceRegister).toHaveBeenCalledWith({
      userId: 'user-A',
      rawToken: 'apns-raw-token-SECRET',
      platform: 'ios',
    });
  });
});

describe('GET/POST /api/nudges/preferences', () => {
  it('GET returns defaults when none saved', async () => {
    h.getUserFromRequest.mockResolvedValue(authed);
    h.prefsGet.mockResolvedValue(null);
    const body = await (await prefsGet(get('http://t/api/nudges/preferences'))).json();
    expect(body.preferences).toMatchObject({ enabled: true, tone: 'gentle', morningHour: 8 });
  });

  it('GET maps a saved row to the client shape', async () => {
    h.getUserFromRequest.mockResolvedValue(authed);
    h.prefsGet.mockResolvedValue({ ...prefsRow, morning_enabled: false, tone: 'direct' });
    const body = await (await prefsGet(get('http://t/api/nudges/preferences'))).json();
    expect(body.preferences.morningEnabled).toBe(false);
    expect(body.preferences.tone).toBe('direct');
    expect(body.preferences.morningMinute).toBe(30);
  });

  it('POST persists morningHour + morningMinute', async () => {
    h.getUserFromRequest.mockResolvedValue(authed);
    h.prefsUpsert.mockResolvedValue({ ...prefsRow, morning_hour: 8, morning_minute: 35 });
    await prefsPost(post('http://t/api/nudges/preferences', { morningHour: 8, morningMinute: 35 }));
    expect(h.prefsUpsert.mock.calls[0]![0]).toEqual({
      user_id: 'user-A',
      morning_hour: 8,
      morning_minute: 35,
    });
  });

  it('POST upserts only the provided fields', async () => {
    h.getUserFromRequest.mockResolvedValue(authed);
    h.prefsUpsert.mockResolvedValue({ ...prefsRow, tone: 'minimal' });
    const res = await prefsPost(post('http://t/api/nudges/preferences', { tone: 'minimal' }));
    expect(res.status).toBe(200);
    expect(h.prefsUpsert.mock.calls[0]![0]).toEqual({ user_id: 'user-A', tone: 'minimal' });
  });

  it('POST 400 on an invalid tone', async () => {
    h.getUserFromRequest.mockResolvedValue(authed);
    expect(
      (await prefsPost(post('http://t/api/nudges/preferences', { tone: 'loud' }))).status,
    ).toBe(400);
  });
});

describe('POST /api/nudges/test', () => {
  it('401 when unauthenticated', async () => {
    h.getUserFromRequest.mockResolvedValue(null);
    expect((await testNudge(post('http://t/api/nudges/test'))).status).toBe(401);
  });

  it('returns a preview without recording', async () => {
    h.getUserFromRequest.mockResolvedValue(authed);
    h.previewNudges.mockResolvedValue([
      { type: 'morning_runway', copyKey: 'morning_runway.safe.gentle', riskLevel: 'safe' },
    ]);
    const body = await (
      await testNudge(post('http://t/api/nudges/test', { occasion: 'morning' }))
    ).json();
    expect(body.planned[0].copyKey).toBe('morning_runway.safe.gentle');
    expect(body.note).toMatch(/preview only/);
    expect(h.previewNudges).toHaveBeenCalledWith('user-A', 'morning');
  });
});

describe('GET /api/admin/metrics', () => {
  it('401 when unauthenticated', async () => {
    h.getUserFromRequest.mockResolvedValue(null);
    expect((await adminMetrics(get('http://t/api/admin/metrics'))).status).toBe(401);
  });

  it('403 when the user is not an admin', async () => {
    h.getUserFromRequest.mockResolvedValue({ userId: 'user-Z', email: null });
    const res = await adminMetrics(get('http://t/api/admin/metrics'));
    expect(res.status).toBe(403);
    expect(h.adminMetrics).not.toHaveBeenCalled();
  });

  it('returns aggregate metrics for an admin', async () => {
    h.getUserFromRequest.mockResolvedValue(authed); // user-A is in ADMIN_USER_IDS
    h.adminMetrics.mockResolvedValue({
      users: { total: 10, onboarded: 7 },
      plaidItems: { total: 8, active: 7, loginRequired: 1, error: 0 },
      bills: { candidate: 12, confirmed: 5, rejected: 2 },
      nudges: { sent: 30 },
    });
    const res = await adminMetrics(get('http://t/api/admin/metrics'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.metrics.users.onboarded).toBe(7);
    // Sanity: the payload is counts only — no raw financial fields.
    expect(JSON.stringify(body)).not.toMatch(/merchant|balance|amount|token/i);
  });
});
