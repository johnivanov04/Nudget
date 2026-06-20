/**
 * Zod request schemas for API routes. Pure and unit-testable.
 *
 * Even stub routes validate their input where a stable contract exists, so the
 * iOS app can be built against real request shapes now and the server just
 * swaps in persistence later.
 */
import { z } from 'zod';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'must be a YYYY-MM-DD date');

export const paycheckScheduleSchema = z.object({
  frequency: z.enum(['weekly', 'biweekly', 'semimonthly', 'monthly', 'custom']),
  lastPaycheckDate: isoDate,
  manualNextPaycheckDate: isoDate.optional(),
  semimonthlyDays: z
    .tuple([z.number().int().min(1).max(31), z.number().int().min(1).max(31)])
    .optional(),
  weekendRule: z.enum(['none', 'before', 'after']).default('none'),
});
export type PaycheckScheduleBody = z.infer<typeof paycheckScheduleSchema>;

const billSchema = z.object({
  amountEstimate: z.number().finite().nonnegative(),
  nextExpectedDate: isoDate,
  status: z.enum(['candidate', 'confirmed', 'rejected', 'archived']),
  confidence: z.number().min(0).max(1).nullish(),
});

const transactionSchema = z.object({
  amount: z.number().finite(),
  date: isoDate,
  category: z.string().nullish(),
  pending: z.boolean().optional(),
  ignored: z.boolean().optional(),
  isSpendingOverride: z.boolean().nullish(),
});

/**
 * Body for POST /api/runway/recalculate.
 *
 * In Phase 1 (no auth/DB), the endpoint computes a snapshot directly from a
 * posted scenario so the engine is exercisable over HTTP. In Phase 4 this is
 * replaced by "load the user's stored data and recompute".
 */
export const recalculateSchema = z.object({
  today: isoDate,
  availableCash: z.number().finite().nullable(),
  transactions: z.array(transactionSchema).default([]),
  bills: z.array(billSchema).default([]),
  schedule: paycheckScheduleSchema,
  safetyBuffer: z.number().finite().nonnegative().optional(),
  includeCandidateBills: z.boolean().optional(),
  cautionDailyFloor: z.number().finite().nonnegative().optional(),
  lastUpdatedAt: z.string().nullish(),
  now: z.string().optional(),
});
export type RecalculateBody = z.infer<typeof recalculateSchema>;

export const feedbackSchema = z.object({
  eventType: z.enum(['bill_prediction', 'nudge_helpful', 'runway_confusing', 'saved_fee', 'other']),
  eventId: z.string().nullish(),
  rating: z.number().int().min(1).max(5).nullish(),
  freeText: z.string().max(2000).nullish(),
});
export type FeedbackBody = z.infer<typeof feedbackSchema>;

// --- Plaid (Phase 3) -------------------------------------------------------

export const exchangePublicTokenSchema = z.object({
  publicToken: z.string().min(1, 'publicToken is required'),
});
export type ExchangePublicTokenBody = z.infer<typeof exchangePublicTokenSchema>;

export const plaidSyncSchema = z.object({
  /** Optional: sync just one item (our row id). Omit to sync all the user's items. */
  itemId: z.string().uuid().optional(),
});
export type PlaidSyncBody = z.infer<typeof plaidSyncSchema>;

export const ignoreTransactionSchema = z.object({
  ignored: z.boolean().default(true),
});
export type IgnoreTransactionBody = z.infer<typeof ignoreTransactionSchema>;

// --- Bills (Phase 4) -------------------------------------------------------

const isoDateForBill = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'must be a YYYY-MM-DD date');

export const confirmBillSchema = z.object({
  /** Confirm (default) or reject the detected bill. */
  status: z.enum(['confirmed', 'rejected']).default('confirmed'),
  amountEstimate: z.number().finite().nonnegative().optional(),
  nextExpectedDate: isoDateForBill.optional(),
  cadence: z.enum(['weekly', 'biweekly', 'monthly', 'annual']).optional(),
});
export type ConfirmBillBody = z.infer<typeof confirmBillSchema>;
