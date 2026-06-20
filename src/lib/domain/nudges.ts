/**
 * Nudge engine — decides which notifications to send and which (non-shaming)
 * copy template to use. Pure and deterministic: the caller supplies the current
 * runway snapshot, upcoming bills, the user's preferences, and what has already
 * been sent today; the engine returns the nudges to send.
 *
 * Spec references (Feature Spec Epic 8 / roadmap Epic 6 + Nudge Copy Rules):
 * - Morning runway nudge, bill-approach nudge, danger-state nudge.
 * - Throttle: at most one morning + one bill/risk nudge per day unless the user
 *   opts into more.
 * - Copy is keyed by a stable `copyKey` (a template id, never rendered text with
 *   dollar amounts) so nudges carry no sensitive data and stay non-shaming.
 * - Never nag: when there is no data we skip the morning nudge; when data is
 *   stale we send a "refresh" variant rather than a confident number.
 */
import { daysBetween, isOnOrBefore, type IsoDate } from './dateUtils';
import type { RunwaySnapshot } from './snapshot';
import type { EngineBill, RiskLevel } from './types';

export type NudgeType = 'morning_runway' | 'bill_approach' | 'danger_state';
export type NudgeTone = 'gentle' | 'direct' | 'minimal';

export interface NudgePreferences {
  /** Master switch — off means no nudges at all. */
  enabled: boolean;
  morningEnabled: boolean;
  billApproachEnabled: boolean;
  dangerEnabled: boolean;
  tone: NudgeTone;
  /** Opt-in to more than the default one-morning + one-bill/risk-per-day cap. */
  allowExtra: boolean;
}

export const DEFAULT_NUDGE_PREFERENCES: NudgePreferences = {
  enabled: true,
  morningEnabled: true,
  billApproachEnabled: true,
  dangerEnabled: true,
  tone: 'gentle',
  allowExtra: false,
};

export interface NudgeContext {
  snapshot: RunwaySnapshot;
  upcomingBills: EngineBill[];
  today: IsoDate;
  /** 'morning' = the scheduled daily summary; 'event' = post-sync / risk change. */
  occasion: 'morning' | 'event';
  /** Nudge types already sent to this user today (for throttling). */
  sentToday: NudgeType[];
  /** How many days before a bill counts as "approaching". Default 3. */
  billApproachWindowDays?: number;
}

export interface PlannedNudge {
  type: NudgeType;
  copyKey: string;
  riskLevel: RiskLevel | null;
}

/** Confirmed bills due within the approach window AND on/before payday. */
function approachingConfirmedBills(ctx: NudgeContext): EngineBill[] {
  const windowDays = ctx.billApproachWindowDays ?? 3;
  return ctx.upcomingBills.filter((b) => {
    if (b.status !== 'confirmed') return false;
    const inDays = daysBetween(ctx.today, b.nextExpectedDate);
    if (inDays < 0 || inDays > windowDays) return false;
    return isOnOrBefore(b.nextExpectedDate, ctx.snapshot.paydayDate);
  });
}

/**
 * Plan the nudges to send right now. Returns 0–2 nudges: at most one morning
 * nudge and at most one bill/risk nudge (danger takes priority over a bill),
 * subject to the user's preferences and today's send history.
 */
export function planNudges(ctx: NudgeContext, prefs: NudgePreferences): PlannedNudge[] {
  if (!prefs.enabled) return [];

  const planned: PlannedNudge[] = [];
  const { snapshot, occasion, sentToday } = ctx;

  const morningSent = sentToday.includes('morning_runway');
  const billRiskSent = sentToday.includes('danger_state') || sentToday.includes('bill_approach');

  // --- Morning runway nudge (scheduled daily summary) ---
  if (occasion === 'morning' && prefs.morningEnabled && !morningSent) {
    // Don't nag a user with no data; do prompt a refresh when stale.
    if (snapshot.status === 'ok') {
      const variant = snapshot.isStale ? 'stale' : (snapshot.riskLevel ?? 'safe');
      planned.push({
        type: 'morning_runway',
        copyKey: `morning_runway.${variant}.${prefs.tone}`,
        riskLevel: snapshot.riskLevel,
      });
    }
  }

  // --- Bill/risk nudge (one slot/day unless opted in) ---
  const billRiskBudget = prefs.allowExtra || !billRiskSent;
  if (billRiskBudget) {
    // Danger takes priority over an upcoming bill.
    if (prefs.dangerEnabled && snapshot.status === 'ok' && snapshot.riskLevel === 'danger') {
      planned.push({
        type: 'danger_state',
        copyKey: `danger_state.${snapshot.riskReasonKey ?? 'negative_runway'}.${prefs.tone}`,
        riskLevel: 'danger',
      });
    } else if (prefs.billApproachEnabled) {
      const bills = approachingConfirmedBills(ctx);
      if (bills.length > 0) {
        const variant = bills.length > 1 ? 'multiple' : 'single';
        planned.push({
          type: 'bill_approach',
          copyKey: `bill_approach.${variant}.${prefs.tone}`,
          riskLevel: snapshot.riskLevel,
        });
      }
    }
  }

  return planned;
}
