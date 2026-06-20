import { describe, it, expect } from 'vitest';
import { snapshotRowToView, snapshotRowToWidget } from './snapshotView';
import type { RunwaySnapshotRow } from '@/lib/db/types';

function row(over: Partial<RunwaySnapshotRow> = {}): RunwaySnapshotRow {
  return {
    id: 'snap1',
    user_id: 'u1',
    available_cash: 1200,
    spent_today: 28,
    bills_before_payday: 540,
    safe_to_spend: 610,
    daily_safe_spend: 46.92,
    risk_level: 'safe',
    payday_date: '2026-07-03',
    generated_at: '2026-06-20T09:00:00.000Z',
    ...over,
  };
}

const opts = { today: '2026-06-20', now: '2026-06-20T09:30:00.000Z' };

describe('snapshotRowToView', () => {
  it('maps a healthy snapshot and computes days-until-payday + freshness', () => {
    const v = snapshotRowToView(row(), opts);
    expect(v.status).toBe('ok');
    expect(v.safeToSpend).toBe(610);
    expect(v.daysUntilPayday).toBe(13);
    expect(v.lastUpdatedAt).toBe('2026-06-20T09:00:00.000Z');
    expect(v.isStale).toBe(false);
  });

  it('reports needs_data when safe_to_spend is null', () => {
    const v = snapshotRowToView(row({ safe_to_spend: null }), opts);
    expect(v.status).toBe('needs_data');
  });

  it('flags stale when the snapshot is old', () => {
    const v = snapshotRowToView(row({ generated_at: '2026-06-19T00:00:00.000Z' }), opts);
    expect(v.isStale).toBe(true);
  });
});

describe('snapshotRowToWidget', () => {
  it('exposes amounts when privacy mode is off', () => {
    const w = snapshotRowToWidget(row(), { ...opts, privacyMode: false });
    expect(w.safeToSpend).toBe(610);
    expect(w.privacyMode).toBe(false);
  });

  it('hides amounts in privacy mode but keeps risk + freshness', () => {
    const w = snapshotRowToWidget(row(), { ...opts, privacyMode: true });
    expect(w.safeToSpend).toBeNull();
    expect(w.spentToday).toBeNull();
    expect(w.riskLevel).toBe('safe');
    expect(w.daysUntilPayday).toBe(13);
  });

  it('hides amounts for needs_data regardless of privacy mode', () => {
    const w = snapshotRowToWidget(row({ safe_to_spend: null }), { ...opts, privacyMode: false });
    expect(w.status).toBe('needs_data');
    expect(w.safeToSpend).toBeNull();
  });
});
