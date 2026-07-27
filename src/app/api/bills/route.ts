/**
 * POST /api/bills — add a manual bill the user enters themselves.
 *
 * Auth-gated and user-scoped. For expenses Plaid can't detect (rent paid by
 * check/Zelle, annual charges, etc.). Stored as a confirmed bill and folded into
 * the runway immediately.
 */
import type { NextRequest } from 'next/server';
import { getUserFromRequest } from '@/lib/api/auth';
import { createBillSchema } from '@/lib/api/schemas';
import { recurringBillsRepo } from '@/lib/db/repositories';
import { recomputeRunwayForUser } from '@/lib/services/runway';
import { ok, badRequest, unauthorized } from '@/lib/api/responses';

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return unauthorized();

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return badRequest('Request body must be valid JSON');
  }
  const parsed = createBillSchema.safeParse(json);
  if (!parsed.success) {
    return badRequest('Invalid bill', parsed.error.flatten());
  }

  const bill = await recurringBillsRepo.createManual({
    userId: user.userId,
    merchantName: parsed.data.merchantName,
    amountEstimate: parsed.data.amountEstimate,
    nextExpectedDate: parsed.data.nextExpectedDate,
    cadence: parsed.data.cadence,
  });

  // New confirmed bill affects bills-before-payday + safe-to-spend.
  await recomputeRunwayForUser(user.userId);

  return ok(
    {
      bill: {
        id: bill.id,
        merchantName: bill.merchant_name,
        amountEstimate: bill.amount_estimate,
        cadence: bill.cadence,
        nextExpectedDate: bill.next_expected_date,
        status: bill.status,
      },
    },
    { status: 201 },
  );
}
