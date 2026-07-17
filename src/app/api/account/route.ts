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
import { removeAllPlaidItemsUpstream } from '@/lib/plaid/removeItem';
import { ok, unauthorized, serverError } from '@/lib/api/responses';

export async function DELETE(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return unauthorized();

  // Release the user's Plaid Items upstream (best-effort) so we stop being billed
  // for them, then delete the auth user — which cascades all local data.
  await removeAllPlaidItemsUpstream(user.userId);

  const { error } = await getSupabaseAdmin().auth.admin.deleteUser(user.userId);
  if (error) {
    return serverError('Failed to delete account');
  }

  return ok({ deleted: true });
}
