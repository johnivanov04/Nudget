# Nudget

> Paycheck runway widget. One question: **"Am I safe to spend before payday?"**

Nudget is an iOS-first paycheck runway tool. It is **not** a full budgeting app, not a
Mint replacement, and it does **not** promise real-time purchase alerts. It answers a
single, glanceable question using three numbers:

- **Spent today**
- **Bills before payday**
- **Safe to spend until payday**

This repository is the **backend** (Phases 1–5 complete: foundation · auth/persistence ·
Plaid sync · bill detection + runway persistence · nudge engine + analytics). The actual
APNs push delivery, the iOS app (SwiftUI), and the WidgetKit widget come in later phases.

---

## Current phase status

**Phases 1–5 (backend) complete:** foundation · auth + persistence · Plaid sync · bill detection + runway persistence · nudge engine + analytics.

| Area                                                                   | Status                            |
| ---------------------------------------------------------------------- | --------------------------------- |
| Next.js + TypeScript project                                           | ✅                                |
| Lint / format / typecheck / test tooling                               | ✅                                |
| Env validation (zod)                                                   | ✅                                |
| Postgres migrations + RLS (9 core tables)                              | ✅                                |
| Server-side types + per-table repositories                             | ✅                                |
| Plaid access-token encryption (AES-256-GCM)                            | ✅                                |
| Pure runway engine (payday, daily spend, classification, runway, risk) | ✅ unit-tested                    |
| Supabase Auth JWT verification + per-user scoping                      | ✅ (Phase 2)                      |
| Account deletion + Plaid-item disconnect endpoints                     | ✅ (Phase 2)                      |
| Integration tests (repos + RLS isolation + token safety)               | ✅ written, run vs local Supabase |
| Plaid client + link-token / public-token exchange                      | ✅ (Phase 3)                      |
| Cursor-based transaction sync (`/transactions/sync`)                   | ✅ (Phase 3)                      |
| Signature-verified Plaid webhook (ES256, Node crypto)                  | ✅ (Phase 3)                      |
| Recurring-bill detection (normalize → cadence → confidence)            | ✅ (Phase 4) unit-tested          |
| DB-backed runway recompute + persisted `runway_snapshots`              | ✅ (Phase 4)                      |
| `/runway/current` + `/widget/snapshot` read cached snapshot            | ✅ (Phase 4)                      |
| **Nudge engine (eligibility, throttle, non-shaming copy keys)**        | ✅ (Phase 5) unit-tested          |
| **Device-token registration + notification preferences**               | ✅ (Phase 5)                      |
| **Privacy-safe analytics event builders + admin metrics endpoint**     | ✅ (Phase 5)                      |
| API route structure (25 endpoints)                                     | ✅ (21 live, 4 documented stubs)  |

The actual APNs push delivery, the iOS app (SwiftUI), and WidgetKit are **not**
built yet — see [`NEXT_STEPS.md`](./NEXT_STEPS.md).

### Data flow

```
Plaid → /api/plaid/sync → transactions → bill detection → runway recompute → runway_snapshots
                                                  │                ↑
                                                  └→ nudge engine ─┘ (event nudges; throttled)
        confirm bill / ignore transaction ───────────────────────┘  (recompute on change)
        /api/runway/current + /api/widget/snapshot read the cached snapshot
```

### Auth

Protected endpoints expect `Authorization: Bearer <supabase-jwt>`. The server
verifies the token via Supabase (`auth.getUser`) in `src/lib/api/auth.ts` and
scopes every data access to the returned user id; RLS is the backstop. Authed
endpoints: `GET /api/me`, `POST /api/onboarding/paycheck`, `POST /api/feedback`,
`DELETE /api/account`, `DELETE /api/plaid/item/:id`, `POST /api/plaid/link-token`,
`POST /api/plaid/exchange-public-token`, `POST /api/plaid/sync`,
`GET /api/transactions`, `POST /api/transactions/:id/ignore`,
`GET /api/bills/detected`, `POST /api/bills/:id/confirm`,
`POST /api/runway/recalculate`, `GET /api/runway/current`, `GET /api/widget/snapshot`,
`POST /api/device/register`, `GET|POST /api/nudges/preferences`, `POST /api/nudges/test`.

