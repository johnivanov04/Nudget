/**
 * Payday date calculation.
 *
 * Pure and deterministic: callers pass in a `reference` date (the user's "today"
 * in their own timezone). Nothing here reads the system clock.
 *
 * Spec references:
 * - Feature Spec Epic 3 / Feature 4: weekly, biweekly, twice-monthly, monthly,
 *   custom; compute next three paydays; weekend handling; manual override.
 * - Business rule: "Runway horizon is today through the next payday. User can
 *   manually override next payday for the current cycle."
 */
import {
  addDays,
  addMonths,
  daysBetween,
  daysInMonth,
  dayOfWeek,
  isBefore,
  isOnOrBefore,
  toUTCDate,
  formatDate,
  type IsoDate,
} from './dateUtils';
import type { EnginePaycheckSchedule, WeekendRule } from './types';

/** Apply the weekend rule to a single candidate payday. */
function applyWeekendRule(iso: IsoDate, rule: WeekendRule): IsoDate {
  if (rule === 'none') return iso;
  const dow = dayOfWeek(iso); // 0 = Sun, 6 = Sat
  if (rule === 'before') {
    if (dow === 6) return addDays(iso, -1); // Sat -> Fri
    if (dow === 0) return addDays(iso, -2); // Sun -> Fri
  }
  if (rule === 'after') {
    if (dow === 6) return addDays(iso, 2); // Sat -> Mon
    if (dow === 0) return addDays(iso, 1); // Sun -> Mon
  }
  return iso;
}

/** Resolve the two semimonthly day-of-month anchors into dates in a given month. */
function semimonthlyDatesInMonth(
  year: number,
  monthIndex: number,
  days: [number, number],
): IsoDate[] {
  const last = daysInMonth(year, monthIndex);
  return days
    .map((d) => Math.min(d, last)) // 31 -> clamp to month length ("last day")
    .sort((a, b) => a - b)
    .map((d) => formatDate(new Date(Date.UTC(year, monthIndex, d))));
}

/**
 * Generate the raw (pre-weekend-rule) payday sequence on or after `reference`.
 * Returns at least `count` dates. The override, if present and >= reference, is
 * used as the first date.
 */
function rawPaydays(
  schedule: EnginePaycheckSchedule,
  reference: IsoDate,
  count: number,
): IsoDate[] {
  const { frequency } = schedule;
  const out: IsoDate[] = [];

  // A per-cycle override pins the first upcoming payday.
  const override = schedule.manualNextPaycheckDate ?? null;

  if (frequency === 'custom') {
    if (!override) {
      throw new Error('custom paycheck schedule requires manualNextPaycheckDate');
    }
    // We can only know the explicitly provided next payday for a custom schedule.
    out.push(override);
    return out;
  }

  if (override && isOnOrBefore(reference, override)) {
    out.push(override);
  }

  if (frequency === 'weekly' || frequency === 'biweekly') {
    const step = frequency === 'weekly' ? 7 : 14;
    // Walk forward from the anchor to the first occurrence >= reference.
    let cursor = schedule.lastPaycheckDate;
    if (isBefore(cursor, reference)) {
      const gap = daysBetween(cursor, reference);
      const steps = Math.ceil(gap / step);
      cursor = addDays(cursor, steps * step);
    }
    while (out.length < count) {
      if (out[out.length - 1] !== cursor) out.push(cursor);
      cursor = addDays(cursor, step);
    }
    return out.slice(0, count);
  }

  if (frequency === 'monthly') {
    const anchorDay = toUTCDate(schedule.lastPaycheckDate).getUTCDate();
    // Start from the reference month and walk forward.
    let probe = formatDate(
      new Date(
        Date.UTC(
          toUTCDate(reference).getUTCFullYear(),
          toUTCDate(reference).getUTCMonth(),
          Math.min(
            anchorDay,
            daysInMonth(toUTCDate(reference).getUTCFullYear(), toUTCDate(reference).getUTCMonth()),
          ),
        ),
      ),
    );
    if (isBefore(probe, reference)) probe = clampedMonthlyNext(probe, anchorDay);
    while (out.length < count) {
      if (out[out.length - 1] !== probe) out.push(probe);
      probe = clampedMonthlyNext(probe, anchorDay);
    }
    return out.slice(0, count);
  }

  // semimonthly
  const semiDays = schedule.semimonthlyDays ?? [15, 31];
  let year = toUTCDate(reference).getUTCFullYear();
  let month = toUTCDate(reference).getUTCMonth();
  let guard = 0;
  while (out.length < count && guard < 64) {
    for (const candidate of semimonthlyDatesInMonth(year, month, semiDays)) {
      if (isOnOrBefore(reference, candidate)) {
        if (out[out.length - 1] !== candidate) out.push(candidate);
        if (out.length >= count) break;
      }
    }
    month += 1;
    if (month > 11) {
      month = 0;
      year += 1;
    }
    guard += 1;
  }
  return out.slice(0, count);
}

/** Advance a monthly date by one month, re-clamping to the anchor day. */
function clampedMonthlyNext(iso: IsoDate, anchorDay: number): IsoDate {
  const base = addMonths(iso, 1);
  const y = toUTCDate(base).getUTCFullYear();
  const m = toUTCDate(base).getUTCMonth();
  const day = Math.min(anchorDay, daysInMonth(y, m));
  return formatDate(new Date(Date.UTC(y, m, day)));
}

/**
 * The next payday on or after `reference`, with the weekend rule applied.
 */
export function nextPaydayOnOrAfter(schedule: EnginePaycheckSchedule, reference: IsoDate): IsoDate {
  const rule = schedule.weekendRule ?? 'none';
  const [first] = rawPaydays(schedule, reference, 1);
  if (!first) {
    throw new Error('Unable to compute next payday for schedule');
  }
  return applyWeekendRule(first, rule);
}

/**
 * The next `count` paydays on or after `reference`, weekend rule applied, and
 * de-duplicated (a weekend shift can collide an adjacent date).
 */
export function nextPaydays(
  schedule: EnginePaycheckSchedule,
  reference: IsoDate,
  count = 3,
): IsoDate[] {
  const rule = schedule.weekendRule ?? 'none';
  // Pull a few extra raw dates so de-duplication after shifting still yields `count`.
  const raw = rawPaydays(schedule, reference, count + 2);
  const shifted: IsoDate[] = [];
  for (const d of raw) {
    const s = applyWeekendRule(d, rule);
    if (shifted[shifted.length - 1] !== s) shifted.push(s);
    if (shifted.length >= count) break;
  }
  return shifted.slice(0, count);
}

/**
 * Whole days from `reference` until the next payday. Always >= 0; the runway
 * formula clamps the divisor with max(daysUntilPayday, 1).
 */
export function daysUntilPayday(schedule: EnginePaycheckSchedule, reference: IsoDate): number {
  const payday = nextPaydayOnOrAfter(schedule, reference);
  return Math.max(0, daysBetween(reference, payday));
}
