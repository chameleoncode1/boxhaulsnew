// Customer records (accounts created on boxhauls.com). Runs against the live D1 database (add --local for local dev).
//
//   npm run customers -- list                 (newest 100 accounts)
//   npm run customers -- show CUS-ABC123      (the full record, trips and spend)
//   npm run customers -- find someone@example.com   (by email or phone)
//   npm run customers -- export customers.csv (every customer record; contains personal data, keep it private)
//
// Card numbers are never stored: Stripe keeps them. Passwords are stored only as salted hashes and never exported.
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
const local = args.includes('--local');
const [cmd, a1] = args.filter((a) => !a.startsWith('--'));
const sql = (command) => JSON.parse(execFileSync('npx', ['wrangler', 'd1', 'execute', 'boxhauls-bookings', local ? '--local' : '--remote', '--json', '--command', command], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }))[0]?.results ?? [];
const fail = (m) => (console.error(m), process.exit(1));
const q = (v) => `'${String(v).replace(/'/g, "''")}'`;
const HIDE = new Set(['password_hash', 'signup_ip_hash', 'last_login_ip_hash']);
const csvCell = (v) => (v === null || v === undefined ? '' : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
const id = (v) => (/^CUS-[A-Z0-9]{6}$/.test(v ?? '') ? v : fail(`Customer id must look like CUS-ABC123 (got "${v ?? ''}")`));
const totals = `(SELECT COUNT(*) FROM bookings b WHERE b.customer_id = c.id AND b.status = 'completed') AS completed_trips,
  (SELECT COALESCE(SUM(b.captured_cents), 0) FROM bookings b WHERE b.customer_id = c.id) AS charged_cents,
  (SELECT COALESCE(SUM(b.tip_cents), 0) FROM bookings b WHERE b.customer_id = c.id) AS tip_cents`;

switch (cmd) {
  case 'list': {
    const rows = sql(`SELECT c.id, c.status, c.first_name, c.last_name, c.email, c.phone, c.created_at, ${totals} FROM customers c ORDER BY c.created_at DESC LIMIT 100`);
    if (!rows.length) console.log('No customer accounts yet.');
    for (const r of rows) console.log(`${r.id}  ${r.status.padEnd(7)}  ${(r.first_name ?? '') + ' ' + (r.last_name ?? '')}  ${r.email ?? ''}  ${r.phone ?? ''}  trips: ${r.completed_trips}  spent: $${(r.charged_cents / 100).toFixed(2)}  joined ${r.created_at.slice(0, 10)}`);
    break;
  }
  case 'find': {
    if (!a1) fail('Usage: npm run customers -- find email-or-phone');
    const digits = a1.replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '');
    const rows = sql(`SELECT id, status, first_name, last_name, email, phone FROM customers WHERE email = ${q(a1.toLowerCase())}${digits.length === 10 ? ` OR phone = '+1${digits}'` : ''}`);
    for (const r of rows) console.log(`${r.id}  ${r.status}  ${r.first_name} ${r.last_name}  ${r.email}  ${r.phone}`);
    if (!rows.length) console.log('No match.');
    break;
  }
  case 'show': {
    const [c] = sql(`SELECT c.*, ${totals} FROM customers c WHERE c.id = '${id(a1)}'`);
    if (!c) fail('No such customer.');
    for (const [k, v] of Object.entries(c)) if (!HIDE.has(k) && v !== null) console.log(`${k.padEnd(24)} ${v}`);
    const trips = sql(`SELECT id, status, item, created_at, captured_cents, tip_cents FROM bookings WHERE customer_id = '${id(a1)}' ORDER BY created_at DESC LIMIT 20`);
    console.log('\nTrips:');
    for (const t of trips) console.log(`  ${t.id}  ${t.status.padEnd(10)}  ${t.item.padEnd(14)}  ${t.created_at.slice(0, 10)}  $${((t.captured_cents ?? 0) / 100).toFixed(2)}${t.tip_cents ? ` + $${(t.tip_cents / 100).toFixed(2)} tip` : ''}`);
    if (!trips.length) console.log('  none');
    break;
  }
  case 'export': {
    const out = a1 ?? 'customers.csv';
    const rows = sql(`SELECT c.*, ${totals} FROM customers c ORDER BY c.created_at`);
    const cols = Object.keys(rows[0] ?? {}).filter((k) => !HIDE.has(k));
    writeFileSync(out, [cols.join(','), ...rows.map((r) => cols.map((k) => csvCell(r[k])).join(','))].join('\n') + '\n');
    console.log(`Wrote ${rows.length} customers to ${out}. It contains personal data; keep it private.`);
    break;
  }
  default:
    fail('Usage: npm run customers -- list | find email-or-phone | show CUS-ABC123 | export [file.csv]   (add --local for local dev)');
}
