#!/usr/bin/env bash
# Moves boxhauls.com and www.boxhauls.com from the old "boxhauls" Worker to the new Pages project, then deploys.
#   bash scripts/cutover.sh            do the cutover
#   bash scripts/cutover.sh rollback   put both domains back on the old Worker
# Uses your existing `wrangler login`. api.boxhauls.com (boxhauls-api Worker) is not touched.
set -euo pipefail
cd "$(dirname "$0")/.."
export PATH="$HOME/.local/node/bin:$PATH"

A=1f24e7762766194f324ea652e0ed4e98
ZONE=b9ad0c63307e30ae814368ffdba50e8f
API=https://api.cloudflare.com/client/v4
T=$(grep -E '^oauth_token' "$HOME/Library/Preferences/.wrangler/config/default.toml" | sed 's/.*= *"\(.*\)"/\1/')
[ -n "$T" ] || { echo "Run: npx wrangler login"; exit 1; }
cf() { curl -s -H "Authorization: Bearer $T" -H "Content-Type: application/json" "$@"; }
ok() { python3 -c "import json,sys;d=json.load(sys.stdin);print('  ok' if d.get('success') else '  FAILED: '+json.dumps(d.get('errors')))"; }

if [ "${1:-}" = "rollback" ]; then
  echo "Removing domains from Pages project boxhaulsnew…"
  for h in boxhauls.com www.boxhauls.com; do cf -X DELETE "$API/accounts/$A/pages/projects/boxhaulsnew/domains/$h" | ok; done
  echo "Reattaching domains to the old boxhauls Worker…"
  for h in boxhauls.com www.boxhauls.com; do
    cf -X PUT "$API/accounts/$A/workers/domains" -d "{\"hostname\":\"$h\",\"service\":\"boxhauls\",\"environment\":\"production\",\"zone_id\":\"$ZONE\"}" | ok
  done
  echo "Rolled back. boxhauls.com serves the old site again within a few minutes."
  exit 0
fi

echo "1/4 Detaching boxhauls.com and www.boxhauls.com from the old boxhauls Worker…"
cf "$API/accounts/$A/workers/domains" | python3 -c "
import json,sys
for x in json.load(sys.stdin)['result']:
    if x['hostname'] in ('boxhauls.com','www.boxhauls.com') and x['service']=='boxhauls': print(x['id'])
" | while read -r id; do cf -X DELETE "$API/accounts/$A/workers/domains/$id" | ok; done

echo "2/4 Attaching both domains to the boxhaulsnew Pages project…"
for h in boxhauls.com www.boxhauls.com; do cf -X POST "$API/accounts/$A/pages/projects/boxhaulsnew/domains" -d "{\"name\":\"$h\"}" | ok; done

echo "3/4 Deploying the site and the dispatch timer with the boxhauls.com address…"
npm run deploy
npm run deploy:cron

echo "4/4 Domain status (pending → active can take a few minutes):"
cf "$API/accounts/$A/pages/projects/boxhaulsnew/domains" | python3 -c "
import json,sys
for d in json.load(sys.stdin)['result']: print('  ', d['name'], d['status'], (d.get('verification_data') or {}).get('error_message') or '')
"
echo
echo "Done. If a domain stays 'pending' with a DNS message, open Cloudflare → Workers & Pages → boxhaulsnew →"
echo "Custom domains and click 'Activate domain' (it adds the DNS record). Then tell Claude to verify."
