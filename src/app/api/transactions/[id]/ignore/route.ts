/**
 * POST /api/transactions/:id/ignore — exclude a transaction from daily spend.
 *
 * TODO(phase-5): authenticate, verify the transaction belongs to the caller,
 * set `ignored=true` via transactionsRepo.setIgnored, and recompute the runway
 * snapshot. The ownership check is enforced in the repo (user_id guard) + RLS.
 */
import type { NextRequest } from 'next/server';
import { notImplemented, badRequest } from '@/lib/api/responses';

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!id) return badRequest('Missing transaction id');

  return notImplemented({
    endpoint: 'POST /api/transactions/:id/ignore',
    phase: 'Phase 5',
    todo: `Mark transaction ${id} ignored (ownership-checked) and recompute the runway snapshot.`,
  });
}
