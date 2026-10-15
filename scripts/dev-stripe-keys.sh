#!/usr/bin/env bash
# Local development only: writes Stripe TEST keys into .dev.vars (gitignored) for `wrangler pages dev`.
# Refuses live keys. Run it yourself:  bash scripts/dev-stripe-keys.sh
set -euo pipefail
cd "$(dirname "$0")/.."
read -rsp "Stripe TEST secret key (sk_test_..., hidden): " SK; echo
read -rp  "Stripe TEST publishable key (pk_test_...): " PK
[[ "$SK" == sk_test_* && "$PK" == pk_test_* ]] || { echo "Only test keys (sk_test_/pk_test_) go in .dev.vars."; exit 1; }
touch .dev.vars
grep -v -E '^(STRIPE_SECRET_KEY|STRIPE_PUBLISHABLE_KEY)=' .dev.vars > .dev.vars.tmp || true
printf 'STRIPE_SECRET_KEY=%s\nSTRIPE_PUBLISHABLE_KEY=%s\n' "$SK" "$PK" >> .dev.vars.tmp
mv .dev.vars.tmp .dev.vars
unset SK PK
echo "Saved to .dev.vars (gitignored). Test mode only."
