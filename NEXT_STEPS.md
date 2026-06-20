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

## Phase 3 — Plaid + transaction sync (Roadmap Weeks 3, build order 3–4)

**Goal:** Sandbox end-to-end; transactions importing.

- [ ] Add the `plaid` SDK; build a server-only Plaid client from validated env.
- [ ] **`POST /api/plaid/link-token`** → `/link/token/create` (return only `link_token`).
- [ ] **`POST /api/plaid/exchange-public-token`** → `/item/public_token/exchange`,
      **encrypt** the access token (`tokenCrypto`), store via `plaidItemsRepo.create`,
      fetch accounts.
- [ ] **`POST /api/plaid/sync`** → cursor-based `/transactions/sync`: upsert
      added/modified, delete removed, advance cursor **only on success**, update
      `last_sync_at`. Retryable; queueable.
- [ ] **`POST /api/plaid/webhook`** → **verify signature** before trusting payload,
      then enqueue a sync on `SYNC_UPDATES_AVAILABLE`.
- [ ] **`GET /api/transactions`** + **`POST /api/transactions/:id/ignore`** → `transactionsRepo`.
- [ ] Integration tests: token exchange (mocked), cursor behavior, upsert/delete,
      ownership checks, "tokens never returned to client / never logged".

## Phase 4 — Bill detection + runway persistence (Roadmap Weeks 6–7, build order 6–7)

**Goal:** the dashboard answers the question for real data.

- [ ] Recurring-bill **detection job**: merchant normalization, cadence/amount/date
      scoring, confidence → `recurringBillsRepo`. (The engine already consumes bills.)
- [ ] **`GET /api/bills/detected`** + **`POST /api/bills/:id/confirm`** (confirmed
      data overrides guesses; low-confidence shown as "likely").
- [ ] **`GET /api/runway/current`** → `runwaySnapshotsRepo.getLatest`.
- [ ] Switch **`POST /api/runway/recalculate`** from posted-scenario to
      "load this user's accounts/transactions/bills/schedule via the DB→engine
      mappers, recompute with `buildRunwaySnapshot`, persist a `runway_snapshots` row".
- [ ] **`GET /api/widget/snapshot`** → return the latest persisted snapshot
      (privacy-mode aware). The demo path stays for development.
- [ ] Tests for the detection algorithm + DB-backed recompute.

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

## Phase 7 — Push nudges via APNs (Roadmap Week 9, build order 10)

- [ ] `device_tokens` table + `POST /api/device/register`; nudge preferences.
- [ ] Morning runway nudge, bill-approach nudge, danger-state nudge.
- [ ] Throttle: ≤ 1 morning + 1 bill/risk nudge per day unless opted in.
- [ ] Non-shaming copy (templates keyed by `copy_key`); enable/disable; tone options.
- [ ] `nudgeEventsRepo` for delivery + helpful/not-helpful feedback.

## Phase 8 — Beta analytics + admin (Roadmap Week 10, build order 11–13)

- [ ] Privacy-safe funnel analytics using `buildAnalyticsEvent` (already enforces
      forbidden keys + bucketing).
- [ ] Admin/debug dashboard: linking, widget adds, nudge events, bill errors,
      sync health (no raw financial data).
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

> Implement **Phase 3 (Plaid Sandbox + transaction sync)** for Nudget at `~/nudget`.
> Add the `plaid` SDK and a server-only Plaid client built from validated env. Wire
> `POST /api/plaid/link-token` (return only the link_token), `POST /api/plaid/exchange-public-token`
> (exchange, **encrypt** the access token via `lib/crypto/tokenCrypto`, store via
> `plaidItemsRepo.create`, fetch accounts), `POST /api/plaid/sync` (cursor-based
> `/transactions/sync`: upsert added/modified, delete removed, advance cursor only on
> success), and `POST /api/plaid/webhook` (verify signature, enqueue sync). Wire
> `GET /api/transactions` and `POST /api/transactions/:id/ignore`. All endpoints
> auth-gated and user-scoped. Add tests: unit tests for sync cursor/upsert/delete logic
> with a mocked Plaid client, and integration tests for the new repositories paths.
> Keep tokens server-side only and never logged; tests mandatory; do not build
> iOS/WidgetKit/APNs yet.
