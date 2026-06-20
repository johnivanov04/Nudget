/**
 * DELETE /api/account — delete the authenticated user's account.
 *
 * Privacy requirement: users must be able to delete their account (and all their
 * financial data) from inside the app. Deleting the Supabase auth user cascades
 * through profiles -> plaid_items -> accounts -> transactions and every other
 * user-scoped table (all FKs are ON DELETE CASCADE), so encrypted tokens,
 * balances, and transactions are all removed.
 */
import type { NextRequest } from 'next/server';
import { getUserFromRequest } from '@/lib/api/auth';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { ok, unauthorized, serverError } from '@/lib/api/responses';

export async function DELETE(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return unauthorized();

  // TODO(phase-3): call Plaid `/item/remove` for each linked item before delete
  // so upstream access tokens are invalidated, not just removed locally.
  const { error } = await getSupabaseAdmin().auth.admin.deleteUser(user.userId);
  if (error) {
    return serverError('Failed to delete account');
  }

  return ok({ deleted: true });
}
