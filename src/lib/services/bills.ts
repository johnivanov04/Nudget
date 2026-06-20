/**
 * Bill-detection service: runs the pure detector over a user's synced
 * transactions and persists the results as `candidate` bills.
 *
 * Respects user decisions — merchant keys the user has already confirmed or
 * rejected are never re-written back to candidate.
 */
import { detectRecurringBills, type DetectionTransaction } from '@/lib/domain/billDetection';
import { addDays, todayInTimeZone, type IsoDate } from '@/lib/domain/dateUtils';
import { transactionsRepo, recurringBillsRepo, profilesRepo } from '@/lib/db/repositories';

export interface RunBillDetectionOptions {
  /** "Today" anchor; if omitted, derived from the user's timezone + `now`. */
  asOf?: IsoDate;
  now?: Date;
  /** How far back to look for recurring charges. Default 180 days. */
  lookbackDays?: number;
  /** Max transactions to scan. Default 500. */
  limit?: number;
}

export async function runBillDetection(
  userId: string,
  options: RunBillDetectionOptions = {},
): Promise<{ detected: number; upserted: number }> {
  const lookbackDays = options.lookbackDays ?? 180;
  const limit = options.limit ?? 500;

  let asOf = options.asOf;
  if (!asOf) {
    const profile = await profilesRepo.getById(userId);
    asOf = todayInTimeZone(profile?.timezone ?? 'America/Los_Angeles', options.now ?? new Date());
  }

  const txnRows = await transactionsRepo.listByUser(userId, {
    from: addDays(asOf, -lookbackDays),
    to: asOf,
    limit,
  });
  const detectionTxns: DetectionTransaction[] = txnRows
    .filter((t) => !t.ignored)
    .map((t) => ({ merchantName: t.merchant_name, amount: t.amount, date: t.date }));

  const detected = detectRecurringBills(detectionTxns, { asOf });

  // Never overwrite a bill the user has confirmed or rejected.
  const existing = await recurringBillsRepo.listByUser(userId);
  const lockedKeys = new Set(
    existing
      .filter((b) => b.status === 'confirmed' || b.status === 'rejected')
      .map((b) => b.merchant_key)
      .filter((k): k is string => Boolean(k)),
  );

  const rows = detected
    .filter((d) => !lockedKeys.has(d.merchantKey))
    .map((d) => ({
      user_id: userId,
      merchant_key: d.merchantKey,
      merchant_name: d.displayName,
      amount_estimate: d.amountEstimate,
      cadence: d.cadence,
      next_expected_date: d.nextExpectedDate,
      confidence: d.confidence,
      status: 'candidate' as const,
    }));

  await recurringBillsRepo.upsertDetected(rows);
  return { detected: detected.length, upserted: rows.length };
}
