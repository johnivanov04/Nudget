/**
 * Server-only Plaid API client.
 *
 * Built lazily from validated env (PLAID_CLIENT_ID / PLAID_SECRET / PLAID_ENV).
 * The Plaid secret lives only here on the server — it is never sent to the
 * client. Import this only from server code (route handlers, jobs).
 */
import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid';
import { getEnv } from '@/lib/env';

let client: PlaidApi | null = null;

export function getPlaidClient(): PlaidApi {
  if (client) return client;
  const env = getEnv();
  const configuration = new Configuration({
    basePath: PlaidEnvironments[env.PLAID_ENV],
    baseOptions: {
      headers: {
        'PLAID-CLIENT-ID': env.PLAID_CLIENT_ID,
        'PLAID-SECRET': env.PLAID_SECRET,
      },
    },
  });
  client = new PlaidApi(configuration);
  return client;
}
