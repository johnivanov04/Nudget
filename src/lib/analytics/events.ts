/**
 * Privacy-safe analytics event builders.
 *
 * These are the ONLY way the app should construct funnel events. Each builder
 * emits coarse, bucketed properties — never raw merchant names, account masks,
 * balances, transaction ids, or exact dollar amounts (enforced structurally by
 * `buildAnalyticsEvent`, which also drops any forbidden key defensively).
 *
 * `emitAnalytics` is the sink. There is no third-party provider wired yet, so it
 * is a documented no-op in production and logs in dev — swapping in a provider
 * later does not change any call site, because every event is already sanitized.
 */
import {
  buildAnalyticsEvent,
  bucketConfidence,
  bucketDaysUntilPayday,
  type AnalyticsEvent,
} from './sanitize';
import type { RiskLevel } from '@/lib/domain/types';

/** Coarse count buckets (e.g. linked accounts) — never the exact count. */
export function bucketCount(n: number): string {
  if (n <= 0) return '0';
  if (n === 1) return '1';
  if (n <= 3) return '2-3';
  if (n <= 6) return '4-6';
  return '7+';
}

export const analyticsEvents = {
  signupCompleted: (method: 'email' | 'apple'): AnalyticsEvent =>
    buildAnalyticsEvent('signup_completed', { method }),

  privacyAcknowledged: (version: string): AnalyticsEvent =>
    buildAnalyticsEvent('privacy_acknowledged', { version }),

  plaidLinkStarted: (platform: string): AnalyticsEvent =>
    buildAnalyticsEvent('plaid_link_started', { platform }),

  plaidLinkCompleted: (accountCount: number): AnalyticsEvent =>
    buildAnalyticsEvent('plaid_link_completed', {
      account_count_bucket: bucketCount(accountCount),
    }),

  paydayScheduleSaved: (frequency: string): AnalyticsEvent =>
    buildAnalyticsEvent('payday_schedule_saved', { frequency }),

  runwayViewed: (params: {
    riskLevel: RiskLevel | null;
    daysUntilPayday: number;
    isStale: boolean;
  }): AnalyticsEvent =>
    buildAnalyticsEvent('runway_viewed', {
      risk_level: params.riskLevel ?? 'unknown',
      days_until_payday_bucket: bucketDaysUntilPayday(params.daysUntilPayday),
      data_stale: params.isStale,
    }),

  billDecision: (params: {
    decision: 'confirmed' | 'rejected';
    confidence: number | null;
    cadence: string | null;
  }): AnalyticsEvent =>
    buildAnalyticsEvent(params.decision === 'confirmed' ? 'bill_confirmed' : 'bill_rejected', {
      cadence: params.cadence ?? 'unknown',
      confidence_bucket: bucketConfidence(params.confidence ?? 0),
    }),

  nudgeSent: (params: {
    nudgeType: string;
    riskLevel: RiskLevel | null;
    copyKey: string;
  }): AnalyticsEvent =>
    buildAnalyticsEvent('nudge_sent', {
      nudge_type: params.nudgeType,
      risk_level: params.riskLevel ?? 'unknown',
      copy_key: params.copyKey,
    }),

  nudgeFeedbackSubmitted: (params: { helpful: boolean; rating: number | null }): AnalyticsEvent =>
    buildAnalyticsEvent('nudge_feedback_submitted', {
      helpful: params.helpful,
      ...(params.rating !== null ? { rating: params.rating } : {}),
    }),

  outcomeReported: (outcomeType: string): AnalyticsEvent =>
    buildAnalyticsEvent('outcome_reported', { outcome_type: outcomeType }),
};

/**
 * Send a sanitized event to the analytics sink. No-op until a provider is wired
 * (Phase 8). Never throws — analytics must not break a user flow.
 */
export function emitAnalytics(event: AnalyticsEvent): void {
  if (process.env.NODE_ENV === 'development') {
    // eslint-disable-next-line no-console
    console.warn('[analytics]', event.event, JSON.stringify(event.properties));
  }
  // TODO(phase-8): forward `event` to the configured privacy-safe analytics provider.
}
