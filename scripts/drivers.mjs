// Manage the drivers who receive dispatch texts. Runs against the live D1 database (add --local for local dev).
//
//   npm run drivers -- list
//   npm run drivers -- add "Maria Lopez" 559-555-0123 [--helper]
//   npm run drivers -- helper DRV-ABCD on|off
//   npm run drivers -- deactivate DRV-ABCD
//   npm run drivers -- activate DRV-ABCD
//
// Only add drivers who have been approved (background check, insurance, truck) and have agreed to receive texts.
import { execFileSync } from 'node:child_process';
import { randomInt } from 'node:crypto';

const args = process.argv.slice(2);
const local = args.includes('--local');
const helper = args.includes('--helper');
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
const id = (v) => (/^DRV-[A-Z0-9]{4}$/.test(v ?? '') ? v : fail(`Driver id must look like DRV-ABCD (got "${v ?? ''}")`));

switch (cmd) {
  case 'list': {
    const rows = sql('SELECT id, name, phone, has_helper, active, created_at FROM drivers ORDER BY active DESC, name');
    if (!rows.length) console.log('No drivers yet. Add one: npm run drivers -- add "Name" 559-555-0123 [--helper]');
    for (const r of rows) console.log(`${r.id}  ${r.active ? 'active  ' : 'inactive'}  ${r.has_helper ? 'helper   ' : 'no helper'}  ${r.phone}  ${r.name}`);
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
    sql(`INSERT INTO drivers (id, name, phone, has_helper, active, created_at) VALUES (${q(newId)}, ${q(name)}, ${q(`+1${digits}`)}, ${helper ? 1 : 0}, 1, ${q(new Date().toISOString())})`);
    console.log(`Added ${newId}: ${name}, +1${digits}${helper ? ', with helper' : ''}`);
    break;
  }
  case 'helper':
    if (!['on', 'off'].includes(a2)) fail('Usage: helper DRV-ABCD on|off');
    sql(`UPDATE drivers SET has_helper = ${a2 === 'on' ? 1 : 0} WHERE id = '${id(a1)}'`);
    console.log(`${a1}: helper ${a2}`);
    break;
  case 'deactivate':
  case 'activate':
    sql(`UPDATE drivers SET active = ${cmd === 'activate' ? 1 : 0} WHERE id = '${id(a1)}'`);
    console.log(`${a1}: ${cmd}d`);
    break;
  default:
    fail('Usage: npm run drivers -- list | add "Name" 559-555-0123 [--helper] | helper DRV-ABCD on|off | deactivate DRV-ABCD | activate DRV-ABCD   (add --local for local dev)');
}
