/**
 * Widget snapshot projection.
 *
 * The widget consumes a *minimal* view of the runway snapshot. In privacy mode
 * (the lock-screen default per spec) dollar amounts are hidden and only the risk
 * state + last-updated context are exposed. Every widget payload carries a
 * last-updated/stale signal because the widget can render cached data.
 */
import type { RunwaySnapshot } from './snapshot';
import type { RiskLevel } from './types';

export interface WidgetSnapshot {
  status: 'ok' | 'needs_data';
  privacyMode: boolean;
  riskLevel: RiskLevel | null;
  riskReasonKey: string | null;
  /** Null when hidden by privacy mode or when there is no balance yet. */
  safeToSpend: number | null;
  spentToday: number | null;
  billsBeforePayday: number | null;
  paydayDate: string;
  daysUntilPayday: number;
  lastUpdatedAt: string | null;
  isStale: boolean;
}

export function toWidgetSnapshot(
  snapshot: RunwaySnapshot,
  options: { privacyMode?: boolean } = {},
): WidgetSnapshot {
  const privacyMode = options.privacyMode ?? false;
  const hideMoney = privacyMode || snapshot.status === 'needs_data';

  return {
    status: snapshot.status,
    privacyMode,
    riskLevel: snapshot.riskLevel,
    riskReasonKey: snapshot.riskReasonKey,
    safeToSpend: hideMoney ? null : snapshot.safeToSpend,
    spentToday: hideMoney ? null : snapshot.spentToday,
    billsBeforePayday: hideMoney ? null : snapshot.billsBeforePayday,
    paydayDate: snapshot.paydayDate,
    daysUntilPayday: snapshot.daysUntilPayday,
    lastUpdatedAt: snapshot.lastUpdatedAt,
    isStale: snapshot.isStale,
  };
}
