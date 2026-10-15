// Manage the drivers who receive dispatch texts. Runs against the live D1 database (add --local for local dev).
//
//   npm run drivers -- list
//   npm run drivers -- add "Maria Lopez" 559-555-0123
//   npm run drivers -- deactivate DRV-ABCD
//   npm run drivers -- activate DRV-ABCD
//   npm run drivers -- payout-link DRV-ABCD     (new payout-setup link; the old one stops working)
//
// BoxHauls Driver records (drivers who sign up in the app at driver.boxhauls.com):
//   npm run drivers -- applicants               (applications waiting for review)
//   npm run drivers -- show DRV-ABCD123         (the full driver record, documents and trip totals)
//   npm run drivers -- approve DRV-ABCD123      (after reviewing documents and the background check)
//   npm run drivers -- reject DRV-ABCD123 "License photo is blurry"
//   npm run drivers -- background DRV-ABCD123 clear|consider|pending|suspended
//   npm run drivers -- suspend DRV-ABCD123      (no new jobs; reinstate with approve)
//   npm run drivers -- doc DRV-ABCD123 license_front license.jpg   (save a document photo to a file)
//   npm run drivers -- export drivers.csv       (every driver record, for your records; contains personal data)
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
const id = (v) => (/^DRV-[A-Z0-9]{4,8}$/.test(v ?? '') ? v : fail(`Driver id must look like DRV-ABCD123 (got "${v ?? ''}")`));
const q1 = (v) => `'${String(v).replace(/'/g, "''")}'`;
const csvCell = (v) => (v === null || v === undefined ? '' : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));

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
  case 'applicants': {
    const rows = sql(`SELECT id, first_name, last_name, phone, email, city, application_status, submitted_at, background_status FROM drivers WHERE app_user = 1 AND application_status IN ('applying','submitted','rejected') ORDER BY application_status = 'submitted' DESC, submitted_at`);
    if (!rows.length) console.log('No applications.');
    for (const r of rows) console.log(`${r.id}  ${r.application_status.padEnd(9)}  background: ${r.background_status.padEnd(11)}  ${r.first_name} ${r.last_name}  ${r.phone}  ${r.email}  ${r.submitted_at ?? ''}`);
    break;
  }
  case 'show': {
    const [d] = sql(`SELECT * FROM drivers WHERE id = '${id(a1)}'`);
    if (!d) fail('No such driver.');
    const docs = sql(`SELECT kind, bytes, status, uploaded_at FROM driver_documents WHERE driver_id = '${id(a1)}'`);
    const [t] = sql(`SELECT COUNT(*) AS trips, COALESCE(SUM(driver_transfer_cents), 0) AS earned FROM bookings WHERE driver_id = '${id(a1)}' AND status = 'completed'`);
    const [tips] = sql(`SELECT COALESCE(SUM(t.amount_cents), 0) AS tips FROM tips t JOIN bookings b ON b.id = t.booking_id WHERE b.driver_id = '${id(a1)}' AND t.status = 'paid'`);
    const hide = new Set(['password_hash', 'has_helper', 'onboarding_token_hash', 'signup_ip_hash', 'last_login_ip_hash', 'background_consent_ip_hash']);
    for (const [k, v] of Object.entries(d)) if (!hide.has(k) && v !== null) console.log(`${k.padEnd(26)} ${v}`);
    console.log('\nDocuments:');
    for (const doc of docs) console.log(`  ${doc.kind.padEnd(16)} ${doc.status.padEnd(10)} ${Math.round(doc.bytes / 1024)} KB  ${doc.uploaded_at}`);
    if (!docs.length) console.log('  none');
    console.log(`\nCompleted trips: ${t.trips} · earned $${(t.earned / 100).toFixed(2)} + $${(tips.tips / 100).toFixed(2)} tips`);
    break;
  }
  case 'approve':
    sql(`UPDATE drivers SET application_status = 'approved', active = 1, approved_at = '${new Date().toISOString()}', reviewed_by = 'admin', rejection_reason = NULL WHERE id = '${id(a1)}'`);
    sql(`UPDATE driver_documents SET status = 'approved', reviewed_at = '${new Date().toISOString()}' WHERE driver_id = '${id(a1)}'`);
    console.log(`${a1}: approved. They can go online once payouts are set up.`);
    break;
  case 'reject':
    if (!a2) fail('Give a reason: npm run drivers -- reject DRV-ABCD123 "what needs fixing"');
    sql(`UPDATE drivers SET application_status = 'rejected', rejection_reason = ${q1(a2)}, reviewed_by = 'admin', online = 0 WHERE id = '${id(a1)}'`);
    console.log(`${a1}: sent back with reason "${a2}". They see it in the app and can resubmit.`);
    break;
  case 'suspend':
    sql(`UPDATE drivers SET application_status = 'suspended', online = 0 WHERE id = '${id(a1)}'`);
    console.log(`${a1}: suspended (no new jobs).`);
    break;
  case 'background': {
    if (!['clear', 'consider', 'pending', 'suspended'].includes(a2)) fail('Status must be clear, consider, pending or suspended.');
    sql(`UPDATE drivers SET background_status = '${a2}', background_checked_at = '${new Date().toISOString()}' WHERE id = '${id(a1)}'`);
    console.log(`${a1}: background check ${a2}.`);
    break;
  }
  case 'doc': {
    const kind = a2;
    const out = args.filter((a) => !a.startsWith('--'))[3];
    if (!kind || !out) fail('Usage: npm run drivers -- doc DRV-ABCD123 license_front license.jpg');
    const [d] = sql(`SELECT hex(data) AS hex, mime FROM driver_documents WHERE driver_id = '${id(a1)}' AND kind = ${q1(kind)}`);
    if (!d) fail('No such document.');
    (await import('node:fs')).writeFileSync(out, Buffer.from(d.hex, 'hex'));
    console.log(`Saved ${kind} (${d.mime}) to ${out}. It contains personal data; delete it when you're done.`);
    break;
  }
  case 'export': {
    const out = a1 ?? 'drivers.csv';
    const rows = sql(`SELECT d.*, (SELECT COUNT(*) FROM bookings b WHERE b.driver_id = d.id AND b.status = 'completed') AS completed_trips,
        (SELECT COALESCE(SUM(b.driver_transfer_cents), 0) FROM bookings b WHERE b.driver_id = d.id AND b.status = 'completed') AS earned_cents,
        (SELECT COALESCE(SUM(t.amount_cents), 0) FROM tips t JOIN bookings b ON b.id = t.booking_id WHERE b.driver_id = d.id AND t.status = 'paid') AS tip_cents
      FROM drivers d ORDER BY d.created_at`);
    const hide = new Set(['password_hash', 'has_helper', 'onboarding_token_hash', 'signup_ip_hash', 'last_login_ip_hash', 'background_consent_ip_hash']);
    const cols = Object.keys(rows[0] ?? {}).filter((c) => !hide.has(c));
    (await import('node:fs')).writeFileSync(out, [cols.join(','), ...rows.map((r) => cols.map((c) => csvCell(r[c])).join(','))].join('\n') + '\n');
    console.log(`Wrote ${rows.length} drivers to ${out}. It contains personal data; keep it private.`);
    break;
  }
  default:
    fail('Usage: npm run drivers -- list | applicants | show ID | approve ID | reject ID "reason" | background ID clear|consider|pending|suspended | suspend ID | doc ID kind file | export [file.csv] | add "Name" 559-555-0123 | payout-link ID | deactivate ID | activate ID   (add --local for local dev)');
}
