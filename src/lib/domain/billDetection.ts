/**
 * Recurring-bill detection.
 *
 * Pure and deterministic: given a user's spending transactions, group them by a
 * normalized merchant key, infer a cadence (weekly / biweekly / monthly /
 * annual), estimate the next charge date + amount, and score a confidence. The
 * caller persists the results as `candidate` bills for the user to confirm.
 *
 * Spec references (Feature Spec §6.4 "Recurring bill detection" + "Merchant
 * normalization"): group by normalized merchant; score cadence consistency,
 * amount stability, and transaction count; only present low-confidence items as
 * "likely" and require user confirmation.
 *
 * Amount convention (Plaid): positive = money out. Bills are outflows, so
 * inflows (income/refunds, amount <= 0) are ignored.
 */
import { addDays, addMonths, daysBetween, isOnOrBefore, type IsoDate } from './dateUtils';
import { roundCents } from './money';

export type BillCadence = 'weekly' | 'biweekly' | 'monthly' | 'annual';

export interface DetectionTransaction {
  merchantName: string | null;
  amount: number;
  date: IsoDate;
}

export interface DetectedBill {
  merchantKey: string;
  displayName: string;
  amountEstimate: number;
  cadence: BillCadence;
  nextExpectedDate: IsoDate;
  confidence: number; // 0..1 (3 decimals)
  occurrences: number;
}

export interface DetectionOptions {
  /** Minimum charges before a merchant is considered recurring. Default 3. */
  minOccurrences?: number;
  /** Drop candidates below this confidence. Default 0 (emit all; UI labels "likely"). */
  minConfidence?: number;
  /**
   * Reject a merchant whose charge gaps are too irregular (coefficient of
   * variation above this). Keeps one-off bursts from masquerading as a cadence.
   * Default 0.4.
   */
  maxGapCoV?: number;
  /** "Today" anchor for rolling the next date forward. Default = latest charge. */
  asOf?: IsoDate;
}

/**
 * Normalize a raw merchant string into a stable grouping key: lowercase, strip
 * payment-processor prefixes, store numbers, urls, and punctuation.
 */
export function normalizeMerchant(name: string | null | undefined): string {
  if (!name) return '';
  let s = name.toLowerCase();
  s = s.replace(/^(sq|tst|pp|paypal|sp|ach|pos|dd)\s*\*+\s*/i, ''); // processor prefixes
  s = s.replace(/\*/g, ' ');
  s = s.replace(/\.(com|net|org|io|co)\b/g, ' '); // strip domain suffixes (keep the name)
  s = s.replace(/#?\d+/g, ' '); // store numbers / ids
  s = s.replace(/[^a-z\s]/g, ' '); // punctuation
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

function mean(xs: number[]): number {
  return xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length;
}
function stdev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
}
function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}
function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

/** Classify a typical day-gap into a cadence, or null if it fits none. */
export function classifyCadence(medianGapDays: number): BillCadence | null {
  if (medianGapDays >= 5 && medianGapDays <= 10) return 'weekly';
  if (medianGapDays >= 11 && medianGapDays <= 18) return 'biweekly';
  if (medianGapDays >= 24 && medianGapDays <= 38) return 'monthly';
  if (medianGapDays >= 330 && medianGapDays <= 400) return 'annual';
  return null;
}

function advance(date: IsoDate, cadence: BillCadence): IsoDate {
  switch (cadence) {
    case 'weekly':
      return addDays(date, 7);
    case 'biweekly':
      return addDays(date, 14);
    case 'monthly':
      return addMonths(date, 1);
    case 'annual':
      return addMonths(date, 12);
  }
}

/** First occurrence strictly after `asOf`, preserving the cadence anchor. */
export function nextExpectedDate(
  lastCharge: IsoDate,
  cadence: BillCadence,
  asOf: IsoDate,
): IsoDate {
  let d = lastCharge;
  let guard = 0;
  while (isOnOrBefore(d, asOf) && guard < 600) {
    d = advance(d, cadence);
    guard += 1;
  }
  return d;
}

function scoreConfidence(gaps: number[], amounts: number[], occurrences: number): number {
  const meanGap = mean(gaps);
  const regularity = meanGap > 0 ? clamp01(1 - stdev(gaps) / meanGap) : 0;
  const meanAmt = mean(amounts);
  const amountStability = meanAmt > 0 ? clamp01(1 - stdev(amounts) / meanAmt) : 0;
  const countFactor = clamp01(occurrences / 6); // saturates at 6 charges
  const confidence = 0.45 * regularity + 0.3 * amountStability + 0.25 * countFactor;
  return Math.round(clamp01(confidence) * 1000) / 1000;
}

export function detectRecurringBills(
  transactions: DetectionTransaction[],
  options: DetectionOptions = {},
): DetectedBill[] {
  const minOccurrences = options.minOccurrences ?? 3;
  const minConfidence = options.minConfidence ?? 0;
  const maxGapCoV = options.maxGapCoV ?? 0.4;

  // Group outflows by normalized merchant, keeping a representative display name.
  const groups = new Map<string, { txns: DetectionTransaction[]; display: string }>();
  for (const txn of transactions) {
    if (txn.amount <= 0) continue; // inflows are not bills
    const key = normalizeMerchant(txn.merchantName);
    if (!key) continue;
    const existing = groups.get(key);
    if (existing) existing.txns.push(txn);
    else groups.set(key, { txns: [txn], display: txn.merchantName ?? key });
  }

  const results: DetectedBill[] = [];
  for (const [key, group] of groups) {
    // De-duplicate same-day charges before measuring cadence.
    const byDate = new Map<string, DetectionTransaction>();
    for (const t of group.txns) if (!byDate.has(t.date)) byDate.set(t.date, t);
    const sorted = [...byDate.values()].sort((a, b) => daysBetween(b.date, a.date));
    if (sorted.length < minOccurrences) continue;

    const gaps: number[] = [];
    for (let i = 1; i < sorted.length; i += 1) {
      gaps.push(daysBetween(sorted[i - 1]!.date, sorted[i]!.date));
    }
    const cadence = classifyCadence(median(gaps));
    if (!cadence) continue;

    // Reject irregular series: a low median gap can hide wildly uneven spacing.
    const meanGap = mean(gaps);
    if (meanGap <= 0 || stdev(gaps) / meanGap > maxGapCoV) continue;

    const amounts = sorted.map((t) => t.amount);
    const lastCharge = sorted[sorted.length - 1]!.date;
    const asOf = options.asOf ?? lastCharge;
    const confidence = scoreConfidence(gaps, amounts, sorted.length);
    if (confidence < minConfidence) continue;

    results.push({
      merchantKey: key,
      displayName: group.display,
      amountEstimate: roundCents(median(amounts)),
      cadence,
      nextExpectedDate: nextExpectedDate(lastCharge, cadence, asOf),
      confidence,
      occurrences: sorted.length,
    });
  }

  return results.sort((a, b) => b.confidence - a.confidence);
}
