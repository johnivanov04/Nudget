/**
 * Privacy-safe analytics.
 *
 * Hard requirement: analytics must NEVER include raw merchant names, account
 * masks, exact balances, transaction IDs, or exact dollar amounts. This module
 * centralizes that rule so every event passes through a sanitizer that:
 *   1. bucketizes dollar amounts into coarse ranges,
 *   2. bucketizes confidence into coarse bands,
 *   3. drops any forbidden keys defensively.
 *
 * Use `buildAnalyticsEvent` to construct events — do not hand-build them.
 */

/** Keys that must never appear in an analytics payload. */
const FORBIDDEN_KEYS = new Set([
  'merchant_name',
  'merchantName',
  'account_mask',
  'mask',
  'balance',
  'available_balance',
  'current_balance',
  'amount',
  'exact_amount',
  'transaction_id',
  'plaid_transaction_id',
  'plaid_access_token',
  'access_token',
  'email',
]);

/** Coarse dollar buckets — never the exact amount. */
export function bucketAmount(amount: number): string {
  const a = Math.abs(amount);
  if (a === 0) return '0';
  if (a < 10) return '<10';
  if (a < 25) return '10-25';
  if (a < 50) return '25-50';
  if (a < 100) return '50-100';
  if (a < 250) return '100-250';
  if (a < 500) return '250-500';
  if (a < 1000) return '500-1000';
  return '1000+';
}

/** Coarse confidence bands for bill predictions. */
export function bucketConfidence(confidence: number): 'low' | 'medium' | 'high' {
  if (confidence < 0.5) return 'low';
  if (confidence < 0.8) return 'medium';
  return 'high';
}

/** Coarse "days until payday" bands. */
export function bucketDaysUntilPayday(days: number): string {
  if (days <= 0) return '0';
  if (days <= 2) return '1-2';
  if (days <= 5) return '3-5';
  if (days <= 9) return '6-9';
  if (days <= 14) return '10-14';
  return '15+';
}

export interface AnalyticsEvent {
  event: string;
  properties: Record<string, string | number | boolean>;
}

/**
 * Build a sanitized analytics event. Any forbidden key in `properties` is
 * dropped (defense in depth); callers are expected to pass already-bucketed
 * values, but this guarantees nothing sensitive escapes even on a mistake.
 */
export function buildAnalyticsEvent(
  event: string,
  properties: Record<string, string | number | boolean> = {},
): AnalyticsEvent {
  const safe: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(properties)) {
    if (FORBIDDEN_KEYS.has(key)) continue;
    safe[key] = value;
  }
  return { event, properties: safe };
}

export { FORBIDDEN_KEYS };
