// Manage the drivers who receive dispatch texts. Runs against the live D1 database (add --local for local dev).
//
//   npm run drivers -- list
//   npm run drivers -- add "Maria Lopez" 559-555-0123
//   npm run drivers -- deactivate DRV-ABCD
//   npm run drivers -- activate DRV-ABCD
//   npm run drivers -- payout-link DRV-ABCD     (new payout-setup link; the old one stops working)
//
// New drivers get a payout-setup link (Stripe Connect). They receive job texts only after Stripe can pay them.
//
// Only add drivers who have been approved (background check, insurance, truck) and have agreed to receive texts.
import { execFileSync } from 'node:child_process';
import { randomInt, randomBytes, createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const args = process.argv.slice(2);
const local = args.includes('--local');
const [cmd, a1, a2] = args.filter((a) => !a.startsWith('--'));

function sql(command) {
  const out = execFileSync('npx', ['wrangler', 'd1', 'execute', 'boxhauls-bookings', local ? '--local' : '--remote', '--json', '--command', command], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return JSON.parse(out)[0]?.results ?? [];
}
const fail = (msg) => {
  console.error(msg);
  process.exit(1);
};
const SITE = readFileSync('wrangler.toml', 'utf8').match(/PUBLIC_SITE_URL\s*=\s*"([^"]+)"/)?.[1] ?? 'https://boxhauls.com';
/** A fresh payout-setup token: the raw value goes in the link, only its SHA-256 is stored. */
function payoutToken() {
  const token = randomBytes(24).toString('base64url');
  return { token, hash: createHash('sha256').update(token).digest('hex'), url: `${SITE}/drive/payouts/?t=${token}` };
}
const id = (v) => (/^DRV-[A-Z0-9]{4}$/.test(v ?? '') ? v : fail(`Driver id must look like DRV-ABCD (got "${v ?? ''}")`));

switch (cmd) {
  case 'list': {
    const rows = sql('SELECT id, name, phone, active, payouts_ready, created_at FROM drivers ORDER BY active DESC, name');
    if (!rows.length) console.log('No drivers yet. Add one: npm run drivers -- add "Name" 559-555-0123');
    for (const r of rows) console.log(`${r.id}  ${r.active ? 'active  ' : 'inactive'}  ${r.payouts_ready ? 'payouts ready' : 'payouts NOT set up'}  ${r.phone}  ${r.name}`);
    break;
  }
  case 'add': {
    const name = (a1 ?? '').trim();
    if (!/^[\p{L} .'-]{2,60}$/u.test(name)) fail('Name: 2–60 letters, spaces, apostrophes, periods or hyphens.');
    const digits = (a2 ?? '').replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '');
    if (digits.length !== 10) fail('Phone: a 10-digit US number.');
    const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    const newId = `DRV-${Array.from({ length: 4 }, () => alphabet[randomInt(alphabet.length)]).join('')}`;
    const q = (s) => `'${s.replace(/'/g, "''")}'`;
    const pt = payoutToken();
    sql(`INSERT INTO drivers (id, name, phone, has_helper, active, created_at, onboarding_token_hash) VALUES (${q(newId)}, ${q(name)}, ${q(`+1${digits}`)}, 0, 1, ${q(new Date().toISOString())}, ${q(pt.hash)})`);
    console.log(`Added ${newId}: ${name}, +1${digits}`);
    console.log(`Send them this payout-setup link (they get job texts once it's done):\n  ${pt.url}`);
    break;
  }
  case 'deactivate':
  case 'activate':
    sql(`UPDATE drivers SET active = ${cmd === 'activate' ? 1 : 0} WHERE id = '${id(a1)}'`);
    console.log(`${a1}: ${cmd}d`);
    break;
  case 'payout-link': {
    const pt = payoutToken();
    sql(`UPDATE drivers SET onboarding_token_hash = '${pt.hash}' WHERE id = '${id(a1)}'`);
    console.log(`New payout-setup link for ${a1}:\n  ${pt.url}`);
    break;
  }
  default:
    fail('Usage: npm run drivers -- list | add "Name" 559-555-0123 | payout-link DRV-ABCD | deactivate DRV-ABCD | activate DRV-ABCD   (add --local for local dev)');
}
