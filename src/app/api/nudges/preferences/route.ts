/**
 * GET/POST /api/nudges/preferences — read or update notification preferences.
 *
 * Auth-gated and user-scoped. GET returns the saved preferences, or sensible
 * defaults when none exist yet.
 */
import type { NextRequest } from 'next/server';
import { getUserFromRequest } from '@/lib/api/auth';
import { notificationPreferencesSchema } from '@/lib/api/schemas';
import { notificationPreferencesRepo } from '@/lib/db/repositories';
import type { NotificationPreferencesRow } from '@/lib/db/types';
import { ok, badRequest, unauthorized } from '@/lib/api/responses';

const DEFAULTS = {
  enabled: true,
  morningEnabled: true,
  billApproachEnabled: true,
  dangerEnabled: true,
  tone: 'gentle' as const,
  morningHour: 8,
  allowExtra: false,
};

function toClient(row: NotificationPreferencesRow) {
  return {
    enabled: row.enabled,
    morningEnabled: row.morning_enabled,
    billApproachEnabled: row.bill_approach_enabled,
    dangerEnabled: row.danger_enabled,
    tone: row.tone,
    morningHour: row.morning_hour,
    allowExtra: row.allow_extra,
  };
}

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return unauthorized();

  const row = await notificationPreferencesRepo.getByUser(user.userId);
  return ok({ preferences: row ? toClient(row) : DEFAULTS });
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
  const parsed = notificationPreferencesSchema.safeParse(json);
  if (!parsed.success) {
    return badRequest('Invalid notification preferences', parsed.error.flatten());
  }

  const b = parsed.data;
  const saved = await notificationPreferencesRepo.upsert({
    user_id: user.userId,
    ...(b.enabled !== undefined ? { enabled: b.enabled } : {}),
    ...(b.morningEnabled !== undefined ? { morning_enabled: b.morningEnabled } : {}),
    ...(b.billApproachEnabled !== undefined
      ? { bill_approach_enabled: b.billApproachEnabled }
      : {}),
    ...(b.dangerEnabled !== undefined ? { danger_enabled: b.dangerEnabled } : {}),
    ...(b.tone !== undefined ? { tone: b.tone } : {}),
    ...(b.morningHour !== undefined ? { morning_hour: b.morningHour } : {}),
    ...(b.allowExtra !== undefined ? { allow_extra: b.allowExtra } : {}),
  });

  return ok({ preferences: toClient(saved) });
}
