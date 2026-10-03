// QA gate (CLAUDE.md "Commands"). Builds the site, serves dist/ like Cloudflare does, and fetches every Phase-1
// route with curl — the HTML a crawler gets with JavaScript disabled. Exits non-zero if any Phase-1 page fails.
//
//   npm run qa                      build, then check
//   npm run qa -- --no-build        check the existing dist/
//   npm run qa -- --structural      fail only on STRUCTURE problems (ignore CONTENT that Prompt 4 will write)
//
// Failure kinds:
//   STRUCTURE  templates, schema plumbing, links, canonical, sitemap, reachability — fix in code or spec
//   CONTENT    something that exists only once the page's copy is written (FAQPage/HowTo/Article/JobPosting
//              schema, meta description)
// TODO markers are listed per page but never fail the gate; a page with any is still not shippable.
import { execFile, spawnSync } from 'node:child_process';
import { promisify } from 'node:util';
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const args = new Set(process.argv.slice(2));
const STRUCTURAL_ONLY = args.has('--structural');

// ---------------------------------------------------------------------------------------------------------
// Spec
const map = JSON.parse(readFileSync('docs/sitemap.json', 'utf8'));
const ph = JSON.parse(readFileSync('docs/placeholders.json', 'utf8'));
const sub = (s) => s.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (m, k) => (typeof ph[k] === 'string' && !ph[k].startsWith('TODO') ? ph[k] : m));
const SITE = `https://${ph.DOMAIN}`;
const pages = map.pages.map((p) => ({ ...p, url: sub(p.url), links_to: p.links_to.map(sub) }));
const byUrl = new Map(pages.map((p) => [p.url, p]));
const audience = (url) => (url.startsWith('/drive/') ? 'driver' : url.startsWith('/partners/') ? 'partner' : 'rider');

// Mirrors AUDIENCE_EXCEPTIONS in src/lib/links.ts (CLAUDE.md rule 7). Keep both lists identical.
const linksSrc = readFileSync('src/lib/links.ts', 'utf8');
const EXCEPTIONS = [...linksSrc.matchAll(/\['(\/[^']*)',\s*'(\/[^']*)'\]/g)].map((m) => `${m[1]} ${m[2]}`);
const forbidden = (from, to) =>
  !EXCEPTIONS.includes(`${from} ${to}`) &&
  ((audience(from) === 'rider' && to.startsWith('/drive/')) || (audience(from) === 'driver' && to.startsWith('/services/')));

// Schema types that can only exist once the page's copy is written.
const CONTENT_TYPES = new Set(['FAQPage', 'HowTo', 'Article', 'JobPosting']);
// A sitemap type may be satisfied by a more specific schema.org type.
const SATISFIES = { LocalBusiness: ['LocalBusiness', 'MovingCompany'] };

// CLAUDE.md rules 8–10. Matched case-insensitively on word boundaries in visible text, <title> and meta content.
const BANNED = [
  'logistics', 'solution', 'solutions', 'on-demand ecosystem', 'cargo', 'freight', 'buddy with a truck',
  'friend with a truck', 'too big for my car', 'welcome to', 'truck-n-go', 'truck n go', 'truckngo', 'truck-and-go',
  'lovable', 'premium', 'luxury', 'white glove', 'white-glove',
];
// Legitimate uses of a banned word. Each is an exact phrase, optionally limited to some pages.
const ALLOWED = [
  // Insurance terminology: the coverage placeholder and the map's "cargo vs. liability" topic (/trust/insurance/).
  { phrase: ph.COVERAGE_LIMIT, pages: null },
  { phrase: 'cargo insurance', pages: null },
  { phrase: 'cargo coverage', pages: null },
  { phrase: 'cargo and liability', pages: null },
  { phrase: 'cargo vs. liability', pages: null },
  // Map Section 1: /about/ must say what BoxHauls is not ("not freight").
  { phrase: 'not freight', pages: ['/about/'] },
];
const BRAND_MISSPELLINGS = [/\bBox Hauls\b/i, /\bBoxhauls\b/, /\bBOXHAULS\b/, /\bBoxHauls\.com\b/];

