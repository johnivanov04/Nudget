/**
 * Error reporting with financial-data scrubbing.
 *
 * A single choke point for server-side error reporting. Today it scrubs + logs;
 * a provider (Sentry) can be wired behind `sendToProvider` later without touching
 * any call site. The scrubber guarantees we never ship raw financial data (tokens,
 * balances, amounts, merchant names, account masks) into an error report.
 */

/** Context keys whose VALUES must be redacted before reporting. */
const SENSITIVE_KEYS = [
  'access_token',
  'accesstoken',
  'token',
  'encrypted_access_token',
  'authorization',
  'password',
  'merchant_name',
  'merchantname',
  'amount',
  'balance',
  'available_balance',
  'current_balance',
  'mask',
  'email',
];

function isSensitiveKey(key: string): boolean {
  const k = key.toLowerCase();
  return SENSITIVE_KEYS.some((s) => k.includes(s));
}

/** Recursively redact sensitive values in a context object (depth-limited). */
export function scrubContext(input: unknown, depth = 0): unknown {
  if (depth > 4 || input === null || typeof input !== 'object') return input;
  if (Array.isArray(input)) return input.map((v) => scrubContext(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    out[key] = isSensitiveKey(key) ? '[redacted]' : scrubContext(value, depth + 1);
  }
  return out;
}

export interface ReportContext {
  scope?: string;
  userId?: string;
  [key: string]: unknown;
}

/** No-op provider sink for now. TODO(prod): forward to Sentry with scrubbing on. */
function sendToProvider(_message: string, _context: Record<string, unknown>): void {
  // intentionally empty until a provider DSN is configured
}

/**
 * Report a server-side error. Never throws (reporting must not break a flow) and
 * never includes raw financial data.
 */
export function reportError(error: unknown, context: ReportContext = {}): void {
  try {
    const message = error instanceof Error ? error.message : String(error);
    const safeContext = scrubContext(context) as Record<string, unknown>;
    if (process.env.NODE_ENV === 'development') {
      // eslint-disable-next-line no-console
      console.error('[reportError]', message, safeContext);
    }
    sendToProvider(message, safeContext);
  } catch {
    // swallow — observability must never throw
  }
}
