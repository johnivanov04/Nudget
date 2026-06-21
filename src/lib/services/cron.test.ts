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
  enabled: true,
  morningEnabled: true,
  ...over,
});

// 2026-06-20T15:00Z = 08:00 in Los Angeles, 11:00 in New York, 00:00 in Tokyo (+1d).
const NOW = new Date('2026-06-20T15:00:00.000Z');

describe('selectDueUsers', () => {
  it('selects users whose morning hour matches the current local hour', () => {
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