// ---------------------------------------------------------------------------------------------------------
// Build
if (!args.has('--no-build')) {
  console.log('qa: building…');
  const r = spawnSync('npm', ['run', 'build'], { encoding: 'utf8', shell: process.platform === 'win32' });
  const out = `${r.stdout}\n${r.stderr}`;
  if (r.status !== 0) {
    console.error(out);
    console.error('qa: build failed');
    process.exit(1);
  }
  const warnings = out.split('\n').filter((l) => /\b(warn|warning)\b/i.test(l) && !/0 warnings/.test(l));
  if (warnings.length) {
    console.error(warnings.join('\n'));
    console.error('qa: build must pass with zero warnings');
    process.exit(1);
  }
}
if (!existsSync('dist/index.html')) {
  console.error('qa: dist/ is missing; run without --no-build');
  process.exit(1);
}

// ---------------------------------------------------------------------------------------------------------
// Static server shaped like Cloudflare: /x/ → x/index.html, files as-is.
const TYPES = { '.html': 'text/html; charset=utf-8', '.xml': 'application/xml', '.txt': 'text/plain', '.png': 'image/png', '.webp': 'image/webp', '.css': 'text/css', '.js': 'text/javascript' };
const server = createServer((req, res) => {
  let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let file = join('dist', path);
  if (path.endsWith('/')) file = join(file, 'index.html');
  if (!existsSync(file) || !statSync(file).isFile()) {
    res.writeHead(404).end('not found');
    return;
  }
  res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' });
  res.end(readFileSync(file));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const ORIGIN = `http://127.0.0.1:${server.address().port}`;

// Async: the server runs in this process, so a blocking curl would deadlock it.
const run = promisify(execFile);
async function curl(path) {
  const { stdout } = await run('curl', ['-sS', '-w', '\n%{http_code}', `${ORIGIN}${path}`], { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
  const i = stdout.lastIndexOf('\n');
  return { status: Number(stdout.slice(i + 1)), body: stdout.slice(0, i) };
}

// ---------------------------------------------------------------------------------------------------------
// HTML helpers
const decode = (s) =>
  s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#x27;/g, "'").replace(/&nbsp;/g, ' ');
const stripSpec = (html) => html.replace(/<details class="mt-10 rounded-md border border-dashed[\s\S]*?<\/details>/g, '');
const mainOf = (html) => html.match(/<main[\s\S]*?<\/main>/)?.[0] ?? '';
const hrefs = (html) => [...html.matchAll(/<a\b[^>]*\bhref="([^"]+)"/g)].map((m) => decode(m[1]));
const internal = (h) => {
  if (h.startsWith(SITE)) h = h.slice(SITE.length) || '/';
  if (!h.startsWith('/') || h.startsWith('//')) return null;
  return h.split('#')[0].split('?')[0] || '/';
};
function visibleText(html) {
  const metas = [...html.matchAll(/<meta\b[^>]*\bcontent="([^"]*)"/g)].map((m) => m[1]).join(' ');
  const title = html.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? '';
  const body = stripSpec(html)
    .replace(/<head[\s\S]*?<\/head>/, '')
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<[^>]+>/g, ' ');
  return decode(`${title} ${metas} ${body}`).replace(/\s+/g, ' ');
}
const typesOf = (node) => (Array.isArray(node['@type']) ? node['@type'] : [node['@type']]);

// Expected breadcrumb trail: Home, then ancestors that are real pages, then the page.
function expectedTrail(url) {
  if (url === '/') return [];
  const parts = url.slice(1, -1).split('/');
  const trail = ['/'];
  for (let i = 1; i <= parts.length; i++) {
    const u = `/${parts.slice(0, i).join('/')}/`;
    if (byUrl.has(u)) trail.push(u);
  }
  return trail;
}

// ---------------------------------------------------------------------------------------------------------
// Fetch everything once; build the click graph from all pages.
const html = new Map();
for (let i = 0; i < pages.length; i += 16) {
  const batch = pages.slice(i, i + 16);
  const got = await Promise.all(batch.map((p) => curl(p.url)));
  batch.forEach((p, j) => html.set(p.url, got[j]));
}
const sitemapXml = (await curl('/sitemap.xml')).body;
const sitemapLocs = new Set([...sitemapXml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]));

const depth = new Map([['/', 0]]);
const queue = ['/'];
while (queue.length) {
  const u = queue.shift();
  const d = depth.get(u);
  if (d >= 3) continue;
  const page = html.get(u);
  if (!page || page.status !== 200) continue;
  for (const h of hrefs(page.body)) {
    const t = internal(h);
    if (t && byUrl.has(t) && !depth.has(t)) {
      depth.set(t, d + 1);
      queue.push(t);
    }
  }
}
server.close();

// ---------------------------------------------------------------------------------------------------------
// Checks
const COLS = ['200', 'H1', 'LD', 'Crumb', 'Links', '{{}}', 'Banned', 'Canon', 'Sitemap', '≤3', 'Index'];
const results = [];

for (const p of pages.filter((p) => p.phase === 1)) {
  const { status, body } = html.get(p.url);
  const fails = []; // { kind, col, msg }
  const fail = (col, msg, kind = 'STRUCTURE') => fails.push({ kind, col, msg });
  const main = mainOf(body);
  const canonical = `${SITE}${p.url}`;

  if (status !== 200) fail('200', `HTTP ${status}`);

  // H1
  const h1s = [...body.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/g)];
  if (h1s.length !== 1) fail('H1', `${h1s.length} H1 elements`);
  else if (!decode(h1s[0][1].replace(/<[^>]+>/g, '')).trim()) fail('H1', 'empty H1');

  // JSON-LD
  const blocks = [...body.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  let nodes = [];
  if (blocks.length !== 1) fail('LD', `${blocks.length} JSON-LD blocks (expected one @graph)`);
  for (const b of blocks) {
    try {
      const g = JSON.parse(b[1]);
      nodes = nodes.concat(g['@graph'] ?? [g]);
    } catch (e) {
      fail('LD', `JSON-LD does not parse: ${e.message}`);
    }
  }
  const types = new Set(nodes.flatMap(typesOf));
  for (const t of p.schema) {
    const ok = (SATISFIES[t] ?? [t]).some((x) => types.has(x));
    if (!ok) fail('LD', `missing ${t}`, CONTENT_TYPES.has(t) ? 'CONTENT' : 'STRUCTURE');
  }
  if (!nodes.some((n) => n['@id'] === `${SITE}/#organization` && typesOf(n).includes('Organization'))) fail('LD', 'no Organization #organization node');
  for (const bad of ['Review', 'AggregateRating']) if (types.has(bad)) fail('LD', `${bad} must never be emitted`);
  const faq = nodes.find((n) => typesOf(n).includes('FAQPage'));
  if (faq) {
    const text = visibleText(body);
    for (const q of faq.mainEntity ?? []) if (!text.includes(q.name)) fail('LD', `FAQ question not visible on page: "${q.name}"`);
  }

  // Breadcrumbs
  const trail = expectedTrail(p.url).map((u) => `${SITE}${u}`);
  if (trail.length) {
    const list = nodes.find((n) => typesOf(n).includes('BreadcrumbList'));
    const got = (list?.itemListElement ?? []).map((i) => i.item);
    if (!list) fail('Crumb', 'no BreadcrumbList');
    else if (JSON.stringify(got) !== JSON.stringify(trail)) fail('Crumb', `BreadcrumbList ${got.join(' > ')} ≠ path ${trail.join(' > ')}`);
    const nav = body.match(/<nav aria-label="Breadcrumb"[\s\S]*?<\/nav>/)?.[0] ?? '';
    const navLinks = hrefs(nav).map((h) => `${SITE}${h}`);
    if (!nav) fail('Crumb', 'no visible breadcrumb');
    else if (JSON.stringify(navLinks) !== JSON.stringify(trail.slice(0, -1))) fail('Crumb', 'visible breadcrumb links do not mirror the path');
  }

  // links_to in body
  const bodyLinks = new Set(hrefs(main).map(internal).filter(Boolean));
  const deferred = [];
  for (const t of p.links_to) {
    if (forbidden(p.url, t)) {
      fail('Links', `links_to ${t} breaks audience isolation (not an approved exception)`);
      continue;
    }
    if (!byUrl.get(t)) {
      fail('Links', `links_to ${t} is not a page`);
      continue;
    }
    if (byUrl.get(t).phase !== 1) {
      deferred.push(t);
      continue;
    }
    if (!bodyLinks.has(t)) fail('Links', `links_to ${t} is not linked in the body`);
  }
  for (const t of bodyLinks) {
    const target = byUrl.get(t);
    if (target && target.phase !== 1) fail('Links', `body links to ${t}, which is not live (phase ${target.phase})`);
    if (forbidden(p.url, t)) fail('Links', `body links to ${t} (audience isolation)`);
  }

  // Unresolved placeholders
  const unresolved = [...new Set(body.match(/\{\{[^}]*\}\}/g) ?? [])];
  if (unresolved.length) fail('{{}}', `unresolved ${unresolved.join(', ')}`);

  // Banned phrases and brand spelling
  let text = visibleText(body);
  for (const a of ALLOWED) {
    if (!a.phrase || (a.pages && !a.pages.includes(p.url))) continue;
    text = text.replace(new RegExp(a.phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), ' ');
  }
  const lower = text.toLowerCase();
  for (const w of BANNED) {
    const re = new RegExp(`(^|[^a-z])${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z]|$)`, 'i');
    if (re.test(lower)) fail('Banned', `banned phrase "${w}"`);
  }
  for (const re of BRAND_MISSPELLINGS) {
    const m = text.match(re);
    if (m) fail('Banned', `brand spelled "${m[0]}" (must be BoxHauls / boxhauls.com)`);
  }

  // Canonical
  const canon = [...body.matchAll(/<link rel="canonical" href="([^"]+)"/g)].map((m) => m[1]);
  if (canon.length !== 1 || canon[0] !== canonical) fail('Canon', `canonical ${canon.join(', ') || 'missing'} ≠ ${canonical}`);

  // sitemap.xml
  if (!sitemapLocs.has(canonical)) fail('Sitemap', 'not in sitemap.xml');

  // Reachability
  if (!depth.has(p.url)) fail('≤3', 'not reachable within 3 clicks of /');

  // Indexable
  if (/<meta name="robots" content="[^"]*noindex/.test(body)) fail('Index', 'Phase-1 page is noindex');
  if (!/<title>[^<]+<\/title>/.test(body)) fail('Index', 'missing <title>');
  if (!/<meta name="description" content="[^"]+"/.test(body)) fail('Index', 'missing meta description', 'CONTENT');

  // TODO markers (listed, never failing)
  const todos = [...stripSpec(body).matchAll(/<span class="todo">\[TODO: ([^\]<]+)\]<\/span>/g)].map((m) => decode(m[1]));

  results.push({ url: p.url, fails, todos, deferred, depth: depth.get(p.url) });
}

