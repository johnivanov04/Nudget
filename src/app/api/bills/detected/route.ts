/**
 * GET /api/bills/detected — detected + confirmed recurring bills for review.
 *
 * TODO(phase-4): authenticate and return the user's recurring_bills (candidate
 * and confirmed) with confidence + next expected date. Detection itself runs in
 * the bill-detection job (Week 6).
 */
import { notImplemented } from '@/lib/api/responses';

export async function GET() {
  return notImplemented({
    endpoint: 'GET /api/bills/detected',
    phase: 'Phase 4',
    todo: 'Authenticate and return detected + confirmed recurring bills with confidence and next date.',
  });
}
