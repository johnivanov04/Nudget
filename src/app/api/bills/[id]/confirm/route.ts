/**
 * POST /api/bills/:id/confirm — confirm or edit a detected recurring bill.
 *
 * TODO(phase-4): authenticate, verify ownership, set status='confirmed' (and any
 * edited amount/date) via recurringBillsRepo.update, then recompute the runway.
 * Confirmed user data outranks algorithmic guesses.
 */
import type { NextRequest } from 'next/server';
import { notImplemented, badRequest } from '@/lib/api/responses';

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!id) return badRequest('Missing bill id');

  return notImplemented({
    endpoint: 'POST /api/bills/:id/confirm',
    phase: 'Phase 4',
    todo: `Confirm/edit bill ${id} (ownership-checked); confirmed data overrides guesses; recompute runway.`,
  });
}
