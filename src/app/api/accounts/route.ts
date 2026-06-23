/**
 * GET /api/accounts — the caller's linked accounts and whether each counts
 * toward the runway. Auth-gated and user-scoped. Balances are the user's own
 * data (shown so they can decide which accounts to include).
 */
import type { NextRequest } from 'next/server';
import { getUserFromRequest } from '@/lib/api/auth';
import { accountsRepo } from '@/lib/db/repositories';
import { ok, unauthorized } from '@/lib/api/responses';

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return unauthorized();

  const accounts = await accountsRepo.listByUser(user.userId);
  return ok({
    accounts: accounts.map((a) => ({
      id: a.id,
      name: a.name,
      mask: a.mask,
      type: a.type,
      subtype: a.subtype,
      balance: a.available_balance ?? a.current_balance,
      includedInRunway: a.included_in_runway,
    })),
  });
}
