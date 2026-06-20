import { describe, it, expect } from 'vitest';
import {
  previewNextPaydays,
  recalculateBodyToSnapshot,
  scheduleBodyToEngine,
} from './runwayService';
import { recalculateSchema, paycheckScheduleSchema } from './schemas';

describe('runwayService', () => {
  it('previews the next three paydays from a schedule body', () => {
    const body = paycheckScheduleSchema.parse({
      frequency: 'biweekly',
      lastPaycheckDate: '2026-06-05',
    });
    expect(previewNextPaydays(body, '2026-06-06', 3)).toEqual([
      '2026-06-19',
      '2026-07-03',
      '2026-07-17',
    ]);
  });

  it('maps a schedule body to the engine shape', () => {
    const body = paycheckScheduleSchema.parse({
      frequency: 'semimonthly',
      lastPaycheckDate: '2026-05-31',
      semimonthlyDays: [15, 31],
      weekendRule: 'before',
    });
    const engine = scheduleBodyToEngine(body);
    expect(engine.semimonthlyDays).toEqual([15, 31]);
    expect(engine.weekendRule).toBe('before');
  });

  it('computes a full snapshot from a validated recalculate body', () => {
    const body = recalculateSchema.parse({
      today: '2026-06-20',
      availableCash: 1000,
      transactions: [{ amount: 25, date: '2026-06-20' }],
      bills: [{ amountEstimate: 400, nextExpectedDate: '2026-06-25', status: 'confirmed' }],
      schedule: { frequency: 'biweekly', lastPaycheckDate: '2026-06-05' },
      safetyBuffer: 100,
      lastUpdatedAt: '2026-06-20T08:00:00.000Z',
      now: '2026-06-20T09:00:00.000Z',
    });
    const s = recalculateBodyToSnapshot(body);
    expect(s.status).toBe('ok');
    expect(s.spentToday).toBe(25);
    expect(s.safeToSpend).toBe(500); // 1000 - 400 - 100
    expect(s.paydayDate).toBe('2026-07-03');
  });

  it('returns needs_data when the balance is null', () => {
    const body = recalculateSchema.parse({
      today: '2026-06-20',
      availableCash: null,
      schedule: { frequency: 'weekly', lastPaycheckDate: '2026-06-19' },
    });
    expect(recalculateBodyToSnapshot(body).status).toBe('needs_data');
  });
});
