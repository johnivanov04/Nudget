/**
 * Pure projections of a persisted `runway_snapshots` row into the shapes the
 * dashboard and widget read. A null `safe_to_spend` means the snapshot was
 * computed without a usable balance, i.e. `needs_data`.
 *
 * Every view carries a last-updated timestamp + stale flag (a hard product
 * requirement: no financial number without freshness context).
 */
import { dataFreshness } from '@/lib/domain/freshness';
import { daysBetween, type IsoDate } from '@/lib/domain/dateUtils';
import type { RiskLevel } from '@/lib/domain/types';
import type { RunwaySnapshotRow } from '@/lib/db/types';

export interface RunwaySnapshotView {
  status: 'ok' | 'needs_data';
  availableCash: number | null;
  spentToday: number;
  billsBeforePayday: number;
  safeToSpend: number | null;
  dailySafeSpend: number | null;
  riskLevel: RiskLevel | null;
  paydayDate: string | null;
  daysUntilPayday: number | null;
  generatedAt: string;
  lastUpdatedAt: string;
  isStale: boolean;
}

interface ViewOptions {
  today: IsoDate;
  now: string;
  staleAfterMinutes?: number;
}

export function snapshotRowToView(row: RunwaySnapshotRow, opts: ViewOptions): RunwaySnapshotView {
  const fresh = dataFreshness({
    lastUpdatedAt: row.generated_at,
    now: opts.now,
    staleAfterMinutes: opts.staleAfterMinutes,
  });
  const daysUntilPayday = row.payday_date
    ? Math.max(0, daysBetween(opts.today, row.payday_date))
    : null;

  return {
    status: row.safe_to_spend === null ? 'needs_data' : 'ok',
    availableCash: row.available_cash,
    spentToday: row.spent_today,
    billsBeforePayday: row.bills_before_payday,
    safeToSpend: row.safe_to_spend,
    dailySafeSpend: row.daily_safe_spend,
    riskLevel: row.risk_level,
    paydayDate: row.payday_date,
    daysUntilPayday,
    generatedAt: row.generated_at,
    lastUpdatedAt: row.generated_at,
    isStale: fresh.isStale,
  };
}

export interface WidgetView {
  status: 'ok' | 'needs_data';
  privacyMode: boolean;
  riskLevel: RiskLevel | null;
  safeToSpend: number | null;
  spentToday: number | null;
  billsBeforePayday: number | null;
  paydayDate: string | null;
  daysUntilPayday: number | null;
  lastUpdatedAt: string;
  isStale: boolean;
}

export function snapshotRowToWidget(
  row: RunwaySnapshotRow,
  opts: ViewOptions & { privacyMode?: boolean },
): WidgetView {
  const view = snapshotRowToView(row, opts);
  const privacyMode = opts.privacyMode ?? false;
  const hide = privacyMode || view.status === 'needs_data';
  return {
    status: view.status,
    privacyMode,
    riskLevel: view.riskLevel,
    safeToSpend: hide ? null : view.safeToSpend,
    spentToday: hide ? null : view.spentToday,
    billsBeforePayday: hide ? null : view.billsBeforePayday,
    paydayDate: view.paydayDate,
    daysUntilPayday: view.daysUntilPayday,
    lastUpdatedAt: view.lastUpdatedAt,
    isStale: view.isStale,
  };
}
