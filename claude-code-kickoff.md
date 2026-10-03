# BoxHauls — Claude Code kickoff

## 1. Set up the repo (terminal)

```bash
mkdir boxhauls && cd boxhauls
git init
mkdir docs scripts
# copy the four spec files into place
cp ~/Downloads/boxhauls/boxhauls-topical-map.md docs/topical-map.md
cp ~/Downloads/boxhauls/sitemap.json           docs/sitemap.json
cp ~/Downloads/boxhauls/placeholders.json      docs/placeholders.json
cp ~/Downloads/boxhauls/build_map.py           build_map.py
cp ~/Downloads/boxhauls/CLAUDE.md              CLAUDE.md
git add -A && git commit -m "docs: topical map, sitemap, placeholders, CLAUDE.md"
claude
```

Before you run prompt 4, open `docs/placeholders.json` and replace every `TODO` you can. The more you fill, the fewer TODO markers ship.

---

## 2. Prompts, in order

Paste one at a time. Let each finish and pass its check before the next.

### Prompt 1 — Read, plan, scaffold

```
Read CLAUDE.md, docs/topical-map.md, docs/sitemap.json, and docs/placeholders.json completely before doing anything.

Then:
1. Write docs/PLAN.md: a short build plan that lists the 11 layout templates from the sitemap "template" field, the components each needs, the data flow from sitemap.json → routes → layouts → JSON-LD, and how placeholders are substituted. Ask me nothing you can answer from the docs.
2. Scaffold an Astro project (static output, TypeScript, Tailwind, MDX). Add a React integration for islands only.
3. Implement src/pages/[...slug].astro that generates one route per entry in docs/sitemap.json with a trailing slash, picks the layout by "template", and renders a stub body containing the H1, a visible list of required content blocks, and the links_to list. Every route must build.
4. Create src/styles/tokens.css with a neutral high-contrast palette, type scale, spacing, and radii as CSS variables. Nothing else in the project may hard-code a color.
5. Add npm scripts: dev, build, map (runs python3 build_map.py and copies outputs into docs/), qa (stub for now), links (stub for now).
6. Run npm run build. Report the route count. It must equal the number of pages in sitemap.json.

Commit as "feat: scaffold routes from sitemap".
```

### Prompt 2 — Layouts, schema, linking, breadcrumbs

```
Implement the real layouts and shared components per docs/topical-map.md Sections 4–11.

1. Layouts: home, core, pricing, service-hub, service-spoke, city, compare, guide, driver, partners, legal. Each renders the content blocks required for its template (Section 6.2 table in the old audit / the "content_blocks" field) as named slots with clear TODO markers where content is missing.
2. Header and footer exactly per Section 10 (header: Pricing, Services dropdown with the five hubs, How it works, Trust, Get the app; footer ≤ 12 links + NAP block + app badges; the /drive/ link appears only in the footer on rider pages; driver layout header has a single "For customers" link back to /).
3. Breadcrumbs component that mirrors the URL and emits BreadcrumbList.
4. src/lib/schema.ts that builds one JSON-LD @graph per page from the sitemap entry's "schema" array + placeholders, per Section 11. Organization @id https://boxhauls.com/#organization on every page. Never emit AggregateRating or Review.
5. A RelatedLinks component that picks 3–5 pages from the same cluster (never sitewide, never the homepage) and a BodyLinks helper that renders each links_to target inside a sentence with a descriptive anchor built from the target page's H1.
6. Canonical, meta title by the Section 4.1 formulas, meta description field, per-template OG image generated at build with the page title and brand.
7. Substitute placeholders from docs/placeholders.json at build time; any TODO value renders as a visible [TODO: key] span and is written to docs/TODO.md.

Run npm run build and open three pages of each template in the dev server to confirm structure. Commit as "feat: layouts, schema, linking".
```

### Prompt 3 — Technical spec and QA gate

```
Implement docs/topical-map.md Section 12 and make the QA gate real.

1. sitemap.xml generated from sitemap.json (indexable pages only, real lastmod). robots.txt allowing all, disallowing /auth, /account, /embed/, /api/, /book/, with the Sitemap line.
2. Redirect map from Section 12.1 as a platform config (vercel.json or Cloudflare _redirects — ask me which host once, then proceed). Include www → apex.
3. scripts/qa.mjs per CLAUDE.md: build, then for every Phase-1 route fetch the static HTML and assert: exactly one H1; JSON-LD parses and contains every type in the sitemap "schema" array; BreadcrumbList matches the path; every links_to target appears as an <a href> in the body; no unresolved {{…}}; banned phrases absent; canonical is absolute and self-referencing; the route is in sitemap.xml; the page is reachable within 3 clicks from / (build the click graph from the HTML). Print a table and exit non-zero on any failure. List TODO markers per page without failing.
4. scripts/links.mjs that crawls the built site for broken internal links.
5. A Lighthouse CI config with mobile budgets: LCP < 2.5s, INP < 200ms, CLS < 0.1.
6. Analytics stub (GA4) with the events in Section 12: price_shown, booking_started, booking_completed, driver_apply_started, driver_apply_completed, partner_apply.

Run npm run qa. Fix everything structural it catches. Commit as "chore: technical spec + qa gate".
```

