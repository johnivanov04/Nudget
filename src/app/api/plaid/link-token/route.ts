/**
 * POST /api/plaid/link-token — create a short-lived Plaid Link token.
 *
 * Auth-gated. Calls Plaid server-side with the secret (never sent to the client)
 * and returns only the link_token + expiration for the iOS app to open Link.
 */
import type { NextRequest } from 'next/server';
import { CountryCode, Products } from 'plaid';
import { getUserFromRequest } from '@/lib/api/auth';
import { getPlaidClient } from '@/lib/plaid/client';
import { getEnv } from '@/lib/env';
import { ok, unauthorized, serverError } from '@/lib/api/responses';

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return unauthorized();

  const webhookUrl = getEnv().PLAID_WEBHOOK_URL;
  try {
    const { data } = await getPlaidClient().linkTokenCreate({
      user: { client_user_id: user.userId },
      client_name: 'Nudget',
      products: [Products.Transactions],
      country_codes: [CountryCode.Us],
      language: 'en',
      ...(webhookUrl ? { webhook: webhookUrl } : {}),
    });
    return ok({ linkToken: data.link_token, expiration: data.expiration });
  } catch {
    // Never surface Plaid error internals (may reference credentials).
    return serverError('Failed to create Plaid link token');
  }
}
