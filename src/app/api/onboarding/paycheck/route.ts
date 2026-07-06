/**
 * /api/onboarding/paycheck
 *
 * GET returns the caller's current schedule (for the "edit payday" screen).
 * POST validates + persists a payday schedule (upsert, one per user), computing
 * the next paydays with the pure engine.
 */
import type { NextRequest } from 'next/server';
import { getUserFromRequest } from '@/lib/api/auth';
import { paycheckScheduleSchema } from '@/lib/api/schemas';
import { previewNextPaydays } from '@/lib/api/runwayService';
import { paycheckSchedulesRepo } from '@/lib/db/repositories';
import { ok, badRequest, unauthorized } from '@/lib/api/responses';

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return unauthorized();

  const row = await paycheckSchedulesRepo.getByUser(user.userId);
  if (!row) return ok({ schedule: null });

  return ok({
    schedule: {
      id: row.id,
      frequency: row.frequency,
      lastPaycheckDate: row.last_paycheck_date,
      nextPaycheckDate: row.next_paycheck_date,
      weekendRule: row.weekend_rule,
    },
  });
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return unauthorized();

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
  // Reference from the override if present, else anchor on the last paycheck.
  const reference = body.manualNextPaycheckDate ?? body.lastPaycheckDate;
  const nextPaydays = previewNextPaydays(body, reference, 3);
  const nextPayday = nextPaydays[0] ?? null;

  const saved = await paycheckSchedulesRepo.upsert({
    user_id: user.userId,
    frequency: body.frequency,
    last_paycheck_date: body.lastPaycheckDate,
    next_paycheck_date: nextPayday,
    weekend_rule: body.weekendRule,
    custom_rules: body.semimonthlyDays ? { semimonthlyDays: body.semimonthlyDays } : null,
  });

  return ok({
    schedule: {
      id: saved.id,
      frequency: saved.frequency,
      lastPaycheckDate: saved.last_paycheck_date,
      nextPaycheckDate: saved.next_paycheck_date,
      weekendRule: saved.weekend_rule,
    },
    nextPaydays,
    nextPayday,
    persisted: true,
  });
}
