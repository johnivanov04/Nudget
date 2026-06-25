/**
 * APNs (Apple Push Notification service) sender — token-based auth.
 *
 * Mirrors the no-third-party-dependency approach used for Plaid webhook
 * verification: we mint the provider JWT with Node's built-in `crypto` and talk
 * to APNs over the built-in `http2` module. No `apn`/`jsonwebtoken` packages.
 *
 * Two non-obvious correctness details, both handled below:
 *  1. The provider JWT is ES256 (ECDSA P-256). Node's default ECDSA output is
 *     DER; JWT requires the fixed-length IEEE-P1363 (r‖s) encoding, so we pass
 *     `dsaEncoding: 'ieee-p1363'`.
 *  2. APNs rejects provider tokens older than 1h and rate-limits minting to once
 *     per ~20 min, so we cache and refresh on a 50-min cadence.
 *
 * Push payloads carry only the rendered (amount-free) title/body — never any
 * financial figures. See `nudgeCopy.ts`.
 */
import { createPrivateKey, sign as cryptoSign, type KeyObject } from 'node:crypto';
import http2 from 'node:http2';
import { getEnv } from '@/lib/env';

export interface ApnsConfig {
  keyId: string;
  teamId: string;
  privateKeyPem: string;
  topic: string;
  env: 'sandbox' | 'production';
}

export interface ApnsAlert {
  deviceToken: string;
  title: string;
  body: string;
}

export interface ApnsResult {
  deviceToken: string;
  /** HTTP status from APNs (200 = delivered). 0 = transport error. */
  status: number;
  /** APNs `reason` string on failure (e.g. 'Unregistered', 'BadDeviceToken'). */
  reason?: string;
}

const TOKEN_TTL_MS = 50 * 60 * 1000; // refresh well inside APNs' 1h cap

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Read APNs settings from the environment. Returns null (push disabled) unless
 * every required value is present, so unconfigured environments simply no-op.
 */
export function getApnsConfig(): ApnsConfig | null {
  let env: ReturnType<typeof getEnv>;
  try {
    env = getEnv();
  } catch {
    return null; // env not fully configured → push disabled, never throws
  }
  if (!env.APNS_KEY_ID || !env.APNS_TEAM_ID || !env.APNS_PRIVATE_KEY || !env.APNS_TOPIC) {
    return null;
  }
  return {
    keyId: env.APNS_KEY_ID,
    teamId: env.APNS_TEAM_ID,
    // Tolerate \n-escaped keys (common when stored in a single-line env var).
    privateKeyPem: env.APNS_PRIVATE_KEY.includes('\\n')
      ? env.APNS_PRIVATE_KEY.replace(/\\n/g, '\n')
      : env.APNS_PRIVATE_KEY,
    topic: env.APNS_TOPIC,
    env: env.APNS_ENV ?? (env.PLAID_ENV === 'production' ? 'production' : 'sandbox'),
  };
}

/** Mint the ES256 provider JWT APNs expects in the `authorization` header. */
export function buildApnsProviderToken(config: ApnsConfig, nowMs: number = Date.now()): string {
  const header = base64url(JSON.stringify({ alg: 'ES256', kid: config.keyId }));
  const claims = base64url(JSON.stringify({ iss: config.teamId, iat: Math.floor(nowMs / 1000) }));
  const signingInput = `${header}.${claims}`;
  const key: KeyObject = createPrivateKey(config.privateKeyPem);
  const signature = cryptoSign('sha256', Buffer.from(signingInput), {
    key,
    dsaEncoding: 'ieee-p1363',
  });
  return `${signingInput}.${base64url(signature)}`;
}

// Cached provider token (keyed by Key ID so a key rotation invalidates it).
let cachedToken: { keyId: string; token: string; mintedAt: number } | null = null;

function providerToken(config: ApnsConfig, nowMs: number): string {
  if (cachedToken && cachedToken.keyId === config.keyId && nowMs - cachedToken.mintedAt < TOKEN_TTL_MS) {
    return cachedToken.token;
  }
  const token = buildApnsProviderToken(config, nowMs);
  cachedToken = { keyId: config.keyId, token, mintedAt: nowMs };
  return token;
}

/** Test-only: drop the cached provider token. */
export function __resetApnsTokenCache(): void {
  cachedToken = null;
}

function hostFor(env: ApnsConfig['env']): string {
  return env === 'production' ? 'https://api.push.apple.com' : 'https://api.sandbox.push.apple.com';
}

/**
 * Send one alert per device token over a single shared HTTP/2 connection.
 * Best-effort: every result is returned (success or failure) so the caller can
 * prune dead tokens; this never throws for an individual bad token.
 */
export async function sendApnsAlerts(
  config: ApnsConfig,
  alerts: ApnsAlert[],
  nowMs: number = Date.now(),
): Promise<ApnsResult[]> {
  if (alerts.length === 0) return [];
  const token = providerToken(config, nowMs);
  const client = http2.connect(hostFor(config.env));

  const send = (alert: ApnsAlert): Promise<ApnsResult> =>
    new Promise((resolve) => {
      const body = JSON.stringify({ aps: { alert: { title: alert.title, body: alert.body }, sound: 'default' } });
      const req = client.request({
        ':method': 'POST',
        ':path': `/3/device/${alert.deviceToken}`,
        authorization: `bearer ${token}`,
        'apns-topic': config.topic,
        'apns-push-type': 'alert',
        'apns-priority': '10',
        'content-type': 'application/json',
      });

      let status = 0;
      let raw = '';
      req.on('response', (headers) => {
        status = Number(headers[':status']) || 0;
      });
      req.setEncoding('utf8');
      req.on('data', (chunk) => {
        raw += chunk;
      });
      req.on('end', () => {
        let reason: string | undefined;
        if (status !== 200 && raw) {
          try {
            reason = JSON.parse(raw).reason;
          } catch {
            /* non-JSON error body — leave reason undefined */
          }
        }
        resolve({ deviceToken: alert.deviceToken, status, reason });
      });
      req.on('error', () => resolve({ deviceToken: alert.deviceToken, status: 0, reason: 'transport_error' }));
      req.end(body);
    });

  try {
    return await Promise.all(alerts.map(send));
  } finally {
    client.close();
  }
}
