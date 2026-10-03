// Crawls the built site from / and reports broken internal links (CLAUDE.md "npm run links").
// Checks every <a href>, <link href>, <img src>, <source srcset> and og:image that points at this site.
// Also visits pages no link reaches (from docs/sitemap.json) so stubs get checked too.
//
// App routes (/auth, /account, /embed/, /api/) are served by the app, not this static build. Links to them are
// listed separately and do not fail the crawl. /book/ is built here (src/pages/book.astro) and checked normally.
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

const DIST = 'dist';
const ph = JSON.parse(readFileSync('docs/placeholders.json', 'utf8'));
const map = JSON.parse(readFileSync('docs/sitemap.json', 'utf8'));
const SITE = `https://${ph.DOMAIN}`;
const APP_ROUTES = ['/auth', '/account', '/embed/', '/api/'];
const sub = (s) => s.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (_, k) => ph[k]);

if (!existsSync(join(DIST, 'index.html'))) {
  console.error('links: dist/ is missing; run npm run build first');
  process.exit(1);
}

/** Resolve a site path to a file in dist the way Cloudflare serves it. */
function fileFor(path) {
  let file = join(DIST, decodeURIComponent(path));
  if (path.endsWith('/')) file = join(file, 'index.html');
  return existsSync(file) && statSync(file).isFile() ? file : null;
}

function toPath(raw, from) {
  let h = raw.trim().replace(/&amp;/g, '&');
  if (!h || h.startsWith('#') || /^(mailto|tel|data|javascript):/i.test(h)) return null;
  if (h.startsWith(SITE)) h = h.slice(SITE.length) || '/';
  if (/^[a-z]+:\/\//i.test(h) || h.startsWith('//')) return null; // external
  const url = new URL(h, `http://x${from}`);
  return url.pathname;
}

function refs(html) {
  const out = [];
  for (const m of html.matchAll(/<(?:a|link)\b[^>]*\bhref="([^"]*)"/g)) out.push(m[1]);
  for (const m of html.matchAll(/<(?:img|script|source)\b[^>]*\bsrc="([^"]*)"/g)) out.push(m[1]);
  for (const m of html.matchAll(/\bsrcset="([^"]*)"/g)) out.push(...m[1].split(',').map((s) => s.trim().split(/\s+/)[0]));
  for (const m of html.matchAll(/<meta property="og:image" content="([^"]*)"/g)) out.push(m[1]);
  return out;
}

const seeds = ['/', ...map.pages.map((p) => sub(p.url))];
const visited = new Set();
const queue = [...seeds];
const broken = []; // [from, target]
const app = new Map(); // target -> Set(from)
let checked = 0;

while (queue.length) {
  const page = queue.shift();
  if (visited.has(page)) continue;
  visited.add(page);
  const file = fileFor(page);
  if (!file) continue; // reported by whoever linked to it; seeds are verified below
  const html = readFileSync(file, 'utf8');
  for (const raw of refs(html)) {
    const path = toPath(raw, page);
    if (!path) continue;
    checked++;
    if (APP_ROUTES.some((r) => path === r.replace(/\/$/, '') || path.startsWith(r))) {
      (app.get(path) ?? app.set(path, new Set()).get(path)).add(page);
      continue;
    }
    if (!fileFor(path)) {
      broken.push([page, raw]);
      continue;
    }
    if (path.endsWith('/') && !visited.has(path)) queue.push(path);
  }
}

for (const s of seeds) if (!fileFor(s)) broken.push(['docs/sitemap.json', s]);

if (app.size) {
  console.log('App routes (served by the booking app, not this build; not failures):');
  for (const [path, from] of app) console.log(`  ${path}  ← ${from.size} page(s)`);
}
if (broken.length) {
  console.log('\nBroken internal links:');
  for (const [from, to] of broken) console.log(`  ${from} → ${to}`);
}
console.log(`\nlinks: ${visited.size} pages crawled · ${checked} internal references · ${broken.length} broken`);
process.exit(broken.length ? 1 : 0);