### Prompt 4 — Phase 1 content

```
Write real content for every Phase-1 page (sitemap "phase": 1), following docs/topical-map.md Section 9 (content standards), Section 5 (pricing structure), Section 6 (service structure), Section 6.6 (city page), and Section 16 (Fresno addendum). Rules:

- First sentence of every page answers the primary query directly.
- Use only facts from docs/placeholders.json and Section 16. Anything not there (dump fees, store hours, insurance limits, dates) is a [TODO: …] marker, not a guess.
- Pricing pages: migrate the structure of the four existing cost pages (couch, mattress, refrigerator, washer/dryer) — answer, formula, 3/10/25-mile table, item attributes table, helper guidance, prep, 4–6 FAQs, book CTA. Do not copy Truck-N-Go copy verbatim; rewrite in BoxHauls voice.
- /cities/fresno/: write every required local block from Section 6.6 and Section 16 — American Avenue Disposal Site, CARTS, Operation Clean Up, retailer pickup lanes in the stated order, Fresno State peaks, Clovis section — with TODO markers for hours/fees. No template filler. No driver cards or reviews until real.
- /drive/ pages: earnings math uses {{DRIVER_SHARE}} and the tier fares; if TODO, show the formula with markers. Write the requirements, equipment, and safety pages fully — those need no unknown facts. Note summer heat guidance.
- Guides (Phase 1 only): will-it-fit table for 40 items with real L×W×H in inches (this is general knowledge, cite typical manufacturer ranges), how-to-move-a-couch, rent-vs-hire math, dump-fees-in-fresno and bulky-item-pickup-in-fresno with TODOs for current fees/schedule, facebook-marketplace guide, what-to-expect, damage guide. Each carries an author block ("BoxHauls team, reviewed by {{FOUNDER_NAME}}") until a named author exists.
- FAQs: question as H3 in the user's words, 2–4 sentence answers, mirrored exactly in FAQPage schema.
- Photos: insert [PHOTO: description] blocks where a real photo belongs. No stock.

Work cluster by cluster: core → pricing → services → city → drive → guides → legal. Commit after each cluster. Run npm run qa after every cluster and fix failures before moving on. When finished, update docs/TODO.md (grouped by page) and docs/PROGRESS.md.
```

### Prompt 5 — Booking island and launch check

```
1. Mount the booking widget as a React island on / and on every page's book CTA target (/book/?item=<slug>&tier=<tier>), pre-selecting item and tier from the query string. If the existing Lovable booking component is in ./legacy/, port only the address inputs, item picker, tier picker, and price display; show no price until both addresses are entered; remove any driver cards, ETAs, ratings, or revenue split from the rider flow. If no legacy code is present, build a UI stub with the same fields that calls a mock pricing function reading placeholders.json.
2. Add /es/ scaffolding for /drive/ pages only (Phase 2 will fill it): hreflang alternates between /drive/… and /es/drive/…; do not publish empty /es/ routes.
3. Final launch checklist in docs/LAUNCH.md: DNS cutover steps, Search Console verification for both domains, redirect test commands, GBP NAP string to match /contact/ exactly, list of every remaining TODO with the page it blocks.

Run npm run qa, npm run links, and Lighthouse. Report results. Commit as "feat: booking island + launch checklist".
```

---

## 3. After Phase 1 passes

Phase 2 is the same loop, one cluster at a time. Paste this with the cluster name changed:

```
Phase 2, cluster: <retailer spokes | marketplace spokes | remaining pricing | remaining service spokes | compare | guides batch N | partners | driver guides | es/drive>. Read the sitemap entries with phase 2 in that cluster, write them per Section 9 and the cluster's section in docs/topical-map.md, add real facts only from placeholders.json and Section 16, mark everything else TODO, run npm run qa, commit.
```

Retailer spokes go in the Section 16 order: Costco Clovis → Living Spaces → Home Depot Clovis → Costco Fresno → Lowe's → rest. Guides at two per week. Compare pages need dated facts — those require you to check each competitor's Fresno pricing and coverage the week you publish.

---

## 4. Things Claude Code will ask you that only John can answer

Answer these before Prompt 4 or expect TODO markers:

- Legal name, founder name, Clovis address, (559) phone, support email
- Tier names and the exact fare formula (base, per-mile, heavy-item fee, helper fee)
- Insurance carrier and coverage limits that can be published
- Background-check vendor
- Driver share percentage
- Hard weight limits (what a driver won't take without equipment)
- Hosting choice (Vercel or Cloudflare)
- Whether the Lovable booking component source can be exported into ./legacy/
- Social handles (register @boxhauls everywhere first)
