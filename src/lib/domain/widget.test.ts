import { describe, it, expect } from 'vitest';
import { toWidgetSnapshot } from './widget';
import { buildRunwaySnapshot } from './snapshot';
import { mockSnapshotInput } from '@/lib/mock/seedData';

describe('toWidgetSnapshot', () => {
  const snapshot = buildRunwaySnapshot(mockSnapshotInput);

  it('exposes amounts when privacy mode is off', () => {
    const w = toWidgetSnapshot(snapshot, { privacyMode: false });
    expect(w.safeToSpend).toBe(snapshot.safeToSpend);
    expect(w.spentToday).toBe(snapshot.spentToday);
    expect(w.privacyMode).toBe(false);
    expect(w.lastUpdatedAt).toBe(snapshot.lastUpdatedAt);
  });

  it('hides all dollar amounts in privacy mode but keeps risk + freshness', () => {
    const w = toWidgetSnapshot(snapshot, { privacyMode: true });
    expect(w.safeToSpend).toBeNull();
    expect(w.spentToday).toBeNull();
    expect(w.billsBeforePayday).toBeNull();
    expect(w.riskLevel).toBe(snapshot.riskLevel); // risk state still shown
    expect(w.paydayDate).toBe(snapshot.paydayDate);
    expect(w.isStale).toBe(snapshot.isStale);
  });

  it('hides amounts when there is no data regardless of privacy mode', () => {
    const needsData = buildRunwaySnapshot({ ...mockSnapshotInput, availableCash: null });
    const w = toWidgetSnapshot(needsData, { privacyMode: false });
    expect(w.status).toBe('needs_data');
    expect(w.safeToSpend).toBeNull();
  });
});
