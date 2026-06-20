/**
 * POST /api/onboarding/paycheck
 *
 * Phase 1: validates the payday schedule and returns a deterministic preview of
 * the next three paydays computed by the pure engine. This is the contract the
 * iOS onboarding screen builds against today.
 *
 * TODO(phase-2/4): authenticate the caller and persist the schedule via
 * paycheckSchedulesRepo.upsert (and store the computed next_paycheck_date).
 */
import type { NextRequest } from 'next/server';
import { paycheckScheduleSchema } from '@/lib/api/schemas';
import { previewNextPaydays } from '@/lib/api/runwayService';
import { ok, badRequest } from '@/lib/api/responses';

export async function POST(req: NextRequest) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return badRequest('Request body must be valid JSON');
  }

  const parsed = paycheckScheduleSchema.safeParse(json);
  if (!parsed.success) {
    return badRequest('Invalid paycheck schedule', parsed.error.flatten());
  }

  const body = parsed.data;
  // Reference from "today" if provided in the cycle, else anchor on last paycheck.
  const reference = body.manualNextPaycheckDate ?? body.lastPaycheckDate;
  const nextPaydays = previewNextPaydays(body, reference, 3);

  return ok({
    schedule: body,
    nextPaydays,
    nextPayday: nextPaydays[0] ?? null,
    persisted: false,
    note: 'Phase 1 preview only — schedule is not yet persisted (auth + DB land in Phase 2).',
  });
}
