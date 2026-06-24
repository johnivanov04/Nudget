import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NudgeCandidate } from '@/lib/db/repositories';

const m = vi.hoisted(() => ({
  listCandidates: vi.fn(),
  planAndRecord: vi.fn(),
}));

vi.mock('@/lib/db/repositories', () => ({
  notificationPreferencesRepo: { listNudgeCandidates: m.listCandidates },
}));
vi.mock('@/lib/services/nudges', () => ({ planAndRecordNudges: m.planAndRecord }));

import { selectDueUsers, runMorningNudges } from './cron';

const cand = (over: Partial<NudgeCandidate>): NudgeCandidate => ({
  userId: 'u',
  timezone: 'America/Los_Angeles',
  morningHour: 8,
  morningMinute: 0,
  enabled: true,
  morningEnabled: true,
  ...over,
});

// 2026-06-20T15:00Z = 08:00 in Los Angeles, 11:00 in New York, 00:00 in Tokyo (+1d).
const NOW = new Date('2026-06-20T15:00:00.000Z');

describe('selectDueUsers', () => {
  it('selects users whose morning time matches the current local hour', () => {
    const due = selectDueUsers(
      [
        cand({ userId: 'la-8', timezone: 'America/Los_Angeles', morningHour: 8 }), // due
        cand({ userId: 'la-9', timezone: 'America/Los_Angeles', morningHour: 9 }), // not yet
        cand({ userId: 'ny-11', timezone: 'America/New_York', morningHour: 11 }), // due
        cand({ userId: 'tokyo-0', timezone: 'Asia/Tokyo', morningHour: 0 }), // due
      ],
      NOW,
    );
    expect(due.sort()).toEqual(['la-8', 'ny-11', 'tokyo-0']);
  });

  it('honors minute precision within the catch-up window', () => {
    // 2026-06-20T15:35Z = 08:35 in Los Angeles.
    const now835 = new Date('2026-06-20T15:35:00.000Z');
    const due = selectDueUsers(
      [
        cand({ userId: 'exact-835', morningHour: 8, morningMinute: 35 }), // due (exact)
        cand({ userId: 'caught-830', morningHour: 8, morningMinute: 30 }), // due (5 min ago, in window)
        cand({ userId: 'missed-820', morningHour: 8, morningMinute: 20 }), // not due (>15 min ago)
        cand({ userId: 'future-840', morningHour: 8, morningMinute: 40 }), // not due (not yet)
        cand({ userId: 'top-of-hour', morningHour: 8, morningMinute: 0 }), // not due (35 min ago)
      ],
      now835,
    );
    expect(due.sort()).toEqual(['caught-830', 'exact-835']);
  });

  it('skips disabled users', () => {
    const due = selectDueUsers(
      [
        cand({ userId: 'off', enabled: false }),
        cand({ userId: 'no-morning', morningEnabled: false }),
      ],
      NOW,
    );
    expect(due).toEqual([]);
  });
});

describe('runMorningNudges', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.planAndRecord.mockResolvedValue({ status: 'sent', planned: [{}] });
  });

  it('fires nudges for due users and tallies results', async () => {
    m.listCandidates.mockResolvedValue([
      cand({ userId: 'la-8', morningHour: 8 }),
      cand({ userId: 'la-9', morningHour: 9 }), // not due
    ]);
    const result = await runMorningNudges(NOW);
    expect(result).toEqual({ candidates: 2, due: 1, sent: 1 });
    expect(m.planAndRecord).toHaveBeenCalledTimes(1);
    expect(m.planAndRecord).toHaveBeenCalledWith('la-8', 'morning', NOW);
  });

  it('one user failing does not abort the batch', async () => {
    m.listCandidates.mockResolvedValue([
      cand({ userId: 'a', morningHour: 8 }),
      cand({ userId: 'b', morningHour: 8 }),
    ]);
    m.planAndRecord.mockRejectedValueOnce(new Error('boom')); // a fails
    m.planAndRecord.mockResolvedValueOnce({ status: 'sent', planned: [{}] }); // b ok
    const result = await runMorningNudges(NOW);
    expect(result.due).toBe(2);
    expect(result.sent).toBe(1); // only b counted
  });
});
