/**
 * POST /api/transactions/:id/ignore — include/exclude a transaction from spend.
 *
 * Auth-gated and ownership-scoped (the repo guards on user_id; RLS backstops).
 * Body `{ ignored?: boolean }` (defaults to true). Recomputes the runway after
 * the change so "spent today" / safe-to-spend reflect it.
 */
import type { NextRequest } from 'next/server';
import { getUserFromRequest } from '@/lib/api/auth';
import { ignoreTransactionSchema } from '@/lib/api/schemas';
import { transactionsRepo } from '@/lib/db/repositories';
import { recomputeRunwayForUser } from '@/lib/services/runway';
import { ok, badRequest, unauthorized } from '@/lib/api/responses';

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getUserFromRequest(req);
  if (!user) return unauthorized();

  const { id } = await ctx.params;
  if (!id) return badRequest('Missing transaction id');

  let body: unknown = {};
  try {
    const text = await req.text();
    if (text) body = JSON.parse(text);
  } catch {
    return badRequest('Request body must be valid JSON');
  }
  const parsed = ignoreTransactionSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest('Invalid ignore payload', parsed.error.flatten());
  }

  await transactionsRepo.setIgnored(user.userId, id, parsed.data.ignored);
  await recomputeRunwayForUser(user.userId);
  return ok({ id, ignored: parsed.data.ignored });
}
