/**
 * Data freshness — every financial number shown to a user must carry a
 * last-updated timestamp or clear context (a hard product requirement). This
 * helper turns a "last updated" instant into an age + stale flag the UI and
 * widget use to render a "Last updated …" / stale warning.
 *
 * Unlike the calendar-date helpers, this works on real timestamps (ISO 8601
 * datetime strings) because staleness is about wall-clock minutes/hours.
 */

export interface FreshnessInput {
  /** When the underlying data was last refreshed (ISO 8601), or null if never. */
  lastUpdatedAt: string | null | undefined;
  /** "Now" as an ISO 8601 datetime. Injected for deterministic tests. */
  now: string;
  /** Age beyond which we treat the data as stale. Default 6 hours. */
  staleAfterMinutes?: number;
}

export interface FreshnessResult {
  hasData: boolean;
  ageMinutes: number | null;
  isStale: boolean;
}

export const DEFAULT_STALE_AFTER_MINUTES = 6 * 60;

export function dataFreshness(input: FreshnessInput): FreshnessResult {
  const { lastUpdatedAt, now, staleAfterMinutes = DEFAULT_STALE_AFTER_MINUTES } = input;

  if (!lastUpdatedAt) {
    // No data at all is, by definition, stale and must be flagged.
    return { hasData: false, ageMinutes: null, isStale: true };
  }

  const updated = Date.parse(lastUpdatedAt);
  const current = Date.parse(now);
  if (Number.isNaN(updated) || Number.isNaN(current)) {
    throw new TypeError('dataFreshness requires valid ISO 8601 datetimes');
  }

  const ageMinutes = Math.max(0, Math.round((current - updated) / 60_000));
  return {
    hasData: true,
    ageMinutes,
    isStale: ageMinutes >= staleAfterMinutes,
  };
}
