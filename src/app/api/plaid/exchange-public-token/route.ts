/**
 * POST /api/plaid/exchange-public-token
 *
 * Auth-gated. Exchanges the Link public_token for an access token, ENCRYPTS and
 * stores it server-side (via plaidItemsRepo.create), fetches accounts, and
 * returns only non-sensitive metadata. The plaintext access token is never
 * returned to the client or logged.
 */
import type { NextRequest } from 'next/server';
import { CountryCode } from 'plaid';
import { getUserFromRequest } from '@/lib/api/auth';
import { getPlaidClient } from '@/lib/plaid/client';
import { exchangePublicTokenSchema } from '@/lib/api/schemas';
import { plaidAccountToRow } from '@/lib/plaid/mappers';
import { plaidItemsRepo, accountsRepo } from '@/lib/db/repositories';
import { ok, badRequest, unauthorized, serverError } from '@/lib/api/responses';

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return unauthorized();

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return badRequest('Request body must be valid JSON');
  }
  const parsed = exchangePublicTokenSchema.safeParse(json);
  if (!parsed.success) {
    return badRequest('Invalid exchange payload', parsed.error.flatten());
  }

  const plaid = getPlaidClient();
  try {
    const { data: exchange } = await plaid.itemPublicTokenExchange({
      public_token: parsed.data.publicToken,
    });

    // Best-effort institution name (not critical to onboarding).
    let institutionName: string | null = null;
    try {
      const { data: itemData } = await plaid.itemGet({ access_token: exchange.access_token });
      const institutionId = itemData.item.institution_id;
      if (institutionId) {
        const { data: inst } = await plaid.institutionsGetById({
          institution_id: institutionId,
          country_codes: [CountryCode.Us],
        });
        institutionName = inst.institution.name;
      }
    } catch {
      // ignore — institution name is optional
    }

    // Encrypts the access token before it touches the DB.
    const item = await plaidItemsRepo.create({
      userId: user.userId,
      plaidItemId: exchange.item_id,
      accessToken: exchange.access_token,
      institutionName,
    });

    const { data: accountsData } = await plaid.accountsGet({ access_token: exchange.access_token });
    const rows = accountsData.accounts.map((a) => plaidAccountToRow(user.userId, item.id, a));
    await accountsRepo.upsertMany(rows);

    return ok(
      {
        item: { id: item.id, institutionName },
        accounts: rows.map((r) => ({
          plaidAccountId: r.plaid_account_id,
          name: r.name,
          mask: r.mask,
          type: r.type,
          subtype: r.subtype,
        })),
      },
      { status: 201 },
    );
  } catch {
    return serverError('Failed to exchange public token');
  }
}
