/**
 * Next.js instrumentation hook — initializes Sentry on the server at startup.
 *
 * No-ops unless SENTRY_DSN is set, so local/dev and any unconfigured environment
 * are completely unaffected. Errors are captured explicitly via `reportError`
 * (which scrubs financial data first); we keep performance tracing off for now.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs' && process.env.SENTRY_DSN) {
    const Sentry = await import('@sentry/nextjs');
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
      tracesSampleRate: 0, // errors only, no perf sampling
      sendDefaultPii: false, // don't attach IP/headers/user PII
    });
  }
}
