import { getSupabaseAdmin } from '@/lib/supabase/admin';

/**
 * Admin metrics — aggregate COUNTS only. Never selects financial rows, so no raw
 * merchant names, balances, or amounts can leak. Read-only.
 */
async function count(
  table: string,
  filters: Record<string, string | boolean> = {},
): Promise<number> {
  let q = getSupabaseAdmin().from(table).select('*', { count: 'exact', head: true });
  for (const [k, v] of Object.entries(filters)) q = q.eq(k, v);
  const { count: c, error } = await q;
  if (error) throw error;
  return c ?? 0;
}

export interface AdminMetrics {
  users: { total: number; onboarded: number };
  plaidItems: { total: number; active: number; loginRequired: number; error: number };
  bills: { candidate: number; confirmed: number; rejected: number };
  nudges: { sent: number };
}

export const adminRepo = {
  async metrics(): Promise<AdminMetrics> {
    const [
      users,
      onboarded,
      itemsTotal,
      itemsActive,
      itemsLogin,
      itemsError,
      billsCandidate,
      billsConfirmed,
      billsRejected,
      nudgesSent,
    ] = await Promise.all([
      count('profiles'),
      count('profiles', { onboarding_completed: true }),
      count('plaid_items'),
      count('plaid_items', { status: 'active' }),
      count('plaid_items', { status: 'login_required' }),
      count('plaid_items', { status: 'error' }),
      count('recurring_bills', { status: 'candidate' }),
      count('recurring_bills', { status: 'confirmed' }),
      count('recurring_bills', { status: 'rejected' }),
      count('nudge_events'),
    ]);

    return {
      users: { total: users, onboarded },
      plaidItems: {
        total: itemsTotal,
        active: itemsActive,
        loginRequired: itemsLogin,
        error: itemsError,
      },
      bills: { candidate: billsCandidate, confirmed: billsConfirmed, rejected: billsRejected },
      nudges: { sent: nudgesSent },
    };
  },
};
