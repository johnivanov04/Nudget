/**
 * Environment-variable validation.
 *
 * All required secrets/config are validated through a single zod schema so the
 * server fails fast and loudly on misconfiguration instead of leaking undefined
 * values into Plaid calls or the encryption helper.
 *
 * - `parseEnv(raw)` is pure and testable (pass any object).
 * - `getEnv()` validates `process.env` once and memoizes the result. It is the
 *   only thing that touches `process.env`, and it is never imported by the pure
 *   domain layer (which must stay free of environment concerns).
 */
import { z } from 'zod';

export const envSchema = z.object({
  // --- Supabase (public) ---
  NEXT_PUBLIC_SUPABASE_URL: z.string().url('NEXT_PUBLIC_SUPABASE_URL must be a valid URL'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, 'NEXT_PUBLIC_SUPABASE_ANON_KEY is required'),

  // --- Supabase (server only) ---
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'SUPABASE_SERVICE_ROLE_KEY is required'),

  // --- Plaid (server only) ---
  PLAID_CLIENT_ID: z.string().min(1, 'PLAID_CLIENT_ID is required'),
  PLAID_SECRET: z.string().min(1, 'PLAID_SECRET is required'),
  PLAID_ENV: z.enum(['sandbox', 'development', 'production'], {
    errorMap: () => ({ message: 'PLAID_ENV must be one of: sandbox, development, production' }),
  }),
  // Optional: public HTTPS URL Plaid will POST webhooks to (set on link tokens).
  PLAID_WEBHOOK_URL: z.string().url().optional(),

  // Optional: comma-separated user ids allowed to read admin metrics.
  ADMIN_USER_IDS: z.string().optional(),

  // Optional: shared secret for cron endpoints (Vercel Cron sends it as a bearer).
  CRON_SECRET: z.string().optional(),

  // --- Encryption (server only) ---
  TOKEN_ENCRYPTION_KEY: z
    .string()
    .regex(
      /^[0-9a-fA-F]{64}$/,
      'TOKEN_ENCRYPTION_KEY must be 64 hex chars (32 bytes). Generate with: openssl rand -hex 32',
    ),
});

export type Env = z.infer<typeof envSchema>;

/** Validate an arbitrary object against the env schema. Pure — used by tests. */
export function parseEnv(raw: Record<string, unknown>): Env {
  return envSchema.parse(raw);
}

/** Same as {@link parseEnv} but returns a result instead of throwing. */
export function safeParseEnv(raw: Record<string, unknown>) {
  return envSchema.safeParse(raw);
}

let cached: Env | null = null;

/**
 * Validate and memoize `process.env`. Call this from server code only.
 * Throws a readable aggregated error if anything is missing/invalid.
 */
export function getEnv(): Env {
  if (cached) return cached;
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  cached = result.data;
  return cached;
}

/** Test-only: clear the memoized env so a fresh process.env is re-read. */
export function __resetEnvCacheForTests(): void {
  cached = null;
}
