#!/usr/bin/env bash
#
# Seed a PERSISTENT demo user with real data so you can sign into the iOS app and
# see the dashboard populated: creates the user, sets a payday, links a Plaid
# Sandbox bank, and syncs transactions. Prints the credentials at the end.
#
# Unlike verify-live.sh, this does NOT delete the user.
#
# Prereqs (same as verify-live):
#   - App running:  npm run dev   (with a filled .env.local, PLAID_ENV=sandbox)
#   - Env exported into this shell:  set -a; source .env.local; set +a
#
# Optional env: BASE_URL (default http://localhost:3000),
#               DEMO_EMAIL / DEMO_PASSWORD (defaults below).
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
PLAID_HOST="https://sandbox.plaid.com"
EMAIL="${DEMO_EMAIL:-demo@nudget.test}"
PASSWORD="${DEMO_PASSWORD:-DemoPass123!}"

jget() { python3 -c "import sys,json; d=json.load(sys.stdin); print(d$1)"; }
fail() { echo "❌ $1" >&2; exit 1; }
need() { [ -n "${!1:-}" ] || fail "Missing env var: $1 (run: set -a; source .env.local; set +a)"; }

need NEXT_PUBLIC_SUPABASE_URL
need NEXT_PUBLIC_SUPABASE_ANON_KEY
need SUPABASE_SERVICE_ROLE_KEY
need PLAID_CLIENT_ID
need PLAID_SECRET
[ "${PLAID_ENV:-}" = "sandbox" ] || fail "PLAID_ENV must be 'sandbox'"
SUPA="${NEXT_PUBLIC_SUPABASE_URL%/}"
curl -sf "$BASE_URL/api/health" >/dev/null || fail "App not reachable at $BASE_URL (run: npm run dev)"

echo "▶ Creating (or reusing) demo user $EMAIL"
curl -s -X POST "$SUPA/auth/v1/admin/users" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\",\"email_confirm\":true}" >/dev/null || true

echo "▶ Signing in"
TOKEN=$(curl -sf -X POST "$SUPA/auth/v1/token?grant_type=password" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" | jget "['access_token']")
[ -n "$TOKEN" ] || fail "Sign-in failed (if the user already existed with a different password, set DEMO_PASSWORD)"
AUTH=(-H "Authorization: Bearer $TOKEN")

echo "▶ Setting a biweekly payday"
LAST_PAYDAY=$(date -v-7d +%Y-%m-%d 2>/dev/null || date -d "7 days ago" +%Y-%m-%d)
curl -sf -X POST "$BASE_URL/api/onboarding/paycheck" "${AUTH[@]}" -H "Content-Type: application/json" \
  -d "{\"frequency\":\"biweekly\",\"lastPaycheckDate\":\"$LAST_PAYDAY\"}" >/dev/null || fail "payday failed"

echo "▶ Linking a Plaid Sandbox bank"
PUBLIC_TOKEN=$(curl -sf -X POST "$PLAID_HOST/sandbox/public_token/create" -H "Content-Type: application/json" \
  -d "{\"client_id\":\"$PLAID_CLIENT_ID\",\"secret\":\"$PLAID_SECRET\",\"institution_id\":\"ins_109508\",\"initial_products\":[\"transactions\"]}" \
  | jget "['public_token']")
curl -sf -X POST "$BASE_URL/api/plaid/exchange-public-token" "${AUTH[@]}" -H "Content-Type: application/json" \
  -d "{\"publicToken\":\"$PUBLIC_TOKEN\"}" >/dev/null || fail "exchange failed"

echo "▶ Syncing transactions (+ detect bills + compute runway)"
for attempt in 1 2 3; do
  ADDED=$(curl -sf -X POST "$BASE_URL/api/plaid/sync" "${AUTH[@]}" \
    | python3 -c "import sys,json; d=json.load(sys.stdin); print(sum(r.get('added',0) for r in d.get('results',[])))")
  [ "$ADDED" != "0" ] && break
  echo "  transactions not ready, retrying ($attempt)…"; sleep 3
done

echo ""
echo "✅ Demo user ready. Sign into the iOS app with:"
echo "     email:    $EMAIL"
echo "     password: $PASSWORD"
echo "   (synced $ADDED transactions). Re-run this script anytime to refresh data."
