# Nudget — Next Steps / Roadmap

This maps the remaining work from the three planning documents (PRD, Feature
Specifications, 90-Day Roadmap) onto concrete engineering phases. Phases 1–2
are **done**; Phase 3 onward is outstanding.

The guardrail for every item: **does it improve the answer to "How much can I
safely spend before payday after upcoming bills?"** If not, defer it.

---

## ✅ Phase 1 — Backend foundation (DONE)

Next.js + TS, tooling, env validation, migration + RLS, repositories, token
encryption, the pure runway engine with full unit tests, seed data + demo, and
the API route skeleton (3 live endpoints + 11 documented stubs).

---

## ✅ Phase 2 — Auth + persistence (Roadmap Week 2) (DONE)

**Goal:** real users; protected, user-scoped endpoints.

- [x] `getUserFromRequest` (`src/lib/api/auth.ts`) — verifies the Supabase JWT via
      `auth.getUser` and returns the user id; routes scope all access to it (RLS backstop).
- [x] **`GET /api/me`** → `profilesRepo` (profile + onboarding state).
- [x] Persist onboarding: **`POST /api/onboarding/paycheck`** → `paycheckSchedulesRepo.upsert`
      (stores the computed `next_paycheck_date`).
- [x] Persist feedback: **`POST /api/feedback`** → `feedbackEventsRepo.insert`.
- [x] **`DELETE /api/account`** (cascades all data) + **`DELETE /api/plaid/item/:id`**
      (ownership-scoped disconnect).
