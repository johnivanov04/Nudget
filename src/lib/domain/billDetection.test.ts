import { describe, it, expect } from 'vitest';
import {
  classifyCadence,
  detectRecurringBills,
  nextExpectedDate,
  normalizeMerchant,
  type DetectionTransaction,
} from './billDetection';

describe('normalizeMerchant', () => {
  it('strips processor prefixes, store numbers, domains, and punctuation', () => {
    expect(normalizeMerchant('SQ *BLUE BOTTLE #123')).toBe('blue bottle');
    expect(normalizeMerchant('Netflix.com')).toBe('netflix');
    expect(normalizeMerchant('TST* Chipotle 2491')).toBe('chipotle');
    expect(normalizeMerchant('SPOTIFY USA')).toBe('spotify usa');
    expect(normalizeMerchant(null)).toBe('');
  });

  it('groups variants of the same merchant to one key', () => {
    expect(normalizeMerchant('Netflix #5')).toBe(normalizeMerchant('NETFLIX.COM'));
  });
});

describe('classifyCadence', () => {
  it('maps typical gaps to a cadence', () => {
    expect(classifyCadence(7)).toBe('weekly');
    expect(classifyCadence(14)).toBe('biweekly');
    expect(classifyCadence(30)).toBe('monthly');
    expect(classifyCadence(365)).toBe('annual');
  });
  it('returns null for gaps that fit no cadence', () => {
    expect(classifyCadence(3)).toBeNull();
    expect(classifyCadence(60)).toBeNull();
  });
});

describe('nextExpectedDate', () => {
  it('rolls a monthly charge forward past the as-of date, preserving the day', () => {
    expect(nextExpectedDate('2026-01-15', 'monthly', '2026-06-20')).toBe('2026-07-15');
  });
  it('rolls weekly forward to the first occurrence after as-of', () => {
    expect(nextExpectedDate('2026-06-01', 'weekly', '2026-06-20')).toBe('2026-06-22');
  });
});

describe('detectRecurringBills', () => {
  it('detects a clean monthly subscription with high confidence', () => {
    const txns: DetectionTransaction[] = [
      { merchantName: 'Netflix.com', amount: 9.99, date: '2026-03-15' },
      { merchantName: 'NETFLIX #5', amount: 9.99, date: '2026-04-15' },
      { merchantName: 'Netflix.com', amount: 9.99, date: '2026-05-15' },
      { merchantName: 'Netflix.com', amount: 9.99, date: '2026-06-15' },
    ];
    const [bill, ...rest] = detectRecurringBills(txns, { asOf: '2026-06-20' });
    expect(rest).toHaveLength(0);
    expect(bill!.cadence).toBe('monthly');
    expect(bill!.amountEstimate).toBe(9.99);
    expect(bill!.nextExpectedDate).toBe('2026-07-15');
    expect(bill!.occurrences).toBe(4);
    expect(bill!.confidence).toBeGreaterThan(0.8);
  });

  it('ignores merchants with too few occurrences', () => {
    const txns: DetectionTransaction[] = [
      { merchantName: 'Rare Store', amount: 50, date: '2026-05-01' },
      { merchantName: 'Rare Store', amount: 50, date: '2026-06-01' },
    ];
    expect(detectRecurringBills(txns, { minOccurrences: 3 })).toHaveLength(0);
  });

  it('ignores inflows (income/refunds are not bills)', () => {
    const txns: DetectionTransaction[] = [
      { merchantName: 'Employer', amount: -2000, date: '2026-04-15' },
      { merchantName: 'Employer', amount: -2000, date: '2026-05-15' },
      { merchantName: 'Employer', amount: -2000, date: '2026-06-15' },
    ];
    expect(detectRecurringBills(txns)).toHaveLength(0);
  });

  it('rejects irregular cadences (no clear interval)', () => {
    const txns: DetectionTransaction[] = [
      { merchantName: 'Random Shop', amount: 20, date: '2026-06-01' },
      { merchantName: 'Random Shop', amount: 20, date: '2026-06-03' },
      { merchantName: 'Random Shop', amount: 20, date: '2026-06-19' },
    ];
    expect(detectRecurringBills(txns)).toHaveLength(0);
  });

  it('lowers confidence when the amount varies a lot', () => {
    const steady: DetectionTransaction[] = [
      { merchantName: 'Gym', amount: 40, date: '2026-03-10' },
      { merchantName: 'Gym', amount: 40, date: '2026-04-10' },
      { merchantName: 'Gym', amount: 40, date: '2026-05-10' },
      { merchantName: 'Gym', amount: 40, date: '2026-06-10' },
    ];
    const variable: DetectionTransaction[] = [
      { merchantName: 'PowerCo', amount: 60, date: '2026-03-10' },
      { merchantName: 'PowerCo', amount: 120, date: '2026-04-10' },
      { merchantName: 'PowerCo', amount: 45, date: '2026-05-10' },
      { merchantName: 'PowerCo', amount: 200, date: '2026-06-10' },
    ];
    const steadyConf = detectRecurringBills(steady)[0]!.confidence;
    const variableConf = detectRecurringBills(variable)[0]!.confidence;
    expect(steadyConf).toBeGreaterThan(variableConf);
  });

  it('detects multiple bills and sorts by confidence', () => {
    const txns: DetectionTransaction[] = [
      // weekly, very regular
      { merchantName: 'Coffee Sub', amount: 5, date: '2026-05-25' },
      { merchantName: 'Coffee Sub', amount: 5, date: '2026-06-01' },
      { merchantName: 'Coffee Sub', amount: 5, date: '2026-06-08' },
      { merchantName: 'Coffee Sub', amount: 5, date: '2026-06-15' },
      // monthly, slightly noisy amounts
      { merchantName: 'Utility', amount: 80, date: '2026-04-02' },
      { merchantName: 'Utility', amount: 95, date: '2026-05-02' },
      { merchantName: 'Utility', amount: 88, date: '2026-06-02' },
    ];
    const bills = detectRecurringBills(txns, { asOf: '2026-06-20' });
    expect(bills.map((b) => b.cadence).sort()).toEqual(['monthly', 'weekly']);
    // Sorted descending by confidence.
    expect(bills[0]!.confidence).toBeGreaterThanOrEqual(bills[1]!.confidence);
  });
});
