/**
 * POST /api/feedback
 *
 * Phase 1: validates the feedback payload (the stable contract the app uses).
 * Persistence is deferred to Phase 2 once auth + DB are wired.
 *
 * Privacy: free_text must be screened/minimized before storage and must NEVER
 * be forwarded to third-party analytics (see lib/analytics/sanitize).
 *
 * TODO(phase-2): authenticate and persist via feedbackEventsRepo.insert.
 */
import type { NextRequest } from 'next/server';
import { feedbackSchema } from '@/lib/api/schemas';
import { ok, badRequest } from '@/lib/api/responses';

export async function POST(req: NextRequest) {
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

  return ok(
    {
      accepted: true,
      persisted: false,
      note: 'Phase 1: validated but not persisted (auth + DB land in Phase 2).',
    },
    { status: 202 },
  );
}
