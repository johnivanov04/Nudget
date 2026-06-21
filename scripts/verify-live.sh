#!/usr/bin/env bash
#
# End-to-end live verification against REAL services (Supabase + Plaid Sandbox).
#
# Proves the whole pipeline works for real: create a user → set payday → open a
# Plaid Sandbox item → exchange + store the encrypted token → sync transactions →
# detect bills → compute the runway → read it back.
#
# Prereqs:
#   - The app running locally:  npm run dev   (in another terminal)
#   - Your real .env.local filled in (Supabase project + Plaid SANDBOX creds +
#     TOKEN_ENCRYPTION_KEY), then exported into this shell, e.g.:
#       set -a; source .env.local; set +a
#   - PLAID_ENV must be "sandbox".
#
# Optional env:
#   BASE_URL          (default http://localhost:3000)
#   VERIFY_CLEANUP=1  delete the test user + data at the end
#
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
PLAID_HOST="https://sandbox.plaid.com"

# --- helpers ---------------------------------------------------------------
jget() { python3 -c "import sys,json; d=json.load(sys.stdin); print(d$1)"; }
fail() { echo "❌ $1" >&2; exit 1; }
need() { [ -n "${!1:-}" ] || fail "Missing env var: $1"; }

echo "▶ Pre-flight"
need NEXT_PUBLIC_SUPABASE_URL
need NEXT_PUBLIC_SUPABASE_ANON_KEY
need SUPABASE_SERVICE_ROLE_KEY
need PLAID_CLIENT_ID
need PLAID_SECRET
[ "${PLAID_ENV:-}" = "sandbox" ] || fail "PLAID_ENV must be 'sandbox' (got '${PLAID_ENV:-unset}')"
SUPA="${NEXT_PUBLIC_SUPABASE_URL%/}"

curl -sf "$BASE_URL/api/health" >/dev/null || fail "App not reachable at $BASE_URL (run: npm run dev)"
echo "  server up at $BASE_URL"

EMAIL="verify+$(date +%s)@nudget.test"
PASSWORD="Verify_$(date +%s)!"

echo "▶ 1/8  Create a Supabase user ($EMAIL)"
USER_JSON=$(curl -sf -X POST "$SUPA/auth/v1/admin/users" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\",\"email_confirm\":true}") || fail "create user failed"
USER_ID=$(echo "$USER_JSON" | jget "['id']")
echo "  user id: $USER_ID  (profile auto-created by trigger)"

echo "▶ 2/8  Sign in to get a JWT"
TOKEN=$(curl -sf -X POST "$SUPA/auth/v1/token?grant_type=password" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" | jget "['access_token']")
[ -n "$TOKEN" ] || fail "sign-in failed"
AUTH=(-H "Authorization: Bearer $TOKEN")
echo "  got access token"

echo "▶ 3/8  Set a biweekly paycheck schedule"
LAST_PAYDAY=$(date -v-7d +%Y-%m-%d 2>/dev/null || date -d "7 days ago" +%Y-%m-%d)
curl -sf -X POST "$BASE_URL/api/onboarding/paycheck" "${AUTH[@]}" -H "Content-Type: application/json" \
  -d "{\"frequency\":\"biweekly\",\"lastPaycheckDate\":\"$LAST_PAYDAY\"}" >/dev/null || fail "onboarding failed"
echo "  schedule saved (last payday $LAST_PAYDAY)"

echo "▶ 4/8  Create a Plaid Sandbox public token"
PUBLIC_TOKEN=$(curl -sf -X POST "$PLAID_HOST/sandbox/public_token/create" -H "Content-Type: application/json" \
  -d "{\"client_id\":\"$PLAID_CLIENT_ID\",\"secret\":\"$PLAID_SECRET\",\"institution_id\":\"ins_109508\",\"initial_products\":[\"transactions\"]}" \
  | jget "['public_token']")
[ -n "$PUBLIC_TOKEN" ] || fail "Plaid sandbox public_token/create failed (check Plaid creds)"
echo "  public_token created"

echo "▶ 5/8  Exchange public token (server encrypts + stores it)"
EXCHANGE=$(curl -sf -X POST "$BASE_URL/api/plaid/exchange-public-token" "${AUTH[@]}" -H "Content-Type: application/json" \
  -d "{\"publicToken\":\"$PUBLIC_TOKEN\"}") || fail "exchange failed"
echo "$EXCHANGE" | grep -qiv "access" || fail "SECURITY: response appears to contain a token!"
ACCTS=$(echo "$EXCHANGE" | jget "['accounts']" | python3 -c "import sys; print(len(eval(sys.stdin.read())))")
echo "  linked $ACCTS account(s); response carries NO access token ✓"

echo "▶ 6/8  Sync transactions (cursor-based; detect bills; recompute runway)"
for attempt in 1 2 3; do
  SYNC=$(curl -sf -X POST "$BASE_URL/api/plaid/sync" "${AUTH[@]}") || fail "sync failed"
  ADDED=$(echo "$SYNC" | python3 -c "import sys,json; d=json.load(sys.stdin); print(sum(r.get('added',0) for r in d.get('results',[])))")
  [ "$ADDED" != "0" ] && break
  echo "  sandbox transactions not ready yet, retrying ($attempt)…"; sleep 3
done
echo "  synced; added $ADDED transaction(s) this run"

echo "▶ 7/8  Read the runway + detected bills"
RUNWAY=$(curl -sf "$BASE_URL/api/runway/current" "${AUTH[@]}")
BILLS=$(curl -sf "$BASE_URL/api/bills/detected" "${AUTH[@]}")
echo "  --- runway/current ---"; echo "$RUNWAY" | python3 -m json.tool | sed 's/^/    /'
BILLCOUNT=$(echo "$BILLS" | python3 -c "import sys,json; print(len(json.load(sys.stdin).get('bills',[])))")
echo "  detected bills: $BILLCOUNT"

echo "▶ 8/8  Widget snapshot (privacy mode)"
curl -sf "$BASE_URL/api/widget/snapshot?privacy=1" "${AUTH[@]}" | python3 -m json.tool | sed 's/^/    /'

if [ "${VERIFY_CLEANUP:-}" = "1" ]; then
  echo "▶ Cleanup: deleting the test user (cascades all data)"
  curl -sf -X DELETE "$BASE_URL/api/account" "${AUTH[@]}" >/dev/null && echo "  deleted $USER_ID"
else
  echo "ℹ Left test user $EMAIL ($USER_ID) in place. Re-run with VERIFY_CLEANUP=1 to delete."
fi

echo "✅ Live end-to-end verification complete."
