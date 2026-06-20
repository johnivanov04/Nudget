/**
 * POST /api/bills/:id/confirm — confirm, edit, or reject a detected bill.
 *
 * Auth-gated and ownership-scoped. Confirmed user data overrides algorithmic
 * guesses. After the change, the runway snapshot is recomputed so the dashboard
 * reflects it immediately.
 */
import type { NextRequest } from 'next/server';
import { getUserFromRequest } from '@/lib/api/auth';
import { confirmBillSchema } from '@/lib/api/schemas';
import { recurringBillsRepo } from '@/lib/db/repositories';
import { recomputeRunwayForUser } from '@/lib/services/runway';
import { ok, badRequest, unauthorized, serverError } from '@/lib/api/responses';

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getUserFromRequest(req);
  if (!user) return unauthorized();

  const { id } = await ctx.params;
  if (!id) return badRequest('Missing bill id');

  let body: unknown = {};
  try {
    const text = await req.text();
    if (text) body = JSON.parse(text);
  } catch {
    return badRequest('Request body must be valid JSON');
  }
  const parsed = confirmBillSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest('Invalid confirm payload', parsed.error.flatten());
  }

  let updated;
  try {
    updated = await recurringBillsRepo.update(user.userId, id, {
      status: parsed.data.status,
      ...(parsed.data.amountEstimate !== undefined
        ? { amount_estimate: parsed.data.amountEstimate }
        : {}),
      ...(parsed.data.nextExpectedDate ? { next_expected_date: parsed.data.nextExpectedDate } : {}),
      ...(parsed.data.cadence ? { cadence: parsed.data.cadence } : {}),
    });
  } catch {
    // The update is ownership-scoped; a miss means no such bill for this user.
    return serverError('Failed to update bill');
  }

  // Reflect the change in the runway immediately.
  await recomputeRunwayForUser(user.userId);

  return ok({
    bill: {
      id: updated.id,
      status: updated.status,
      amountEstimate: updated.amount_estimate,
      nextExpectedDate: updated.next_expected_date,
      cadence: updated.cadence,
    },
  });
}
