import { describe, it, expect } from 'vitest';
import {
  addDays,
  addMonths,
  daysBetween,
  daysInMonth,
  dayOfWeek,
  formatDate,
  isIsoDate,
  isWeekend,
  toUTCDate,
} from './dateUtils';

describe('dateUtils', () => {
  describe('isIsoDate', () => {
    it('accepts valid calendar dates', () => {
      expect(isIsoDate('2026-06-20')).toBe(true);
      expect(isIsoDate('2024-02-29')).toBe(true); // leap day
    });
    it('rejects malformed or impossible dates', () => {
      expect(isIsoDate('2026-6-20')).toBe(false);
      expect(isIsoDate('2026-02-30')).toBe(false);
      expect(isIsoDate('2026-13-01')).toBe(false);
      expect(isIsoDate('')).toBe(false);
      expect(isIsoDate(20260620 as unknown)).toBe(false);
    });
  });

  describe('toUTCDate / formatDate round-trip', () => {
    it('round-trips a date', () => {
      expect(formatDate(toUTCDate('2026-06-20'))).toBe('2026-06-20');
    });
    it('throws on bad input', () => {
      expect(() => toUTCDate('nope')).toThrow();
    });
  });

  describe('addDays', () => {
    it('adds and subtracts across month/year boundaries', () => {
      expect(addDays('2026-06-20', 14)).toBe('2026-07-04');
      expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
      expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    });
  });

  describe('addMonths with clamping', () => {
    it('clamps to end of shorter month', () => {
      expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
      expect(addMonths('2024-01-31', 1)).toBe('2024-02-29'); // leap year
      expect(addMonths('2026-03-15', -1)).toBe('2026-02-15');
    });
  });

  describe('daysInMonth', () => {
    it('returns correct lengths', () => {
      expect(daysInMonth(2026, 1)).toBe(28); // Feb 2026
      expect(daysInMonth(2024, 1)).toBe(29); // Feb 2024 (leap)
      expect(daysInMonth(2026, 0)).toBe(31); // Jan
    });
  });

  describe('daysBetween', () => {
    it('is signed and DST-immune', () => {
      expect(daysBetween('2026-06-20', '2026-06-27')).toBe(7);
      expect(daysBetween('2026-06-27', '2026-06-20')).toBe(-7);
      expect(daysBetween('2026-06-20', '2026-06-20')).toBe(0);
      // Spring-forward DST boundary in US (2026-03-08) must still be 1 day apart.
      expect(daysBetween('2026-03-07', '2026-03-09')).toBe(2);
    });
  });

  describe('dayOfWeek / isWeekend', () => {
    it('identifies weekend days', () => {
      expect(dayOfWeek('2026-06-20')).toBe(6); // Saturday
      expect(isWeekend('2026-06-20')).toBe(true); // Sat
      expect(isWeekend('2026-06-21')).toBe(true); // Sun
      expect(isWeekend('2026-06-22')).toBe(false); // Mon
    });
  });
});
