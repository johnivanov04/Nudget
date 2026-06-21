/**
 * Lightweight fixed-window rate limiter.
 *
 * In-memory (per-instance) — fine as a basic guard for beta / single-instance,
 * and the interface is stable so a shared store (e.g. Upstash/Redis) can back it
 * in production without changing call sites. Deterministic via an injectable
 * `now`, so it is unit-testable.
 */
interface Bucket {
  count: number;
  resetAt: number;
}

const store = new Map<string, Bucket>();

export interface RateLimitOptions {
  limit: number;
  windowMs: number;
  now?: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

export function rateLimit(key: string, opts: RateLimitOptions): RateLimitResult {
  const now = opts.now ?? Date.now();
  const existing = store.get(key);

  if (!existing || now >= existing.resetAt) {
    const resetAt = now + opts.windowMs;
    store.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: opts.limit - 1, resetAt };
  }

  if (existing.count >= opts.limit) {
    return { allowed: false, remaining: 0, resetAt: existing.resetAt };
  }

  existing.count += 1;
  return { allowed: true, remaining: opts.limit - existing.count, resetAt: existing.resetAt };
}

/** Test helper: clear all buckets. */
export function __resetRateLimitStore(): void {
  store.clear();
}
