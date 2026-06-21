/**
 * Route tests for the cron morning-nudges endpoint and the privacy-ack endpoint.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const h = vi.hoisted(() => ({
  getEnv: vi.fn(),
  runMorningNudges: vi.fn(),
  getUserFromRequest: vi.fn(),
  markPrivacyAck: vi.fn(),
}));

vi.mock('@/lib/env', () => ({ getEnv: h.getEnv }));
vi.mock('@/lib/services/cron', () => ({ runMorningNudges: h.runMorningNudges }));
// Keep the real module (extractBearerToken is used by cronAuth); override only getUserFromRequest.
vi.mock('@/lib/api/auth', async (orig) => ({
  ...(await orig<typeof import('@/lib/api/auth')>()),
  getUserFromRequest: h.getUserFromRequest,
}));
vi.mock('@/lib/db/repositories', () => ({
  profilesRepo: { markPrivacyAcknowledged: h.markPrivacyAck },
}));

import { GET as cronMorning } from './cron/morning-nudges/route';
import { POST as privacyAck } from './onboarding/privacy/route';

const cronReq = (auth?: string) =>
  new NextRequest('http://t/api/cron/morning-nudges', {
    headers: auth ? { authorization: auth } : {},
  });
const authedReq = () =>
  new NextRequest('http://t/api/onboarding/privacy', {
    method: 'POST',
    headers: { authorization: 'Bearer t' },
  });

beforeEach(() => {
  vi.clearAllMocks();
  h.getEnv.mockReturnValue({ CRON_SECRET: 'cron-secret' });
});

describe('GET /api/cron/morning-nudges', () => {
  it('401 without the correct cron secret', async () => {
    const res = await cronMorning(cronReq('Bearer wrong'));
    expect(res.status).toBe(401);
    expect(h.runMorningNudges).not.toHaveBeenCalled();
  });

  it('runs the morning-nudge batch with a valid secret', async () => {
    h.runMorningNudges.mockResolvedValue({ candidates: 5, due: 2, sent: 2 });
    const res = await cronMorning(cronReq('Bearer cron-secret'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ candidates: 5, due: 2, sent: 2 });
  });

  it('500 (not 200) if the batch throws', async () => {
    h.runMorningNudges.mockRejectedValue(new Error('db down'));
    const res = await cronMorning(cronReq('Bearer cron-secret'));
    expect(res.status).toBe(500);
  });
});

describe('POST /api/onboarding/privacy', () => {
  it('401 when unauthenticated', async () => {
    h.getUserFromRequest.mockResolvedValue(null);
    expect((await privacyAck(authedReq())).status).toBe(401);
  });

  it('records the acknowledgement for the caller', async () => {
    h.getUserFromRequest.mockResolvedValue({ userId: 'user-A', email: null });
    h.markPrivacyAck.mockResolvedValue(undefined);
    const res = await privacyAck(authedReq());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ acknowledged: true });
    expect(h.markPrivacyAck).toHaveBeenCalledWith('user-A');
  });
});
