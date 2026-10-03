#!/usr/bin/env bash
# Sets the booking backend's secrets on the Cloudflare Pages project. Run it yourself:
#   bash scripts/setup-secrets.sh
# Keys are read with hidden input and sent straight to Cloudflare; nothing is written to disk or echoed.
set -euo pipefail
cd "$(dirname "$0")/.."
export PATH="$HOME/.local/node/bin:$PATH"
PROJECT=boxhaulsnew
put() { npx wrangler pages secret put "$1" --project-name "$PROJECT" >/dev/null && echo "  ✓ $1 set"; }

echo "BoxHauls booking secrets for Cloudflare Pages project '$PROJECT'"
echo

echo "1) Google Maps API key (Places API (New) + Routes API enabled). See deploy/cloudflare/README.md."
read -rsp "   Paste the key (input hidden, Enter to skip): " GKEY; echo
if [ -n "$GKEY" ]; then printf '%s' "$GKEY" | put GOOGLE_MAPS_API_KEY; else echo "  - skipped"; fi
unset GKEY

echo "2) Quote-signing secret (generated randomly)."
read -rp "   Generate and set QUOTE_SECRET now? Only needed once. [Y/n] " ans
if [[ "${ans:-Y}" =~ ^[Yy]$ ]]; then openssl rand -hex 32 | tr -d '\n' | put QUOTE_SECRET; else echo "  - skipped"; fi

echo "3) Optional: Cloudflare API token with Email Sending permission, for booking alert emails."
read -rsp "   Paste the token (input hidden, Enter to skip): " ETOKEN; echo
if [ -n "$ETOKEN" ]; then printf '%s' "$ETOKEN" | put CF_EMAIL_API_TOKEN; else echo "  - skipped"; fi
unset ETOKEN

echo
echo "Done. Secrets apply to the next deployment: run  npm run deploy"
