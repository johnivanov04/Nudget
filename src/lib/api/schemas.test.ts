import { describe, it, expect } from 'vitest';
import { paycheckScheduleSchema, recalculateSchema, feedbackSchema } from './schemas';

describe('api schemas', () => {
  describe('paycheckScheduleSchema', () => {
    it('accepts a valid schedule and defaults weekendRule', () => {
      const r = paycheckScheduleSchema.parse({
        frequency: 'biweekly',
        lastPaycheckDate: '2026-06-05',
      });
      expect(r.weekendRule).toBe('none');
    });
    it('rejects a bad frequency and a non-date', () => {
      expect(
        paycheckScheduleSchema.safeParse({ frequency: 'hourly', lastPaycheckDate: '2026-06-05' })
          .success,
      ).toBe(false);
      expect(
        paycheckScheduleSchema.safeParse({ frequency: 'weekly', lastPaycheckDate: '06/05/2026' })
          .success,
      ).toBe(false);
    });
  });

  describe('recalculateSchema', () => {
    it('accepts a minimal valid payload and defaults arrays', () => {
      const r = recalculateSchema.parse({
        today: '2026-06-20',
        availableCash: 1000,
        schedule: { frequency: 'weekly', lastPaycheckDate: '2026-06-19' },
      });
      expect(r.transactions).toEqual([]);
      expect(r.bills).toEqual([]);
    });
    it('allows a null balance (needs_data scenario)', () => {
      expect(
        recalculateSchema.safeParse({
          today: '2026-06-20',
          availableCash: null,
          schedule: { frequency: 'weekly', lastPaycheckDate: '2026-06-19' },
        }).success,
      ).toBe(true);
    });
    it('rejects a negative safety buffer and a bad bill status', () => {
      expect(
        recalculateSchema.safeParse({
          today: '2026-06-20',
          availableCash: 100,
          safetyBuffer: -1,
          schedule: { frequency: 'weekly', lastPaycheckDate: '2026-06-19' },
        }).success,
      ).toBe(false);
      expect(
        recalculateSchema.safeParse({
          today: '2026-06-20',
          availableCash: 100,
          bills: [{ amountEstimate: 10, nextExpectedDate: '2026-06-25', status: 'maybe' }],
          schedule: { frequency: 'weekly', lastPaycheckDate: '2026-06-19' },
        }).success,
      ).toBe(false);
    });
  });

  describe('feedbackSchema', () => {
    it('accepts valid feedback', () => {
      expect(feedbackSchema.safeParse({ eventType: 'nudge_helpful', rating: 5 }).success).toBe(
        true,
      );
    });
    it('rejects an out-of-range rating and unknown event type', () => {
      expect(feedbackSchema.safeParse({ eventType: 'nudge_helpful', rating: 9 }).success).toBe(
        false,
      );
      expect(feedbackSchema.safeParse({ eventType: 'spam' }).success).toBe(false);
    });
  });
});
