/**
 * Runway recompute service: loads a user's accounts, transactions, bills, and
 * paycheck schedule from the database, runs the pure engine, and persists a
 * `runway_snapshots` row. This is the bridge between stored data and the
 * deterministic `buildRunwaySnapshot` engine.
 */
import { buildRunwaySnapshot, type RunwaySnapshot } from '@/lib/domain/snapshot';
import { addDays, todayInTimeZone, type IsoDate } from '@/lib/domain/dateUtils';
import type { EngineBill } from '@/lib/domain/types';
import {
  accountsRepo,
  transactionsRepo,
  recurringBillsRepo,
  paycheckSchedulesRepo,
  profilesRepo,
  plaidItemsRepo,
  runwaySnapshotsRepo,
} from '@/lib/db/repositories';
import {
  sumAvailableCash,
  transactionRowToEngine,
  billRowToEngine,
  scheduleRowToEngine,
} from '@/lib/db/mappers';
import type { PlaidItemRow, RunwaySnapshotRow } from '@/lib/db/types';

export interface RecomputeResult {
  status: 'ok' | 'needs_data' | 'needs_schedule';
  snapshot?: RunwaySnapshot;
  persisted?: RunwaySnapshotRow;
}

function latestSyncAt(items: PlaidItemRow[]): string | null {
  const times = items
    .map((i) => i.last_sync_at)
    .filter((t): t is string => Boolean(t))
    .sort();
  return times.length ? times[times.length - 1]! : null;
}

export interface ComputeResult {
  status: 'ok' | 'needs_data' | 'needs_schedule';
  today: IsoDate;
  snapshot: RunwaySnapshot | null;
  /** Bills loaded for the snapshot (also fed to the nudge engine). */
  bills: EngineBill[];
}

/**
 * Compute (but do NOT persist) the runway snapshot from DB data. Shared by the
 * recompute endpoint and the nudge engine so both see identical inputs.
 */
export async function computeRunwayForUser(
  userId: string,
  now: Date = new Date(),
): Promise<ComputeResult> {
  const profile = await profilesRepo.getById(userId);
  const timezone = profile?.timezone ?? 'America/Los_Angeles';
  const today = todayInTimeZone(timezone, now);

  const schedule = await paycheckSchedulesRepo.getByUser(userId);
  if (!schedule) return { status: 'needs_schedule', today, snapshot: null, bills: [] };

  const [accounts, txnRows, billRows, items] = await Promise.all([
    accountsRepo.listByUser(userId),
    // Daily spend only needs today's activity; a 1-day pad covers timezone edges.
    transactionsRepo.listByUser(userId, { from: addDays(today, -1), to: today, limit: 500 }),
    recurringBillsRepo.listByUser(userId, ['candidate', 'confirmed']),
    plaidItemsRepo.listByUser(userId),
  ]);

  const bills = billRows.map(billRowToEngine).filter((b): b is EngineBill => b !== null);

  const snapshot = buildRunwaySnapshot({
    today,
    availableCash: sumAvailableCash(accounts),
    transactions: txnRows.map(transactionRowToEngine),
    bills,
    schedule: scheduleRowToEngine(schedule),
    lastUpdatedAt: latestSyncAt(items),
    now: now.toISOString(),
  });

  return { status: snapshot.status, today, snapshot, bills };
}

export async function recomputeRunwayForUser(
  userId: string,
  now: Date = new Date(),
): Promise<RecomputeResult> {
  const computed = await computeRunwayForUser(userId, now);
  if (!computed.snapshot) return { status: computed.status };
  const snapshot = computed.snapshot;

  const persisted = await runwaySnapshotsRepo.insert({
    user_id: userId,
    available_cash: snapshot.availableCash,
    spent_today: snapshot.spentToday,
    bills_before_payday: snapshot.billsBeforePayday,
    safe_to_spend: snapshot.safeToSpend,
    daily_safe_spend: snapshot.dailySafeSpend,
    risk_level: snapshot.riskLevel,
    payday_date: snapshot.paydayDate,
  });

  return { status: snapshot.status, snapshot, persisted };
}