// ---------------------------------------------------------------------------------------------------------
// Report
const counts = (r) => ({
  s: r.fails.filter((f) => f.kind === 'STRUCTURE').length,
  c: r.fails.filter((f) => f.kind === 'CONTENT').length,
});
const pad = (s, n) => String(s).padEnd(n);
const urlW = Math.max(...results.map((r) => r.url.length)) + 1;
console.log(`\n${pad('Phase-1 route', urlW)} ${COLS.map((c) => pad(c, 6)).join(' ')} TODO`);
for (const r of results) {
  const cell = (col) => {
    const f = r.fails.filter((x) => x.col === col);
    if (!f.length) return '✓';
    return f.some((x) => x.kind === 'STRUCTURE') ? '✗' : 'c';
  };
  console.log(`${pad(r.url, urlW)} ${COLS.map((c) => pad(cell(c), 6)).join(' ')} ${r.todos.length || ''}`);
}
console.log('\n✓ pass   ✗ STRUCTURE failure   c CONTENT pending (needs page copy)\n');

const failing = results.filter((r) => counts(r).s || (!STRUCTURAL_ONLY && counts(r).c));
for (const r of failing) {
  console.log(r.url);
  for (const f of r.fails) if (!STRUCTURAL_ONLY || f.kind === 'STRUCTURE') console.log(`  ${f.kind === 'STRUCTURE' ? '✗' : 'c'} [${f.col}] ${f.msg}`);
}

const todoPages = results.filter((r) => r.todos.length);
if (todoPages.length) {
  console.log('\nTODO markers (not failures; a page with any is not shippable):');
  for (const r of todoPages) {
    const keys = [...new Set(r.todos.filter((t) => !t.startsWith('write — ')))];
    const writes = r.todos.filter((t) => t.startsWith('write — ')).length;
    console.log(`  ${r.url}: ${[writes ? `${writes} blocks to write` : '', ...keys].filter(Boolean).join(', ')}`);
  }
}

const totalS = results.reduce((n, r) => n + counts(r).s, 0);
const totalC = results.reduce((n, r) => n + counts(r).c, 0);
const deferredN = results.reduce((n, r) => n + r.deferred.length, 0);
console.log(
  `\nqa: ${results.length} Phase-1 routes · ${totalS} structure failures · ${totalC} content pending${STRUCTURAL_ONLY ? ' (ignored: --structural)' : ''} · ${deferredN} deferred links · ${todoPages.length} pages with TODO markers`,
);
const failed = totalS > 0 || (!STRUCTURAL_ONLY && totalC > 0);
console.log(failed ? 'qa: FAIL' : 'qa: PASS');
process.exit(failed ? 1 : 0);
