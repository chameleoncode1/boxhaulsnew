#!/usr/bin/env bash
# Launch customer accounts, tipping and BoxHauls Driver (driver.boxhauls.com).
#   bash scripts/launch-accounts.sh
# 1. Applies the new database tables (migrations/0006_accounts.sql) to the live D1 database.
# 2. Attaches driver.boxhauls.com to the boxhaulsnew Pages project.
# 3. Runs the QA gate and deploys the site, then the dispatch cron.
# 4. Prints the domain status. Uses your existing `wrangler login`. Safe to run again.
set -euo pipefail
cd "$(dirname "$0")/.."
export PATH="$HOME/.local/node/bin:$PATH"

A=1f24e7762766194f324ea652e0ed4e98
API=https://api.cloudflare.com/client/v4
T=$(grep -E '^oauth_token' "$HOME/Library/Preferences/.wrangler/config/default.toml" | sed 's/.*= *"\(.*\)"/\1/')
[ -n "$T" ] || { echo "Run: npx wrangler login"; exit 1; }
cf() { curl -s -H "Authorization: Bearer $T" -H "Content-Type: application/json" "$@"; }

echo "1/4 Database: adding account, driver, document and tip tables…"
npx wrangler d1 migrations apply boxhauls-bookings --remote

echo "2/4 Attaching driver.boxhauls.com…"
cf -X POST "$API/accounts/$A/pages/projects/boxhaulsnew/domains" -d '{"name":"driver.boxhauls.com"}' | python3 -c "
import json,sys
s=sys.stdin.read().strip()
d=json.loads(s) if s else {'success':True}
errs=d.get('errors') or []
print('  ok' if d.get('success') or any('already' in (e.get('message') or '').lower() for e in errs) else '  note: '+json.dumps(errs))
"

echo "3/4 Deploying the site and the dispatch timer…"
npm run deploy
npm run deploy:cron

echo "4/4 Domain status (pending → active can take a few minutes):"
cf "$API/accounts/$A/pages/projects/boxhaulsnew/domains" | python3 -c "
import json,sys
for d in json.load(sys.stdin)['result']: print('  ', d['name'], d['status'], (d.get('verification_data') or {}).get('error_message') or '')
"
echo
echo "If driver.boxhauls.com says 'CNAME record not set': Cloudflare → Workers & Pages → boxhaulsnew → Custom domains →"
echo "driver.boxhauls.com → Activate domain (or add DNS: CNAME  driver  boxhaulsnew.pages.dev, proxied). Then tell Claude to verify."
