#!/usr/bin/env bash
# Sets the booking backend's secrets on the Cloudflare Pages project. Run it yourself:
#   bash scripts/setup-secrets.sh
# Keys are read with hidden input and sent straight to Cloudflare; nothing is written to disk or echoed.
set -euo pipefail
cd "$(dirname "$0")/.."
export PATH="$HOME/.local/node/bin:$PATH"
PROJECT=boxhaulsnew
put() { npx wrangler pages secret put "$1" --project-name "$PROJECT" >/dev/null && echo "  ✓ $1 set"; }
# Twilio secrets are also needed by the scheduled Worker that texts customers when no driver accepts.
put_both() { local v; v=$(cat); printf '%s' "$v" | put "$1"; printf '%s' "$v" | npx wrangler secret put "$1" --config workers/dispatch-cron/wrangler.toml >/dev/null && echo "  ✓ $1 set on dispatch-cron"; }

echo "BoxHauls booking secrets for Cloudflare Pages project '$PROJECT'"
echo

echo "1) Google Maps API key (Places API (New) + Routes API enabled). See deploy/cloudflare/README.md."
read -rsp "   Paste the key (input hidden, Enter to skip): " GKEY; echo
if [ -n "$GKEY" ]; then printf '%s' "$GKEY" | put GOOGLE_MAPS_API_KEY; else echo "  - skipped"; fi
unset GKEY

echo "2) Quote-signing secret (generated randomly)."
read -rp "   Generate and set QUOTE_SECRET now? Only needed once. [Y/n] " ans
if [[ "${ans:-Y}" =~ ^[Yy]$ ]]; then openssl rand -hex 32 | tr -d '\n' | put QUOTE_SECRET; else echo "  - skipped"; fi

echo "3) Twilio, for dispatch texts to drivers and customers. See deploy/cloudflare/README.md."
read -rp "   Account SID (starts with AC, Enter to skip): " TSID
if [ -n "$TSID" ]; then
  printf '%s' "$TSID" | put_both TWILIO_ACCOUNT_SID
  read -rsp "   Auth token (input hidden): " TTOK; echo
  printf '%s' "$TTOK" | put_both TWILIO_AUTH_TOKEN
  read -rp "   Sending number (+1...) or Messaging Service SID (MG...): " TFROM
  printf '%s' "$TFROM" | put_both TWILIO_FROM
else echo "  - skipped"; fi
unset TSID TTOK TFROM

echo "4) Optional: Cloudflare API token with Email Sending permission, for booking alert emails."
read -rsp "   Paste the token (input hidden, Enter to skip): " ETOKEN; echo
if [ -n "$ETOKEN" ]; then printf '%s' "$ETOKEN" | put CF_EMAIL_API_TOKEN; else echo "  - skipped"; fi
unset ETOKEN

echo
echo "Done. Secrets apply to the next deployment: run  npm run deploy  (and  npm run deploy:cron  after setting Twilio)"
