/**
 * POST /api/feedback
 *
 * Authenticates, validates, and persists user feedback tied to an event
 * (bill / nudge / runway / saved-fee). Privacy: `free_text` is stored as-is for
 * the user's own record but must NEVER be forwarded to third-party analytics
 * (see lib/analytics/sanitize); analytics receive only the event_type + rating.
 */
import type { NextRequest } from 'next/server';
import { getUserFromRequest } from '@/lib/api/auth';
import { feedbackSchema } from '@/lib/api/schemas';
import { feedbackEventsRepo } from '@/lib/db/repositories';
import { analyticsEvents, emitAnalytics } from '@/lib/analytics/events';
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

  const parsed = feedbackSchema.safeParse(json);
  if (!parsed.success) {
    return badRequest('Invalid feedback payload', parsed.error.flatten());
  }

  const body = parsed.data;
  const saved = await feedbackEventsRepo.insert({
    user_id: user.userId,
    event_type: body.eventType,
    event_id: body.eventId ?? null,
    rating: body.rating ?? null,
    free_text: body.freeText ?? null,
  });

  // Privacy-safe analytics (no free_text, no raw data).
  if (body.eventType === 'nudge_helpful') {
    emitAnalytics(
      analyticsEvents.nudgeFeedbackSubmitted({
        helpful: (body.rating ?? 0) >= 3,
        rating: body.rating ?? null,
      }),
      user.userId,
    );
  } else if (body.eventType === 'saved_fee') {
    // The key beta success metric.
    emitAnalytics(analyticsEvents.outcomeReported('saved_fee'), user.userId);
  }

  return ok({ id: saved.id, accepted: true, persisted: true }, { status: 201 });
}
