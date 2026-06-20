/**
 * GET /api/bills/detected — detected + confirmed recurring bills for review.
 *
 * Auth-gated and user-scoped. Returns candidate (detection) and confirmed bills
 * with confidence + next expected date. Detection itself runs during sync
 * (`POST /api/plaid/sync`); this is a cheap read.
 */
import type { NextRequest } from 'next/server';
import { getUserFromRequest } from '@/lib/api/auth';
import { recurringBillsRepo } from '@/lib/db/repositories';
import { ok, unauthorized } from '@/lib/api/responses';

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return unauthorized();

  const bills = await recurringBillsRepo.listByUser(user.userId, ['candidate', 'confirmed']);

  return ok({
    bills: bills.map((b) => ({
      id: b.id,
      merchantName: b.merchant_name,
      amountEstimate: b.amount_estimate,
      cadence: b.cadence,
      nextExpectedDate: b.next_expected_date,
      confidence: b.confidence,
      status: b.status,
      // UI should present low-confidence candidates as "likely", not certain.
      likely: b.status === 'candidate',
    })),
  });
}
