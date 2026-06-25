/**
 * Push delivery — turns planned nudges into APNs alerts.
 *
 * Best-effort by contract: if APNs isn't configured (no key in the env) this is
 * a silent no-op, so the nudge engine still records its decisions in every
 * environment. Delivery failures never propagate to the caller — recording a
 * nudge must not depend on a push succeeding.
 *
 * When APNs reports a token is gone (Unregistered) or invalid (BadDeviceToken),
 * we disable that token so we stop pushing to dead devices.
 */
import type { PlannedNudge } from '@/lib/domain/nudges';
import { renderNudgeCopy } from '@/lib/domain/nudgeCopy';
import { deviceTokensRepo } from '@/lib/db/repositories';
import { getApnsConfig, sendApnsAlerts, type ApnsAlert } from '@/lib/apns/client';
import { reportError } from '@/lib/observability/report';

export interface DeliverResult {
  configured: boolean;
  delivered: number;
  failed: number;
}

/** APNs reasons that mean "this device token is dead — stop using it". */
const DEAD_TOKEN_REASONS = new Set(['Unregistered', 'BadDeviceToken', 'DeviceTokenNotForTopic']);

export async function deliverNudges(
  userId: string,
  planned: PlannedNudge[],
  nowMs: number = Date.now(),
): Promise<DeliverResult> {
  const none: DeliverResult = { configured: false, delivered: 0, failed: 0 };
  if (planned.length === 0) return none;

  const config = getApnsConfig();
  if (!config) return none; // push not configured → no-op

  try {
    const tokens = await deviceTokensRepo.listDeliverable(userId);
    if (tokens.length === 0) return { configured: true, delivered: 0, failed: 0 };

    // One alert per (device, nudge). Track which row each raw token came from
    // so a dead-token reason can disable the right row.
    const idByToken = new Map(tokens.map((t) => [t.rawToken, t.id]));
    const alerts: ApnsAlert[] = [];
    for (const t of tokens) {
      for (const nudge of planned) {
        const copy = renderNudgeCopy(nudge.copyKey);
        alerts.push({ deviceToken: t.rawToken, title: copy.title, body: copy.body });
      }
    }

    const results = await sendApnsAlerts(config, alerts, nowMs);

    let delivered = 0;
    let failed = 0;
    const toDisable = new Set<string>();
    for (const r of results) {
      if (r.status === 200) {
        delivered += 1;
      } else {
        failed += 1;
        if (r.reason && DEAD_TOKEN_REASONS.has(r.reason)) {
          const id = idByToken.get(r.deviceToken);
          if (id) toDisable.add(id);
        }
      }
    }

    for (const id of toDisable) {
      await deviceTokensRepo.disableById(id);
    }

    return { configured: true, delivered, failed };
  } catch (err) {
    // Never let delivery break the recording path.
    reportError(err, { scope: 'push.deliverNudges', userId });
    return { configured: true, delivered: 0, failed: 0 };
  }
}
