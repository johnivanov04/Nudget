import { describe, it, expect } from 'vitest';
import { nextPaydayOnOrAfter, nextPaydays, daysUntilPayday } from './payday';
import type { EnginePaycheckSchedule } from './types';

describe('payday calculation', () => {
  describe('weekly', () => {
    const schedule: EnginePaycheckSchedule = {
      frequency: 'weekly',
      lastPaycheckDate: '2026-06-05', // a Friday
    };
    it('finds the next Friday on or after reference', () => {
      // 2026-06-10 is a Wednesday; next weekly payday is 2026-06-12.
      expect(nextPaydayOnOrAfter(schedule, '2026-06-10')).toBe('2026-06-12');
    });
    it('returns reference itself when reference is a payday', () => {
      expect(nextPaydayOnOrAfter(schedule, '2026-06-12')).toBe('2026-06-12');
      expect(daysUntilPayday(schedule, '2026-06-12')).toBe(0);
    });
    it('lists the next three paydays a week apart', () => {
      expect(nextPaydays(schedule, '2026-06-10', 3)).toEqual([
        '2026-06-12',
        '2026-06-19',
        '2026-06-26',
      ]);
    });
  });

  describe('biweekly', () => {
    const schedule: EnginePaycheckSchedule = {
      frequency: 'biweekly',
      lastPaycheckDate: '2026-06-05',
    };
    it('steps by 14 days', () => {
      expect(nextPaydayOnOrAfter(schedule, '2026-06-06')).toBe('2026-06-19');
      expect(nextPaydays(schedule, '2026-06-06', 3)).toEqual([
        '2026-06-19',
        '2026-07-03',
        '2026-07-17',
      ]);
    });
    it('computes days until payday', () => {
      expect(daysUntilPayday(schedule, '2026-06-12')).toBe(7); // 06-12 -> 06-19
    });
  });

  describe('semimonthly (15th and last day)', () => {
    const schedule: EnginePaycheckSchedule = {
      frequency: 'semimonthly',
      lastPaycheckDate: '2026-05-31',
      semimonthlyDays: [15, 31],
    };
    it('alternates between the 15th and end of month, clamping February', () => {
      expect(nextPaydays(schedule, '2026-06-01', 3)).toEqual([
        '2026-06-15',
        '2026-06-30',
        '2026-07-15',
      ]);
      // Crossing into February clamps the "31" anchor to the 28th.
      expect(nextPaydays(schedule, '2026-02-16', 2)).toEqual(['2026-02-28', '2026-03-15']);
    });
  });

  describe('monthly', () => {
    const schedule: EnginePaycheckSchedule = {
      frequency: 'monthly',
      lastPaycheckDate: '2026-01-31',
    };
    it('keeps the day-of-month, clamping short months', () => {
      expect(nextPaydays(schedule, '2026-02-01', 3)).toEqual([
        '2026-02-28',
        '2026-03-31',
        '2026-04-30',
      ]);
    });
  });

  describe('custom', () => {
    it('uses the manual next paycheck date', () => {
      const schedule: EnginePaycheckSchedule = {
        frequency: 'custom',
        lastPaycheckDate: '2026-06-01',
        manualNextPaycheckDate: '2026-06-27',
      };
      expect(nextPaydayOnOrAfter(schedule, '2026-06-10')).toBe('2026-06-27');
    });
    it('throws when custom schedule lacks a manual date', () => {
      const schedule: EnginePaycheckSchedule = {
        frequency: 'custom',
        lastPaycheckDate: '2026-06-01',
      };
      expect(() => nextPaydayOnOrAfter(schedule, '2026-06-10')).toThrow();
    });
  });

  describe('manual override for non-custom cycles', () => {
    it('pins the next payday when override is in the future', () => {
      const schedule: EnginePaycheckSchedule = {
        frequency: 'biweekly',
        lastPaycheckDate: '2026-06-05',
        manualNextPaycheckDate: '2026-06-18', // user corrected to Thursday
      };
      expect(nextPaydayOnOrAfter(schedule, '2026-06-10')).toBe('2026-06-18');
    });
  });

  describe('weekend rule', () => {
    const base: EnginePaycheckSchedule = {
      frequency: 'biweekly',
      lastPaycheckDate: '2026-06-06', // a Saturday
    };
    it('shifts a weekend payday to Friday before', () => {
      // 2026-06-20 is a Saturday.
      expect(nextPaydayOnOrAfter({ ...base, weekendRule: 'before' }, '2026-06-08')).toBe(
        '2026-06-19',
      );
    });
    it('shifts a weekend payday to Monday after', () => {
      expect(nextPaydayOnOrAfter({ ...base, weekendRule: 'after' }, '2026-06-08')).toBe(
        '2026-06-22',
      );
    });
    it('leaves weekday paydays untouched', () => {
      const weekdaySchedule: EnginePaycheckSchedule = {
        frequency: 'weekly',
        lastPaycheckDate: '2026-06-10', // Wednesday
        weekendRule: 'before',
      };
      expect(nextPaydayOnOrAfter(weekdaySchedule, '2026-06-11')).toBe('2026-06-17');
    });
  });
});