`POST /api/plaid/webhook` is **not** user-authed — it is authenticated by Plaid's
signed `Plaid-Verification` JWT, which the server verifies (signature + body hash +
freshness) before trusting the payload. `GET /api/admin/metrics` is auth-gated **and**
admin-gated (caller's id must be in `ADMIN_USER_IDS`); it returns aggregate counts only.

---

## Architecture

```
Plaid ──► backend sync ──► runway snapshot ──► iOS app cache ──► WidgetKit
            (Next.js)        (pure engine)        (later)          (later)
                │
          Supabase Postgres
```

- **Backend/web/admin:** Next.js (App Router) + TypeScript
- **Database:** Supabase Postgres (Row Level Security on every table)
- **Auth:** Supabase Auth (JWT) — _integration is Phase 2_
- **Bank data:** Plaid (Sandbox first) — _integration is Phase 3_
- **Tests:** Vitest (unit tests for all core business logic, required from day one)

### The runway engine (pure, no I/O)

All financial math lives in `src/lib/domain/` as pure, deterministic functions that take
a caller-supplied "today" (no system clock) so they are trivially testable:

```
safe_to_spend  = available_cash
               − confirmed_bills_before_payday
               − predicted_bills_before_payday
               − safety_buffer

daily_safe_spend = max(safe_to_spend, 0) / max(days_until_payday, 1)
```

| Module              | Responsibility                                                     |
| ------------------- | ------------------------------------------------------------------ |
| `dateUtils.ts`      | Calendar-date math (UTC-anchored, DST-safe)                        |
| `payday.ts`         | Next payday, next 3 paydays, days-until-payday, weekend rules      |
| `classification.ts` | Spending vs income / transfer / card-payment / ignored / override  |
| `dailySpend.ts`     | "Spent today" + pending flag                                       |
| `runway.ts`         | Safe-to-spend + daily-safe-spend                                   |
| `risk.ts`           | `safe` / `caution` / `danger` + non-shaming reason key             |
| `freshness.ts`      | Stale / missing-data detection (every number carries last-updated) |
| `snapshot.ts`       | Composes all of the above into one runway snapshot                 |
| `widget.ts`         | Minimal, privacy-mode-aware projection for the widget              |

---

## Getting started

### Prerequisites

- Node.js ≥ 20 (developed on v24)
- A Supabase project (for the DB-backed phases) and Plaid Sandbox credentials
  (for Phase 3). **Neither is required** to run the tests or the runway demo.

### Install

```bash
npm install
```

### Environment variables

Copy the example file and fill it in:

```bash
cp .env.example .env.local
```

| Variable                        | Scope           | Purpose                                         |
| ------------------------------- | --------------- | ----------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | public          | Supabase project URL                            |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | public          | Supabase anon key (RLS-scoped)                  |
| `SUPABASE_SERVICE_ROLE_KEY`     | **server only** | Service-role key for server jobs                |
| `PLAID_CLIENT_ID`               | **server only** | Plaid client id                                 |
| `PLAID_SECRET`                  | **server only** | Plaid secret (never sent to client)             |
| `PLAID_ENV`                     | server          | `sandbox` \| `development` \| `production`      |
| `TOKEN_ENCRYPTION_KEY`          | **server only** | 32-byte key (64 hex chars) for token encryption |

Generate an encryption key:

```bash
openssl rand -hex 32
```

Env is validated by `src/lib/env.ts` (zod). The server fails fast with a readable
error if anything is missing or malformed. The build does **not** require env vars —
Supabase clients are initialized lazily.

### Run the runway demo (no Plaid, no DB)

```bash
npm run demo:runway
```

This computes a full runway snapshot from the seed scenario in
`src/lib/mock/seedData.ts` and prints spent-today, bills, safe-to-spend, risk level,
and the privacy-mode lock-screen view.

### Run the dev server

```bash
npm run dev
# then:
curl 'http://localhost:3000/api/health'
curl 'http://localhost:3000/api/widget/snapshot?demo=1'
curl 'http://localhost:3000/api/widget/snapshot?demo=1&privacy=1'
curl -X POST 'http://localhost:3000/api/runway/recalculate?demo=1'
```

---

## Database migrations

The schema lives in `supabase/migrations/0001_init.sql` (9 core tables, Postgres enums,
indexes, `updated_at` triggers, **RLS enabled with user-scoped policies**, and a trigger
that auto-creates a `profiles` row for each new auth user).

Apply it with the Supabase CLI against a local stack:

```bash
supabase start          # local Postgres + Auth
supabase db reset       # applies migrations/0001_init.sql + seeds supabase/seed.sql
```

Or run the SQL against your project's database directly. `supabase/seed.sql` populates a
fictional demo user/account/bills for local development (it is **not** used by the engine
tests, which use the in-code seed).

> **Security:** `plaid_items.encrypted_access_token` stores **ciphertext only**. The
> plaintext Plaid access token is never stored, never returned to the client, and never
> logged. Analytics never receive raw merchant names, account masks, exact balances,
> transaction IDs, or exact amounts (enforced by `src/lib/analytics/sanitize.ts`).

---

## Testing

```bash
npm test            # unit suite (no DB required) — runs everywhere
npm run test:watch  # watch mode
npm run test:coverage
```

Unit tests are **mandatory** and cover normal, edge, and failure cases. Tested
business-logic modules:

- Payday date calculation & days-until-payday (weekly/biweekly/semimonthly/monthly/custom, weekend rules, overrides)
- Daily spend calculation
- Transaction classification / exclusion (income, transfer, card payment, ignored, user override)
- Safe-to-spend runway formula (incl. **negative runway** + divide-by-zero edges)
- Risk-level assignment
- Data freshness (**stale / missing data** edges)
- Snapshot composition (full pipeline over seed data)
- Widget projection (privacy mode)
- Token encryption (round-trip, tamper detection, wrong key)
- Env validation (missing / malformed vars)
- Analytics sanitization (forbidden keys dropped, amounts bucketed)
- DB → engine mappers
- API request schemas + runway service
- Auth: bearer extraction + JWT verification (valid / invalid / error / throw)
- API route handlers: `/me`, onboarding, feedback, account delete, Plaid disconnect (401 / 400 / 404 / success, mocked auth + repos), plus the public demo routes
- Plaid mappers (account/transaction → DB rows, account fallback, unknown-account skip)
- Transaction sync: cursor pagination + "advance cursor only on success" (mocked Plaid client)
- Plaid webhook ES256 verification (valid / tampered body / wrong key / replay / bad alg / key-fetch failure)
- Plaid route handlers: link-token, exchange (token never returned), sync, webhook (401 on bad signature), transactions list + ignore
- **Recurring-bill detection (merchant normalization, cadence, confidence, irregular-series rejection, inflow exclusion)**
- **`todayInTimeZone` (per-user local date)**
- **Snapshot-row views (dashboard + privacy-mode widget projections)**
- Bill-detection service (persists candidates, skips user-confirmed/rejected keys)
- Runway recompute service (DB → engine → persisted snapshot; needs_schedule / needs_data)
- Bills + runway route handlers: detected, confirm (recomputes), recalculate, current, widget
- **Nudge engine (eligibility, per-channel toggles, danger-over-bill priority, daily throttle, stale/no-data handling, tone in copy key)**
- **Analytics event builders (bucketing + forbidden-key stripping) and the admin allowlist gate**
- **Nudge service (plan + record + throttle; preview without recording)**
- **Notification + admin route handlers: device register (token never echoed), preferences GET/POST, test preview, admin metrics (401/403/200)**

### Integration tests + end-to-end verification

> **See [`VERIFY.md`](./VERIFY.md)** for the full runbook: Stage 1 (DB + RLS +
> token safety against a real Supabase — hosted or local Docker) and Stage 2 (the
> live Plaid Sandbox pipeline via `npm run verify:live`).

`tests/integration/*.itest.ts` exercise the **real repositories, RLS isolation,
and token safety** against a real Supabase Postgres. They self-skip unless the
DB env is provided, so they never block `npm test`.

```bash
supabase start    # prints API URL + anon/service-role keys
NUDGET_DB_TEST=1 \
  SUPABASE_TEST_URL=http://127.0.0.1:54321 \
  SUPABASE_TEST_ANON_KEY=<local-anon-key> \
  SUPABASE_TEST_SERVICE_ROLE_KEY=<local-service-role-key> \
  npm run test:integration
```

(See `.env.test.example`.) Coverage:

- **Every repository** — CRUD round-trips through the service-role path.
- **RLS isolation** — user A cannot read or write user B's rows in any
  user-scoped table; an unauthenticated client sees nothing.
- **Token safety** — stored Plaid tokens are ciphertext (never plaintext), no
  column leaks the plaintext, another user can't read the item, and only the
  server-side helper can decrypt.

---

## Scripts

| Script                | Description                            |
| --------------------- | -------------------------------------- |
| `npm run dev`         | Start the Next.js dev server           |
| `npm run build`       | Production build                       |
| `npm test`            | Run the Vitest suite                   |
| `npm run typecheck`   | `tsc --noEmit`                         |
| `npm run lint`        | `next lint`                            |
| `npm run format`      | Prettier write                         |
| `npm run demo:runway` | Print a runway snapshot from seed data |

---

## Project layout

```
src/
  app/
    api/                  # 14 route handlers (3 live, 11 documented 501 stubs) + /health
    page.tsx, layout.tsx  # minimal status page (backend is API-first)
  lib/
    domain/               # PURE runway engine (no I/O) + tests
    crypto/               # AES-256-GCM Plaid token encryption + tests
    db/
      types.ts            # one row type per table
      mappers.ts          # pure DB-row -> engine mappers + tests
      repositories/       # per-table typed Supabase data access
    api/                  # request schemas, responses, auth stub, runway service
    analytics/            # privacy-safe analytics sanitizer
    mock/                 # in-code seed scenario
  scripts/                # runnable runway demo
supabase/
  migrations/0001_init.sql
  seed.sql
```
