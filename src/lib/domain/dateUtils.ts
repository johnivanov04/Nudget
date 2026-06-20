/**
 * Calendar-date utilities for the runway engine.
 *
 * Design rules:
 * - We only ever deal with *calendar dates* (no clock time) for paydays, bills,
 *   and "today". All math is anchored to UTC midnight so it is immune to DST and
 *   local-timezone drift. The caller is responsible for deciding what "today"
 *   means in the user's timezone and passing it in as a 'YYYY-MM-DD' string.
 * - Every function is pure and deterministic. Nothing reads the system clock.
 */

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** A calendar date in 'YYYY-MM-DD' form (e.g. '2026-06-20'). */
export type IsoDate = string;

export function isIsoDate(value: unknown): value is IsoDate {
  if (typeof value !== 'string' || !ISO_DATE_RE.test(value)) return false;
  const d = toUTCDate(value);
  // Reject impossible dates like 2026-02-30 (Date would roll them over).
  return formatDate(d) === value;
}

/** Parse a 'YYYY-MM-DD' string into a Date anchored at UTC midnight. */
export function toUTCDate(iso: IsoDate): Date {
  if (typeof iso !== 'string' || !ISO_DATE_RE.test(iso)) {
    throw new TypeError(`Invalid ISO date: ${String(iso)} (expected YYYY-MM-DD)`);
  }
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d));
}

/** Format a Date as a 'YYYY-MM-DD' string using its UTC components. */
export function formatDate(date: Date): IsoDate {
  const y = date.getUTCFullYear().toString().padStart(4, '0');
  const m = (date.getUTCMonth() + 1).toString().padStart(2, '0');
  const d = date.getUTCDate().toString().padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Add (or subtract) whole days to a calendar date. */
export function addDays(iso: IsoDate, days: number): IsoDate {
  const d = toUTCDate(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return formatDate(d);
}

/**
 * Add whole months, clamping the day-of-month to the target month's length.
 * e.g. addMonths('2026-01-31', 1) -> '2026-02-28'.
 */
export function addMonths(iso: IsoDate, months: number): IsoDate {
  const d = toUTCDate(iso);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const lastDay = daysInMonth(d.getUTCFullYear(), d.getUTCMonth());
  d.setUTCDate(Math.min(day, lastDay));
  return formatDate(d);
}

/** Number of days in a given month. `monthIndex` is 0-based (0 = January). */
export function daysInMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

/**
 * Whole calendar days from `from` to `to` (to - from).
 * Positive if `to` is after `from`, negative if before, 0 if same day.
 */
export function daysBetween(from: IsoDate, to: IsoDate): number {
  const ms = toUTCDate(to).getTime() - toUTCDate(from).getTime();
  return Math.round(ms / 86_400_000);
}

/** Day of week for a calendar date. 0 = Sunday ... 6 = Saturday. */
export function dayOfWeek(iso: IsoDate): number {
  return toUTCDate(iso).getUTCDay();
}

export function isWeekend(iso: IsoDate): boolean {
  const dow = dayOfWeek(iso);
  return dow === 0 || dow === 6;
}

/** `a < b` for calendar dates. */
export function isBefore(a: IsoDate, b: IsoDate): boolean {
  return toUTCDate(a).getTime() < toUTCDate(b).getTime();
}

/** `a <= b` for calendar dates. */
export function isOnOrBefore(a: IsoDate, b: IsoDate): boolean {
  return toUTCDate(a).getTime() <= toUTCDate(b).getTime();
}
