/**
 * GET /api/admin/metrics — privacy-safe operational metrics for the beta admin.
 *
 * Auth-gated AND admin-gated (the caller's user id must be in `ADMIN_USER_IDS`).
 * Returns aggregate COUNTS only — never raw financial data (no merchant names,
 * balances, amounts, or transaction ids).
 */
import type { NextRequest } from 'next/server';
import { getUserFromRequest } from '@/lib/api/auth';
import { isAdmin } from '@/lib/api/admin';
import { getEnv } from '@/lib/env';
import { adminRepo } from '@/lib/db/repositories';
import { ok, unauthorized, forbidden } from '@/lib/api/responses';

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return unauthorized();
  if (!isAdmin(user.userId, getEnv().ADMIN_USER_IDS)) return forbidden();

  const metrics = await adminRepo.metrics();
  return ok({ metrics });
}
