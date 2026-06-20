/**
 * Database row types — one interface per table in 0001_init.sql.
 *
 * These are hand-maintained to match the migration. When the schema is stable
 * we can switch to generated Supabase types, but keeping them explicit now makes
 * the data model legible alongside the engine.
 *
 * NOTE: `plaid_items.encrypted_access_token` holds ONLY ciphertext produced by
 * `lib/crypto/tokenCrypto`. The plaintext access token never lives in the DB,
 * never reaches the client, and is never logged.
 */
import type { BillStatus, PaydayFrequency, RiskLevel, WeekendRule } from '@/lib/domain/types';

export type PlaidItemStatus = 'active' | 'login_required' | 'error' | 'disconnected';
export type AccountType = 'depository' | 'credit' | 'loan' | 'investment' | 'other';
export type NudgeType = 'morning_runway' | 'bill_approach' | 'danger_state' | 'spending_spike';
export type FeedbackEventType =
  | 'bill_prediction'
  | 'nudge_helpful'
  | 'runway_confusing'
  | 'saved_fee'
  | 'other';

/** users / profiles — the core account profile (keyed to auth.users.id). */
export interface ProfileRow {
  id: string;
  email: string | null;
  timezone: string; // IANA tz, e.g. 'America/Los_Angeles'
  onboarding_completed: boolean;
  privacy_acknowledged_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PlaidItemRow {
  id: string;
  user_id: string;
  plaid_item_id: string;
  /** AES-256-GCM ciphertext (base64). Never plaintext. */
  encrypted_access_token: string;
  institution_name: string | null;
  sync_cursor: string | null;
  status: PlaidItemStatus;
  last_sync_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AccountRow {
  id: string;
  user_id: string;
  plaid_item_id: string;
  plaid_account_id: string;
  name: string | null;
  type: AccountType | null;
  subtype: string | null;
  mask: string | null;
  available_balance: number | null;
  current_balance: number | null;
  /** Whether this account's cash counts toward the runway. */
  included_in_runway: boolean;
  created_at: string;
  updated_at: string;
}

export interface TransactionRow {
  id: string;
  user_id: string;
  account_id: string;
  plaid_transaction_id: string;
  merchant_name: string | null;
  amount: number; // Plaid convention: positive = money out
  date: string; // 'YYYY-MM-DD'
  category: string | null;
  pending: boolean;
  /** User override of auto-classification: null = auto, true/false = forced. */
  is_spending: boolean | null;
  ignored: boolean;
  created_at: string;
  updated_at: string;
}

export interface PaycheckScheduleRow {
  id: string;
  user_id: string;
  frequency: PaydayFrequency;
  last_paycheck_date: string | null;
  next_paycheck_date: string | null;
  weekend_rule: WeekendRule;
  /** Free-form JSON: semimonthly anchors, custom notes, etc. */
  custom_rules: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface RecurringBillRow {
  id: string;
  user_id: string;
  merchant_name: string | null;
  /** Normalized merchant grouping key from detection (null for manual bills). */
  merchant_key: string | null;
  amount_estimate: number;
  cadence: string | null; // 'monthly' | 'weekly' | 'annual' | ...
  next_expected_date: string | null;
  confidence: number | null; // 0..1
  status: BillStatus;
  created_at: string;
  updated_at: string;
}

export interface RunwaySnapshotRow {
  id: string;
  user_id: string;
  available_cash: number | null;
  spent_today: number;
  bills_before_payday: number;
  safe_to_spend: number | null;
  daily_safe_spend: number | null;
  risk_level: RiskLevel | null;
  payday_date: string | null;
  generated_at: string;
}

export interface NudgeEventRow {
  id: string;
  user_id: string;
  type: NudgeType;
  copy_key: string | null;
  risk_level: RiskLevel | null;
  sent_at: string | null;
  opened_at: string | null;
  feedback: string | null;
  created_at: string;
}

export interface FeedbackEventRow {
  id: string;
  user_id: string;
  event_type: FeedbackEventType;
  /** ID of the referenced entity (bill, nudge, snapshot), if any. */
  event_id: string | null;
  rating: number | null;
  free_text: string | null;
  created_at: string;
}

/** Convenience map of table name -> row type for typed repositories. */
export interface Database {
  profiles: ProfileRow;
  plaid_items: PlaidItemRow;
  accounts: AccountRow;
  transactions: TransactionRow;
  paycheck_schedules: PaycheckScheduleRow;
  recurring_bills: RecurringBillRow;
  runway_snapshots: RunwaySnapshotRow;
  nudge_events: NudgeEventRow;
  feedback_events: FeedbackEventRow;
}
