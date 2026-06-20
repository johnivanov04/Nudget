/**
 * Route-handler tests for the endpoints that carry real Phase-1 logic. These
 * exercise validation + the engine over the actual HTTP handler surface.
 *
 * The remaining endpoints are intentional `501` stubs with documented TODOs in
 * each route file; they are covered by the underlying domain/service tests and
 * will gain handler tests when their persistence/Plaid logic lands.
 */
import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';

import { POST as onboardingPaycheck } from './onboarding/paycheck/route';
import { POST as runwayRecalculate } from './runway/recalculate/route';
import { GET as widgetSnapshot } from './widget/snapshot/route';
import { POST as feedback } from './feedback/route';
import { GET as me } from './me/route';

function jsonRequest(url: string, body: unknown): NextRequest {
  return new NextRequest(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/onboarding/paycheck', () => {
  it('returns a payday preview for a valid schedule', async () => {
    const res = await onboardingPaycheck(
      jsonRequest('http://t/api/onboarding/paycheck', {
        frequency: 'biweekly',
        lastPaycheckDate: '2026-06-05',
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.nextPaydays).toHaveLength(3);
    expect(body.nextPayday).toBe(body.nextPaydays[0]);
    expect(body.persisted).toBe(false);
  });

  it('returns 400 for an invalid schedule', async () => {
    const res = await onboardingPaycheck(
      jsonRequest('http://t/api/onboarding/paycheck', { frequency: 'hourly' }),
    );
    expect(res.status).toBe(400);
  });
});

describe('POST /api/runway/recalculate', () => {
  it('computes a snapshot from a posted scenario', async () => {
    const res = await runwayRecalculate(
      jsonRequest('http://t/api/runway/recalculate', {
        today: '2026-06-20',
        availableCash: 1000,
        bills: [{ amountEstimate: 400, nextExpectedDate: '2026-06-25', status: 'confirmed' }],
        schedule: { frequency: 'biweekly', lastPaycheckDate: '2026-06-05' },
        safetyBuffer: 100,
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.source).toBe('request');
    expect(body.snapshot.safeToSpend).toBe(500);
  });

  it('supports ?demo=1 using seed data', async () => {
    const req = new NextRequest('http://t/api/runway/recalculate?demo=1', { method: 'POST' });
    const res = await runwayRecalculate(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.source).toBe('seed');
    expect(body.snapshot.status).toBe('ok');
  });

  it('returns 400 for an invalid payload', async () => {
    const res = await runwayRecalculate(
      jsonRequest('http://t/api/runway/recalculate', { today: 'nope' }),
    );
    expect(res.status).toBe(400);
  });
});

describe('GET /api/widget/snapshot', () => {
  it('returns a seed widget snapshot in demo mode', async () => {
    const req = new NextRequest('http://t/api/widget/snapshot?demo=1', { method: 'GET' });
    const res = await widgetSnapshot(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.widget.safeToSpend).not.toBeNull();
  });

  it('hides dollar amounts in privacy mode', async () => {
    const req = new NextRequest('http://t/api/widget/snapshot?demo=1&privacy=1', { method: 'GET' });
    const res = await widgetSnapshot(req);
    const body = await res.json();
    expect(body.widget.privacyMode).toBe(true);
    expect(body.widget.safeToSpend).toBeNull();
    expect(body.widget.riskLevel).not.toBeNull();
  });

  it('returns 501 without demo mode (not yet wired to DB)', async () => {
    const req = new NextRequest('http://t/api/widget/snapshot', { method: 'GET' });
    const res = await widgetSnapshot(req);
    expect(res.status).toBe(501);
  });
});

describe('POST /api/feedback', () => {
  it('accepts valid feedback (202, not yet persisted)', async () => {
    const res = await feedback(
      jsonRequest('http://t/api/feedback', { eventType: 'nudge_helpful', rating: 5 }),
    );
    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body.accepted).toBe(true);
    expect(body.persisted).toBe(false);
  });

  it('rejects invalid feedback', async () => {
    const res = await feedback(jsonRequest('http://t/api/feedback', { eventType: 'spam' }));
    expect(res.status).toBe(400);
  });
});

describe('stub routes', () => {
  it('GET /api/me returns 501 until auth is wired', async () => {
    const res = await me();
    expect(res.status).toBe(501);
    const body = await res.json();
    expect(body.error).toBe('not_implemented');
    expect(body.todo).toBeTruthy();
  });
});
