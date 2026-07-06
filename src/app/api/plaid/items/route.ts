/**
 * GET /api/plaid/items — list the caller's linked banks (Plaid items).
 *
 * Ownership-scoped. Returns only id / institution name / status — never the
 * encrypted access token or any account/transaction data. Used by the "manage
 * linked banks / disconnect" UI.
 */
import type { NextRequest } from 'next/server';
import { getUserFromRequest } from '@/lib/api/auth';
import { plaidItemsRepo } from '@/lib/db/repositories';
import { ok, unauthorized } from '@/lib/api/responses';

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return unauthorized();

  const items = await plaidItemsRepo.listByUser(user.userId);
  return ok({
    items: items.map((item) => ({
      id: item.id,
      institutionName: item.institution_name,
      status: item.status,
    })),
  });
}
