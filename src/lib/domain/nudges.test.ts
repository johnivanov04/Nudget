import { describe, it, expect } from 'vitest';
import {
  DEFAULT_NUDGE_PREFERENCES,
  planNudges,
  type NudgeContext,
  type NudgePreferences,
} from './nudges';
import type { RunwaySnapshot } from './snapshot';
import type { EngineBill } from './types';

function snapshot(over: Partial<RunwaySnapshot> = {}): RunwaySnapshot {
  return {
    status: 'ok',
    today: '2026-06-20',
    paydayDate: '2026-07-03',
    daysUntilPayday: 13,
    spentToday: 28,
    spentTodayHasPending: false,
    availableCash: 1200,
    confirmedBillsBeforePayday: 0,
    predictedBillsBeforePayday: 0,
    billsBeforePayday: 0,
    safeToSpend: 600,
    dailySafeSpend: 46,
    riskLevel: 'safe',
    riskReasonKey: 'on_track',
    lastUpdatedAt: '2026-06-20T09:00:00.000Z',
    isStale: false,
    ...over,
  };
}

function ctx(over: Partial<NudgeContext> = {}): NudgeContext {
  return {
    snapshot: snapshot(),
    upcomingBills: [],
    today: '2026-06-20',
    occasion: 'morning',
    sentToday: [],
    ...over,
  };
}

const prefs = (over: Partial<NudgePreferences> = {}): NudgePreferences => ({
  ...DEFAULT_NUDGE_PREFERENCES,
  ...over,
});

const bill = (over: Partial<EngineBill>): EngineBill => ({
  amountEstimate: 100,
  nextExpectedDate: '2026-06-22',
  status: 'confirmed',
  ...over,
});

describe('planNudges', () => {
  it('sends a morning runway nudge keyed by risk + tone', () => {
    const out = planNudges(ctx({ occasion: 'morning' }), prefs({ tone: 'direct' }));
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ type: 'morning_runway', copyKey: 'morning_runway.safe.direct' });
  });

  it('uses the stale variant when data is stale', () => {
    const out = planNudges(ctx({ snapshot: snapshot({ isStale: true }) }), prefs());
    expect(out[0]!.copyKey).toBe('morning_runway.stale.gentle');
  });

  it('skips the morning nudge entirely when there is no data', () => {
    const out = planNudges(ctx({ snapshot: snapshot({ status: 'needs_data' }) }), prefs());
    expect(out).toHaveLength(0);
  });

  it('does not repeat the morning nudge if one was already sent today', () => {
    const out = planNudges(ctx({ sentToday: ['morning_runway'] }), prefs());
    expect(out).toHaveLength(0);
  });

  it('returns nothing when nudges are disabled', () => {
    expect(planNudges(ctx(), prefs({ enabled: false }))).toHaveLength(0);
  });

  it('respects the per-channel toggle', () => {
    expect(planNudges(ctx(), prefs({ morningEnabled: false }))).toHaveLength(0);
  });

  describe('bill / risk slot', () => {
    it('sends a danger nudge keyed by the risk reason', () => {
      const out = planNudges(
        ctx({
          occasion: 'event',
          snapshot: snapshot({ riskLevel: 'danger', riskReasonKey: 'negative_runway' }),
        }),
        prefs(),
      );
      expect(out).toEqual([
        {
          type: 'danger_state',
          copyKey: 'danger_state.negative_runway.gentle',
          riskLevel: 'danger',
        },
      ]);
    });

    it('sends a bill-approach nudge for a confirmed bill due within the window', () => {
      const out = planNudges(
        ctx({ occasion: 'event', upcomingBills: [bill({ nextExpectedDate: '2026-06-22' })] }),
        prefs(),
      );
      expect(out[0]).toMatchObject({
        type: 'bill_approach',
        copyKey: 'bill_approach.single.gentle',
      });
    });

    it('consolidates multiple bills into one nudge', () => {
      const out = planNudges(
        ctx({
          occasion: 'event',
          upcomingBills: [
            bill({ nextExpectedDate: '2026-06-21' }),
            bill({ nextExpectedDate: '2026-06-22' }),
          ],
        }),
        prefs(),
      );
      const billNudges = out.filter((n) => n.type === 'bill_approach');
      expect(billNudges).toHaveLength(1);
      expect(billNudges[0]!.copyKey).toBe('bill_approach.multiple.gentle');
    });

    it('prioritizes danger over an upcoming bill (shared slot)', () => {
      const out = planNudges(
        ctx({
          occasion: 'event',
          snapshot: snapshot({ riskLevel: 'danger', riskReasonKey: 'bill_exceeds_cash' }),
          upcomingBills: [bill({ nextExpectedDate: '2026-06-22' })],
        }),
        prefs(),
      );
      expect(out.map((n) => n.type)).toEqual(['danger_state']);
    });

    it('throttles the bill/risk slot to one per day by default', () => {
      const out = planNudges(
        ctx({
          occasion: 'event',
          sentToday: ['danger_state'],
          upcomingBills: [bill({ nextExpectedDate: '2026-06-22' })],
        }),
        prefs(),
      );
      expect(out).toHaveLength(0);
    });

    it('allows a second bill/risk nudge when the user opted into extras', () => {
      const out = planNudges(
        ctx({
          occasion: 'event',
          sentToday: ['danger_state'],
          upcomingBills: [bill({ nextExpectedDate: '2026-06-22' })],
        }),
        prefs({ allowExtra: true }),
      );
      expect(out.map((n) => n.type)).toEqual(['bill_approach']);
    });

    it('ignores candidate (unconfirmed) bills and bills after payday', () => {
      const out = planNudges(
        ctx({
          occasion: 'event',
          upcomingBills: [
            bill({ status: 'candidate', nextExpectedDate: '2026-06-22' }),
            bill({ nextExpectedDate: '2026-07-10' }), // after payday
          ],
        }),
        prefs(),
      );
      expect(out).toHaveLength(0);
    });
  });

  it('can send both a morning and a bill/risk nudge in one pass', () => {
    const out = planNudges(
      ctx({
        occasion: 'morning',
        snapshot: snapshot({ riskLevel: 'danger', riskReasonKey: 'negative_runway' }),
      }),
      prefs(),
    );
    expect(out.map((n) => n.type).sort()).toEqual(['danger_state', 'morning_runway']);
  });
});
