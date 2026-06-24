import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { RunwaySnapshot } from '@/lib/domain/snapshot';

const m = vi.hoisted(() => ({
  prefsGet: vi.fn(),
  compute: vi.fn(),
  listSentSince: vi.fn(),
  insert: vi.fn(),
}));

vi.mock('@/lib/db/repositories', () => ({
  notificationPreferencesRepo: { getByUser: m.prefsGet },
  nudgeEventsRepo: { listSentSince: m.listSentSince, insert: m.insert },
}));
vi.mock('@/lib/services/runway', () => ({ computeRunwayForUser: m.compute }));

import { planAndRecordNudges, preferencesRowToEngine } from './nudges';

const snapshot = (over: Partial<RunwaySnapshot> = {}): RunwaySnapshot =>
  ({
    status: 'ok',
    today: '2026-06-20',
    paydayDate: '2026-07-03',
    daysUntilPayday: 13,
    spentToday: 28,
    spentTodayHasPending: false,
    availableCash: 1200,
    confirmedBillsBeforePayday: 0,
    predictedBillsBeforePayday: 0,
    billsBeforePayday: 0,
    safeToSpend: 600,
    dailySafeSpend: 46,
    riskLevel: 'safe',
    riskReasonKey: 'on_track',
    lastUpdatedAt: '2026-06-20T09:00:00.000Z',
    isStale: false,
    ...over,
  }) as RunwaySnapshot;

const NOW = new Date('2026-06-20T15:00:00.000Z');

beforeEach(() => {
  vi.clearAllMocks();
  m.prefsGet.mockResolvedValue(null); // defaults (enabled)
  m.listSentSince.mockResolvedValue([]);
  m.insert.mockResolvedValue({});
  m.compute.mockResolvedValue({
    status: 'ok',
    today: '2026-06-20',
    snapshot: snapshot(),
    bills: [],
  });
});

describe('preferencesRowToEngine', () => {
  it('falls back to defaults when there is no row', () => {
    expect(preferencesRowToEngine(null).enabled).toBe(true);
  });
  it('maps snake_case columns to the engine shape', () => {
    const prefs = preferencesRowToEngine({
      user_id: 'u',
      enabled: true,
      morning_enabled: false,
      bill_approach_enabled: true,
      danger_enabled: true,
      tone: 'direct',
      morning_hour: 8,
      morning_minute: 0,
      allow_extra: true,
      created_at: '',
      updated_at: '',
    });
    expect(prefs).toMatchObject({ morningEnabled: false, tone: 'direct', allowExtra: true });
  });
});

describe('planAndRecordNudges', () => {
  it('records a morning nudge and returns it', async () => {
    const result = await planAndRecordNudges('u1', 'morning', NOW);
    expect(result.status).toBe('sent');
    expect(result.planned[0]!.type).toBe('morning_runway');
    expect(m.insert).toHaveBeenCalledOnce();
    expect(m.insert.mock.calls[0]![0]).toMatchObject({
      user_id: 'u1',
      type: 'morning_runway',
      copy_key: 'morning_runway.safe.gentle',
      sent_at: NOW.toISOString(),
    });
  });

  it('short-circuits when notifications are disabled (no compute, no insert)', async () => {
    m.prefsGet.mockResolvedValue({
      user_id: 'u1',
      enabled: false,
      morning_enabled: true,
      bill_approach_enabled: true,
      danger_enabled: true,
      tone: 'gentle',
      morning_hour: 8,
      allow_extra: false,
    });
    const result = await planAndRecordNudges('u1', 'morning', NOW);
    expect(result.status).toBe('disabled');
    expect(m.compute).not.toHaveBeenCalled();
    expect(m.insert).not.toHaveBeenCalled();
  });

  it('returns needs_data when there is no schedule/snapshot', async () => {
    m.compute.mockResolvedValue({
      status: 'needs_schedule',
      today: '2026-06-20',
      snapshot: null,
      bills: [],
    });
    const result = await planAndRecordNudges('u1', 'morning', NOW);
    expect(result.status).toBe('needs_data');
    expect(m.insert).not.toHaveBeenCalled();
  });

  it('respects throttling from today’s already-sent nudges', async () => {
    m.listSentSince.mockResolvedValue([{ type: 'morning_runway' }]);
    const result = await planAndRecordNudges('u1', 'morning', NOW);
    expect(result.status).toBe('none');
    expect(m.insert).not.toHaveBeenCalled();
    // Throttle window starts at the user's local midnight.
    expect(m.listSentSince).toHaveBeenCalledWith('u1', '2026-06-20T00:00:00.000Z');
  });
});
