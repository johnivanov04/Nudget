/**
 * POST /api/plaid/item/:id/link-token — create an UPDATE-MODE Link token to
 * reconnect an existing item whose connection needs re-authentication.
 *
 * Ownership-scoped. Passing the item's existing `access_token` (never products)
 * puts Link into update mode: the user re-authenticates with their bank and the
 * SAME connection is restored, preserving history + account settings. The token
 * is decrypted in-memory and never returned to the client.
 */
import type { NextRequest } from 'next/server';
import { CountryCode } from 'plaid';
import { getUserFromRequest } from '@/lib/api/auth';
import { plaidItemsRepo } from '@/lib/db/repositories';
import { getPlaidClient } from '@/lib/plaid/client';
import { getEnv } from '@/lib/env';
import { ok, unauthorized, badRequest, notFound, serverError } from '@/lib/api/responses';

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getUserFromRequest(req);
  if (!user) return unauthorized();

  const { id } = await ctx.params;
  if (!id) return badRequest('Missing Plaid item id');

  const item = await plaidItemsRepo.getOwned(user.userId, id);
  if (!item) return notFound('No such Plaid item for this user');

  const { PLAID_WEBHOOK_URL: webhookUrl, PLAID_REDIRECT_URI: redirectUri } = getEnv();
  try {
    const accessToken = await plaidItemsRepo.getDecryptedAccessToken(id);
    const { data } = await getPlaidClient().linkTokenCreate({
      user: { client_user_id: user.userId },
      client_name: 'Nudget',
      country_codes: [CountryCode.Us],
      language: 'en',
      access_token: accessToken, // update mode — no `products`
      ...(webhookUrl ? { webhook: webhookUrl } : {}),
      ...(redirectUri ? { redirect_uri: redirectUri } : {}),
    });
    return ok({ linkToken: data.link_token, expiration: data.expiration });
  } catch {
    return serverError('Failed to create reconnect link token');
  }
}
