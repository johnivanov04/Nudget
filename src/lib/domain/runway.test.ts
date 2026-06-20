import { describe, it, expect } from 'vitest';
import { calculateRunway } from './runway';
import type { EngineBill } from './types';

const TODAY = '2026-06-20';
const PAYDAY = '2026-07-03';

function bill(
  partial: Partial<EngineBill> & Pick<EngineBill, 'amountEstimate' | 'nextExpectedDate'>,
): EngineBill {
  return { status: 'confirmed', ...partial };
}

describe('calculateRunway', () => {
  it('computes safe-to-spend with the spec formula', () => {
    const r = calculateRunway({
      availableCash: 1000,
      today: TODAY,
      paydayDate: PAYDAY,
      safetyBuffer: 100,
      bills: [
        bill({ amountEstimate: 400, nextExpectedDate: '2026-06-25', status: 'confirmed' }),
        bill({ amountEstimate: 60, nextExpectedDate: '2026-06-28', status: 'candidate' }),
      ],
    });
    // 1000 - 400 (confirmed) - 60 (predicted) - 100 (buffer) = 440
    expect(r.safeToSpend).toBe(440);
    expect(r.confirmedBillsBeforePayday).toBe(400);
    expect(r.predictedBillsBeforePayday).toBe(60);
    expect(r.totalBillsBeforePayday).toBe(460);
    expect(r.daysUntilPayday).toBe(13); // 06-20 -> 07-03
    // dailySafeSpend = 440 / 13 = 33.846... -> 33.85
    expect(r.dailySafeSpend).toBe(33.85);
  });

  it('excludes bills due on or after payday (boundary is exclusive of payday)', () => {
    const r = calculateRunway({
      availableCash: 500,
      today: TODAY,
      paydayDate: PAYDAY,
      bills: [
        bill({ amountEstimate: 200, nextExpectedDate: PAYDAY }), // ON payday -> excluded
        bill({ amountEstimate: 100, nextExpectedDate: '2026-07-10' }), // after -> excluded
        bill({ amountEstimate: 50, nextExpectedDate: TODAY }), // today -> included
      ],
    });
    expect(r.confirmedBillsBeforePayday).toBe(50);
    expect(r.safeToSpend).toBe(450);
  });

  it('ignores rejected and archived bills', () => {
    const r = calculateRunway({
      availableCash: 300,
      today: TODAY,
      paydayDate: PAYDAY,
      bills: [
        bill({ amountEstimate: 100, nextExpectedDate: '2026-06-22', status: 'rejected' }),
        bill({ amountEstimate: 80, nextExpectedDate: '2026-06-22', status: 'archived' }),
        bill({ amountEstimate: 50, nextExpectedDate: '2026-06-22', status: 'confirmed' }),
      ],
    });
    expect(r.totalBillsBeforePayday).toBe(50);
  });

  it('can exclude candidate bills when asked (less conservative)', () => {
    const r = calculateRunway({
      availableCash: 300,
      today: TODAY,
      paydayDate: PAYDAY,
      includeCandidateBills: false,
      bills: [bill({ amountEstimate: 90, nextExpectedDate: '2026-06-22', status: 'candidate' })],
    });
    expect(r.predictedBillsBeforePayday).toBe(0);
    expect(r.safeToSpend).toBe(300);
  });

  it('EDGE: produces a negative safe-to-spend (over-committed)', () => {
    const r = calculateRunway({
      availableCash: 200,
      today: TODAY,
      paydayDate: PAYDAY,
      bills: [bill({ amountEstimate: 500, nextExpectedDate: '2026-06-25' })],
    });
    expect(r.safeToSpend).toBe(-300);
    // Daily safe spend never goes negative; it floors at 0.
    expect(r.dailySafeSpend).toBe(0);
  });

  it('EDGE: clamps the divisor so payday today does not divide by zero', () => {
    const r = calculateRunway({
      availableCash: 130,
      today: TODAY,
      paydayDate: TODAY, // 0 days until payday
      bills: [],
    });
    expect(r.daysUntilPayday).toBe(0);
    expect(r.dailySafeSpend).toBe(130); // 130 / max(0,1)
  });

  it('FAILURE: rejects a non-finite balance', () => {
    expect(() =>
      calculateRunway({ availableCash: NaN, today: TODAY, paydayDate: PAYDAY, bills: [] }),
    ).toThrow(TypeError);
  });

  it('FAILURE: rejects a negative safety buffer', () => {
    expect(() =>
      calculateRunway({
        availableCash: 100,
        today: TODAY,
        paydayDate: PAYDAY,
        bills: [],
        safetyBuffer: -5,
      }),
    ).toThrow(RangeError);
  });
});
