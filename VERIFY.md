# Verifying Nudget end-to-end

Everything in this repo is unit-tested, but the unit tests mock the database and
Plaid. This runbook proves the backend works against **real services**. There are
two stages — do Stage 1 first.

| Stage                       | Proves                                                                                                           | Needs                                 |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| **1 — Database + RLS**      | Migrations apply on real Postgres; RLS isolates users; Plaid tokens are stored encrypted; every repository works | A Supabase project                    |
| **2 — Live Plaid pipeline** | The real flow: link → sync → detect bills → compute runway → read it back                                        | The running app + Plaid Sandbox creds |

> My dev sandbox has no Docker, so the **hosted Supabase** path below is the
> easiest (no Docker required). A local Docker option is included too.

---

## Stage 1 — Database, RLS, and token safety

Runs the gated integration suite (`tests/integration/*.itest.ts`) against a real
Supabase. It creates/deletes its own throwaway users via the Auth admin API.

### Option A — Hosted Supabase project (no Docker) ← recommended

1. Create a free project at <https://supabase.com> (use a throwaway/dedicated one —
   it only ever holds test data).
2. **Apply the schema.** Copy all three migrations into the project's **SQL Editor**
   and run them, in order:
   ```bash
   npm run db:schema | pbcopy     # copies 0001 + 0002 + 0003, in order
   ```
   Paste into the SQL Editor → **Run**. (Or open the three files in
   `supabase/migrations/` and run them top to bottom.)
3. **Grab credentials** from Project Settings → **API**: the Project URL, the
   `anon` public key, and the `service_role` key.
4. **Configure the test env:**
   ```bash
   cp .env.test.example .env.test.local
   # edit .env.test.local:
   #   NUDGET_DB_TEST=1
   #   SUPABASE_TEST_URL=https://<your-project>.supabase.co
   #   SUPABASE_TEST_ANON_KEY=<anon key>
   #   SUPABASE_TEST_SERVICE_ROLE_KEY=<service_role key>
   ```
5. **Run the suite:**
   ```bash
   set -a; source .env.test.local; set +a
   npm run test:integration
   ```

**Expected:** ~20 tests pass, including:

- `repositories (integration)` — every repo round-trips.
- `RLS isolation` — user A cannot read or write user B's rows in any table; an
  unauthenticated client sees nothing.
- `Plaid token safety` — the stored token is ciphertext, no column leaks the
  plaintext, another user can't read the item, and only the server can decrypt.

### Option B — Local Supabase (Docker)

```bash
brew install supabase/tap/supabase     # if not installed
supabase init                          # creates supabase/config.toml
supabase start                         # boots local stack; prints URL + keys
supabase db reset                      # applies migrations/ + seed.sql
```

Put the **printed** local API URL + anon + service_role keys into
`.env.test.local` (as in Option A), then `npm run test:integration`.

---

## Stage 2 — Live Plaid Sandbox pipeline

This drives the real product flow against the running app using a Plaid **Sandbox**
item (no Plaid Link UI needed). See `scripts/verify-live.sh`.

1. **Get Plaid Sandbox keys** from <https://dashboard.plaid.com> → Team Settings →
   Keys (`client_id` + the **Sandbox** secret).
2. **Fill `.env.local`** (the app's runtime env) using the same Supabase project
   from Stage 1, plus Plaid:
   ```bash
   cp .env.example .env.local
   # NEXT_PUBLIC_SUPABASE_URL / ANON / SUPABASE_SERVICE_ROLE_KEY  → same project as Stage 1
   # PLAID_CLIENT_ID / PLAID_SECRET → Sandbox keys
   # PLAID_ENV=sandbox
   # TOKEN_ENCRYPTION_KEY=$(openssl rand -hex 32)
   ```
3. **Run the app** in one terminal:
   ```bash
   npm run dev
   ```
4. **Run the live verification** in another terminal:
   ```bash
   set -a; source .env.local; set +a
   npm run verify:live          # add VERIFY_CLEANUP=1 to delete the test user after
   ```

The script walks 8 steps: create user → JWT → set payday → Plaid Sandbox token →
exchange (asserts the response carries **no** token) → sync → read runway +
detected bills → privacy-mode widget snapshot. Success prints a real
`runway/current` snapshot and a detected-bills count.

> Plaid Sandbox sometimes needs a few seconds to generate transactions; the script
> retries the sync up to 3 times.

---

## Troubleshooting

- **`Missing env var …`** — you didn't `source` the env file into the current
  shell. Re-run the `set -a; source …; set +a` line.
- **Schema error on `auth.users`** — run the migrations in the Supabase **SQL
  Editor** (it runs as the privileged role); the `on_auth_user_created` trigger
  needs that.
- **RLS test failures** — the schema didn't fully apply; re-run `npm run db:schema`
  output in the SQL editor and confirm every `create policy …` succeeded.
- **`sync` added 0 transactions** — Sandbox generation lag; the script retries, or
  just run `npm run verify:live` again.
- **App not reachable** — make sure `npm run dev` is running and `BASE_URL`
  (default `http://localhost:3000`) is correct.

## Cleanup

- Stage 1 deletes its own test users automatically.
- Stage 2: re-run with `VERIFY_CLEANUP=1`, or delete the printed test user in the
  Supabase dashboard. If you used a throwaway project, just delete the project.
