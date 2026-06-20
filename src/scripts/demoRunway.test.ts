/**
 * Runway demo + seed-pipeline integration check.
 *
 * Run the human-readable demo:   npm run demo:runway
 * It also runs as part of `npm test` (quietly) to prove the seed data flows all
 * the way through the engine without Plaid or a database.
 */
import { describe, it, expect } from 'vitest';
import { buildRunwaySnapshot } from '@/lib/domain/snapshot';
import { toWidgetSnapshot } from '@/lib/domain/widget';
import { mockSnapshotInput } from '@/lib/mock/seedData';

const VERBOSE = process.env.NUDGET_DEMO === '1';

function printDemo(): void {
  const s = buildRunwaySnapshot(mockSnapshotInput);
  const widgetPrivate = toWidgetSnapshot(s, { privacyMode: true });

  const fmt = (n: number | null) => (n === null ? '—' : `$${n.toFixed(2)}`);
  const lines = [
    '',
    '┌──────────────────────────────────────────────┐',
    '│  Nudget — runway snapshot (mock seed data)     │',
    '└──────────────────────────────────────────────┘',
    `  Today:              ${s.today}`,
    `  Next payday:        ${s.paydayDate}  (${s.daysUntilPayday} days)`,
    `  Spent today:        ${fmt(s.spentToday)}${s.spentTodayHasPending ? '  (incl. pending)' : ''}`,
    `  Available cash:     ${fmt(s.availableCash)}`,
    `  Bills before payday:${' '}${fmt(s.billsBeforePayday)}  (confirmed ${fmt(
      s.confirmedBillsBeforePayday,
    )} + predicted ${fmt(s.predictedBillsBeforePayday)})`,
    `  ──────────────────────────────────────────────`,
    `  SAFE TO SPEND:      ${fmt(s.safeToSpend)}`,
    `  Daily safe spend:   ${fmt(s.dailySafeSpend)}`,
    `  Risk level:         ${s.riskLevel?.toUpperCase()} (${s.riskReasonKey})`,
    `  Last updated:       ${s.lastUpdatedAt}  ${s.isStale ? '[STALE]' : '[fresh]'}`,
    '',
    `  Lock-screen (privacy mode): risk=${widgetPrivate.riskLevel}, amount hidden=${
      widgetPrivate.safeToSpend === null
    }`,
    '',
  ];
  // eslint-disable-next-line no-console
  console.log(lines.join('\n'));
}

describe('runway demo (seed pipeline)', () => {
  it('computes a sensible snapshot from seed data without Plaid/DB', () => {
    const s = buildRunwaySnapshot(mockSnapshotInput);
    // 1842.55 - (1200 + 85 confirmed + 39.99 predicted) - 100 buffer = 417.56
    expect(s.status).toBe('ok');
    expect(s.paydayDate).toBe('2026-07-03');
    expect(s.spentToday).toBe(87.64); // 14.25 + 63.40 + 9.99
    expect(s.confirmedBillsBeforePayday).toBe(1285);
    expect(s.predictedBillsBeforePayday).toBe(39.99);
    expect(s.safeToSpend).toBe(417.56);
    expect(s.spentTodayHasPending).toBe(true);
    expect(['safe', 'caution', 'danger']).toContain(s.riskLevel);
    if (VERBOSE) printDemo();
  });
});
