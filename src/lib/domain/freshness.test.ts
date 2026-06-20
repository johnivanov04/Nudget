import { describe, it, expect } from 'vitest';
import { dataFreshness } from './freshness';

describe('dataFreshness', () => {
  it('reports fresh data within the window', () => {
    const r = dataFreshness({
      lastUpdatedAt: '2026-06-20T09:00:00.000Z',
      now: '2026-06-20T10:00:00.000Z',
      staleAfterMinutes: 360,
    });
    expect(r).toEqual({ hasData: true, ageMinutes: 60, isStale: false });
  });

  it('flags data older than the stale window', () => {
    const r = dataFreshness({
      lastUpdatedAt: '2026-06-20T00:00:00.000Z',
      now: '2026-06-20T07:00:00.000Z',
      staleAfterMinutes: 360, // 6h; data is 7h old
    });
    expect(r.isStale).toBe(true);
    expect(r.ageMinutes).toBe(420);
  });

  it('EDGE: treats missing data as stale with no age', () => {
    const r = dataFreshness({ lastUpdatedAt: null, now: '2026-06-20T07:00:00.000Z' });
    expect(r).toEqual({ hasData: false, ageMinutes: null, isStale: true });
  });

  it('EDGE: never reports a negative age (clock skew)', () => {
    const r = dataFreshness({
      lastUpdatedAt: '2026-06-20T10:05:00.000Z',
      now: '2026-06-20T10:00:00.000Z',
    });
    expect(r.ageMinutes).toBe(0);
  });

  it('FAILURE: throws on invalid timestamps', () => {
    expect(() =>
      dataFreshness({ lastUpdatedAt: 'not-a-date', now: '2026-06-20T10:00:00Z' }),
    ).toThrow(TypeError);
  });
});
