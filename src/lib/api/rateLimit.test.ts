import { describe, it, expect, beforeEach } from 'vitest';
import { rateLimit, __resetRateLimitStore } from './rateLimit';

beforeEach(() => __resetRateLimitStore());

describe('rateLimit', () => {
  it('allows up to the limit, then blocks within the window', () => {
    const opts = { limit: 3, windowMs: 60_000, now: 1000 };
    expect(rateLimit('k', opts).allowed).toBe(true); // 1
    expect(rateLimit('k', opts).allowed).toBe(true); // 2
    const third = rateLimit('k', opts);
    expect(third).toMatchObject({ allowed: true, remaining: 0 });
    expect(rateLimit('k', opts).allowed).toBe(false); // 4 -> blocked
  });

  it('resets after the window elapses', () => {
    rateLimit('k', { limit: 1, windowMs: 1000, now: 0 });
    expect(rateLimit('k', { limit: 1, windowMs: 1000, now: 500 }).allowed).toBe(false);
    expect(rateLimit('k', { limit: 1, windowMs: 1000, now: 1001 }).allowed).toBe(true);
  });

  it('tracks keys independently', () => {
    expect(rateLimit('a', { limit: 1, windowMs: 1000, now: 0 }).allowed).toBe(true);
    expect(rateLimit('b', { limit: 1, windowMs: 1000, now: 0 }).allowed).toBe(true);
    expect(rateLimit('a', { limit: 1, windowMs: 1000, now: 0 }).allowed).toBe(false);
  });
});