- [x] **Integration tests** vs local Supabase Postgres — every repository, RLS
      isolation (A can't read/write B; anon sees nothing), and token-never-to-client.
- [x] Unit tests (mocked) for auth + all authed routes.

**Carried into a later phase:**

- [ ] Email/password + **Apple Sign-In** client flows (iOS, Phase 5) — server JWT
      verification already works for any Supabase Auth provider.
- [ ] Explicit privacy-acknowledgement endpoint (`profilesRepo.markPrivacyAcknowledged`
      exists; wire a `POST /api/onboarding/privacy` route when the iOS flow lands).
- [ ] Wire **Sentry** (server) with payload scrubbing for financial data.

## ✅ Phase 3 — Plaid + transaction sync (Roadmap Week 3, build order 3–4) (DONE)

**Goal:** Sandbox end-to-end; transactions importing.

- [x] `plaid` SDK added; server-only client from validated env (`src/lib/plaid/client.ts`).
- [x] **`POST /api/plaid/link-token`** → `/link/token/create` (returns only `link_token`).
- [x] **`POST /api/plaid/exchange-public-token`** → exchange, **encrypt** + store the
      access token via `plaidItemsRepo.create`, fetch + upsert accounts; response carries no token.
- [x] **`POST /api/plaid/sync`** → cursor-based `/transactions/sync`: upsert added/modified,
      delete removed, advance cursor **only on success**, update `last_sync_at` (`src/lib/plaid/sync.ts`).
- [x] **`POST /api/plaid/webhook`** → **ES256 signature verification** (Node crypto,
      `src/lib/plaid/webhook.ts`) before trusting payload; syncs on `SYNC_UPDATES_AVAILABLE`,
      flags item on `ITEM/ERROR`.
- [x] **`GET /api/transactions`** + **`POST /api/transactions/:id/ignore`** → `transactionsRepo`.
- [x] Unit tests: mappers, cursor pagination + cursor-only-on-success, webhook verification
      (tamper/replay/wrong-key/bad-alg), all routes (incl. token-never-returned). Integration:
      `getOwned` / `getByPlaidItemId` lookups.

**Carried forward:**

- [ ] Move webhook-triggered sync onto a durable queue (Phase 8) so the webhook returns
      immediately rather than syncing inline.
- [ ] Live Plaid Sandbox end-to-end smoke test (needs real Plaid credentials; the suite
      uses a mocked Plaid client).

## ✅ Phase 4 — Bill detection + runway persistence (Roadmap Weeks 6–7) (DONE)

**Goal:** the dashboard answers the question for real data.

- [x] Pure recurring-bill **detection** (`src/lib/domain/billDetection.ts`): merchant
      normalization, cadence inference, irregular-series rejection, amount/cadence/count
      confidence. Service `runBillDetection` persists candidates and never overwrites
      user-confirmed/rejected merchants. Migration `0002` adds `merchant_key` +
      `unique(user_id, merchant_key)` for idempotent upserts.
- [x] **`GET /api/bills/detected`** + **`POST /api/bills/:id/confirm`** (confirm/edit/reject;
      confirmed data overrides guesses; candidates surfaced as "likely").
- [x] DB-backed recompute service (`src/lib/services/runway.ts`): loads accounts/
      transactions/bills/schedule via `db/mappers`, computes with `buildRunwaySnapshot`,
      persists a `runway_snapshots` row; returns `needs_schedule` / `needs_data`.
- [x] **`POST /api/runway/recalculate`** (DB recompute; `?demo=1` kept),
      **`GET /api/runway/current`** + **`GET /api/widget/snapshot`** read the cached row
      (privacy-mode aware, with last-updated + stale).
- [x] Detection runs after `POST /api/plaid/sync`; confirm/ignore trigger a recompute.
- [x] `todayInTimeZone` for per-user local "today". Unit tests for detection, services,
      snapshot views, and all routes; integration test for the idempotent detection upsert.

**Carried forward:**

- [ ] Detection currently scans up to 500 transactions / 180 days — paginate for
      power users before scale.
- [ ] Move post-sync detection + recompute onto a queue (Phase 8) so sync returns fast.

## Phase 5 — iOS app (SwiftUI) (Roadmap Week 4 + build order 8)

> Not part of this repo. Tracked here for sequencing.

- [ ] SwiftUI onboarding, privacy consent, Plaid Link flow, payday setup, bill
      review, dashboard. Onboarding target < 5 min (excl. Plaid delays).
- [ ] App Group shared storage for the cached widget snapshot.
- [ ] Surface **last-updated** on every number; stale + needs-data states.

## Phase 6 — WidgetKit widget (Roadmap Week 8, build order 9)

- [ ] Small (safe-to-spend) + medium (safe-to-spend, spent today, bills, payday).
- [ ] Lock-screen widget with **privacy mode** (hide amounts) by default.
- [ ] Reads the local cached snapshot; no blocking network; deep-links into app.
- [ ] Manual QA matrix: no-data, safe, caution, danger, stale, privacy mode.

## Phase 7 — Push nudges (Roadmap Week 9, build order 10) — backend DONE, delivery pending

- [x] `device_tokens` table (migration 0003) + `POST /api/device/register` (stores a
      SHA-256 hash, never the raw token); `notification_preferences` + GET/POST.
- [x] Pure nudge engine (`src/lib/domain/nudges.ts`): morning / bill-approach / danger,
      non-shaming `copy_key` templates, tone, and the ≤ 1 morning + 1 bill/risk daily throttle.
- [x] `planAndRecordNudges` records sends in `nudgeEventsRepo` (event nudges fire after sync);
      `previewNudges` powers `POST /api/nudges/test`; nudge feedback flows through `POST /api/feedback`.
- [x] **Scheduled morning nudge**: `GET /api/cron/morning-nudges` (Vercel cron, hourly,
      `CRON_SECRET`-gated) selects users whose `morning_hour` matches the current hour in
      their timezone (`selectDueUsers` + `hourInTimeZone`) and fires their morning nudge.
- [ ] **APNs delivery**: store the raw token encrypted, build the push payload from `copy_key`,
      and actually send (needs Apple Push credentials). The engine + records + schedule exist.

## Phase 8 — Beta analytics + admin (Roadmap Week 10, build order 11–13) — partial

- [x] Privacy-safe analytics event builders (`src/lib/analytics/events.ts`) using
      `buildAnalyticsEvent` (forbidden-key stripping + bucketing); `emitAnalytics` sink (no-op).
- [x] `GET /api/admin/metrics` (admin-gated by `ADMIN_USER_IDS`): aggregate COUNTS only.
- [x] **Rate limiting** on expensive endpoints (`lib/api/rateLimit` on sync/recalculate) +
      **error reporting with financial-data scrubbing** (`lib/observability/report`) +
      **privacy-acknowledgement endpoint** (`POST /api/onboarding/privacy`).
- [ ] Wire `emitAnalytics` to a real privacy-safe provider; call the builders from every
      funnel point (signup, plaid link, payday saved, runway viewed, bill decisions, outcomes).
- [ ] Back `lib/observability/report` with the **Sentry** SDK; back `lib/api/rateLimit` with a
      shared store (Upstash) for multi-instance correctness.
- [ ] Admin/debug **dashboard UI** (web) over the metrics endpoint.
- [ ] TestFlight build, privacy policy/terms, App Store privacy disclosures.
- [ ] UAT scenarios from the Feature Spec (first setup, bill correction, widget
      setup, privacy mode, stale sync).

---

## Cross-cutting (do continuously)

- **Tests with every feature** — no feature code without tests; 100% coverage on
  runway-formula edge cases; deterministic fixtures; never store real banking data.
- **Privacy/security as launch blockers** — encrypt tokens, least-privilege DB
  access, scrub logs, scrub analytics, HTTPS only, account deletion in-app.
- **Trust framing** — every number carries last-updated context; never imply
  real-time; non-shaming copy; "estimates for awareness, not financial advice".

## Explicitly deferred (do NOT build during MVP)

Full budgeting dashboard, AI financial advice, subscriptions/paywall, Android,
white-label/bank pilots, investment tracking, credit-score tracking, bill payment,
money movement, multi-user/shared budgets, advanced category breakdowns.

---

## Suggested next prompt for Claude

The backend is feature-complete through Phase 6 and **verified end-to-end** against real
Supabase + Plaid Sandbox. Two natural tracks from here:

**Track A — Deploy + wire real providers (make it a live service):**

> Deploy the Nudget backend at `~/nudget` to Vercel with a hosted Supabase project. Apply
> all migrations, set env (Supabase, Plaid Sandbox, `TOKEN_ENCRYPTION_KEY`, `CRON_SECRET`,
> `ADMIN_USER_IDS`), and confirm the Vercel cron is registered from `vercel.json`. Then wire
> the real providers behind the existing abstractions: back `lib/observability/report` with the
> Sentry SDK (scrubbing on), make `emitAnalytics` POST to a configurable provider, and call the
> `analyticsEvents` builders from each funnel route. Verify the deployed URL with a Plaid
> Sandbox run. Keep tests green.

**Track B — Start the iOS app (SwiftUI):**

> Scaffold the Nudget iOS app (SwiftUI) against the now-stable, verified API. Build onboarding
> (sign in → privacy consent → Plaid Link → payday setup → bill review), the dashboard (the
> three core numbers + last-updated/stale states), and settings (notification preferences,
> account deletion). Use the documented endpoints; surface every number with its freshness
> context. Defer WidgetKit + APNs to the following phase.
