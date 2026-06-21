/**
 * Cron authentication. Vercel Cron automatically sends
 * `Authorization: Bearer <CRON_SECRET>` when `CRON_SECRET` is configured, so the
 * same check works locally and in production. Pure + testable.
 */
import { extractBearerToken } from './auth';

export function isValidCronRequest(
  authHeader: string | null | undefined,
  cronSecret: string | undefined,
): boolean {
  if (!cronSecret) return false; // no secret configured -> reject (fail closed)
  const token = extractBearerToken(authHeader);
  return token === cronSecret;
}
