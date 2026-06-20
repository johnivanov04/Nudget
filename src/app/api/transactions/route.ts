/**
 * GET /api/transactions — the caller's transactions for the review screen.
 *
 * Auth-gated and user-scoped. Returns the user's OWN transactions (their data,
 * shown back to them) with date/limit/offset filters. This is not analytics, so
 * merchant/amount are intentionally included for the owner only.
 */
import type { NextRequest } from 'next/server';
import { getUserFromRequest } from '@/lib/api/auth';
import { transactionsRepo } from '@/lib/db/repositories';
import { ok, unauthorized } from '@/lib/api/responses';

function parseLimit(value: string | null): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 100;
  return Math.min(Math.floor(n), 500);
}
function parseOffset(value: string | null): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return unauthorized();

  const sp = req.nextUrl.searchParams;
  const rows = await transactionsRepo.listByUser(user.userId, {
    from: sp.get('from') ?? undefined,
    to: sp.get('to') ?? undefined,
    limit: parseLimit(sp.get('limit')),
    offset: parseOffset(sp.get('offset')),
  });

  return ok({
    transactions: rows.map((t) => ({
      id: t.id,
      merchantName: t.merchant_name,
      amount: t.amount,
      date: t.date,
      category: t.category,
      pending: t.pending,
      ignored: t.ignored,
      isSpending: t.is_spending,
    })),
  });
}
