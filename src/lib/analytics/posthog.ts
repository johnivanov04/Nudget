/**
 * Server-side PostHog client for privacy-safe product analytics.
 *
 * No-ops unless POSTHOG_KEY is configured. Events are captured with `flushAt: 1`
 * so they send promptly in a serverless environment (Vercel Fluid Compute keeps
 * instances warm long enough to flush). Only bucketed/scrubbed properties are
 * ever passed in (see `buildAnalyticsEvent`), and the distinct id is the user's
 * opaque UUID — never PII.
 */
import { PostHog } from 'posthog-node';
import { getEnv } from '@/lib/env';

let client: PostHog | null | undefined;

function getClient(): PostHog | null {
  if (client !== undefined) return client;
  let key: string | undefined;
  let host: string | undefined;
  try {
    const env = getEnv();
    key = env.POSTHOG_KEY;
    host = env.POSTHOG_HOST;
  } catch {
    client = null;
    return null;
  }
  if (!key) {
    client = null;
    return null;
  }
  client = new PostHog(key, {
    host: host ?? 'https://us.i.posthog.com',
    flushAt: 1,
    flushInterval: 0,
  });
  return client;
}

export function captureAnalytics(
  distinctId: string,
  event: string,
  properties: Record<string, string | number | boolean>,
): void {
  const posthog = getClient();
  if (!posthog) return;
  posthog.capture({ distinctId, event, properties });
}
