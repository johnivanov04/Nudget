import { describe, it, expect } from 'vitest';
import { assignRiskLevel } from './risk';

describe('assignRiskLevel', () => {
  it('is SAFE with healthy runway and daily room', () => {
    const r = assignRiskLevel({
      safeToSpend: 600,
      availableCash: 1000,
      daysUntilPayday: 10,
      dailySafeSpend: 60,
    });
    expect(r).toEqual({ level: 'safe', reasonKey: 'on_track' });
  });

  it('is DANGER when safe-to-spend is zero or negative', () => {
    expect(
      assignRiskLevel({
        safeToSpend: 0,
        availableCash: 500,
        daysUntilPayday: 10,
        dailySafeSpend: 0,
      }),
    ).toEqual({ level: 'danger', reasonKey: 'negative_runway' });

    expect(
      assignRiskLevel({
        safeToSpend: -50,
        availableCash: 500,
        daysUntilPayday: 10,
        dailySafeSpend: 0,
      }).level,
    ).toBe('danger');
  });

  it('is DANGER when a single upcoming bill exceeds available cash', () => {
    const r = assignRiskLevel({
      safeToSpend: 120,
      availableCash: 400,
      daysUntilPayday: 8,
      dailySafeSpend: 15,
      largestUpcomingBill: 450, // bigger than the $400 on hand
    });
    expect(r).toEqual({ level: 'danger', reasonKey: 'bill_exceeds_cash' });
  });

  it('is CAUTION when positive but daily room is thin', () => {
    const r = assignRiskLevel({
      safeToSpend: 40,
      availableCash: 500,
      daysUntilPayday: 10,
      dailySafeSpend: 4, // below default $15/day floor
    });
    expect(r).toEqual({ level: 'caution', reasonKey: 'thin_buffer' });
  });

  it('honors a custom caution floor', () => {
    const r = assignRiskLevel({
      safeToSpend: 300,
      availableCash: 500,
      daysUntilPayday: 10,
      dailySafeSpend: 30,
      cautionDailyFloor: 50, // raise the bar -> now this is caution
    });
    expect(r.level).toBe('caution');
  });

  it('prioritizes danger over caution', () => {
    const r = assignRiskLevel({
      safeToSpend: -10,
      availableCash: 500,
      daysUntilPayday: 10,
      dailySafeSpend: 0,
      cautionDailyFloor: 100,
    });
    expect(r.level).toBe('danger');
  });
});
