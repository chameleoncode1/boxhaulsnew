# CLAUDE.md — BoxHauls website

You are building boxhauls.com, the marketing site for BoxHauls: an on-demand marketplace that sends a local pickup-truck owner to move large items between two addresses in Fresno/Clovis, CA, priced per trip with the price shown before booking.

## Source of truth (read these first, every session)
- `docs/topical-map.md` — every page, its primary query, H1, required content blocks, links, schema, template, and phase. Section 9 is the content checklist. Section 10 is the linking rules. Section 11 is the schema spec. Section 12 is the technical spec and redirect map. Section 16 is the Fresno launch addendum.
- `docs/sitemap.json` — the same page inventory as data. Routes are generated from this file. Never hand-create a route.
- `docs/placeholders.json` — resolved values for `{{PLACEHOLDERS}}`. Any value starting with `TODO` is unknown.

## Hard rules
1. **Do not add, rename, or remove pages** outside `docs/sitemap.json`. If a page is needed, add it to `build_map.py` (or `sitemap.json` if the generator isn't in the repo), regenerate, then build it. There are three exceptions, all noindex and all out of sitemap.xml. `/book/` (`src/pages/book.astro`) is app UI required by map Section 12, and robots.txt disallows it. `/drive/accept/` (`src/pages/drive/accept.astro`) is the driver job page linked from dispatch texts, also disallowed in robots.txt. `/404` (`src/pages/404.astro`) gives unknown URLs a real 404 status on Cloudflare Pages.
2. **Never invent facts.** Prices, fees, insurance carrier and limits, background-check vendor, driver share, addresses, phone numbers, tier specs, dump fees, store hours, dates. If the value is `TODO` in `placeholders.json`, render a visible `[TODO: …]` marker in the page and list it in `docs/TODO.md`. A page with a visible TODO cannot be marked shippable.
3. **No placeholder social proof.** No fake driver cards, ratings, haul counts, ETAs, testimonials, partner logos, or review counts. Empty states are correct until real data exists.
4. **Every indexable route must render complete HTML with JavaScript disabled**: H1, body content, internal links, JSON-LD, breadcrumbs. Verify with `curl` in the QA script, not by trusting the framework.
5. **One page, one primary query.** Do not create a page whose primary query already belongs to another page in `sitemap.json`.
6. **City pages are gated** (map Section 6.6). Only `/cities/fresno/` exists at launch. Do not generate city or neighborhood pages from a template, ever.
7. **Audience isolation** (map Section 2). Rider pages never link to `/drive/` in body copy. Driver pages never link to `/services/`. The driver payout percentage appears only under `/drive/`. Approved exceptions (2026-10-02), and the only ones: `/app/` → `/drive/`, `/cities/fresno/` → `/drive/fresno/`, `/trust/driver-vetting/` → `/drive/requirements/`, `/guides/how-to-tie-down-a-load-in-a-pickup/` → `/drive/equipment/`. They're listed in `AUDIENCE_EXCEPTIONS` in `src/lib/links.ts`; add new ones there only with the owner's approval.
8. **Banned phrases**: "logistics", "solution", "on-demand ecosystem", "cargo", "freight", "buddy with a truck", "friend with a truck", "too big for my car", "welcome to". Never mention Truck-N-Go, Lovable, or the old site in user-facing copy.
9. **Brand string** is exactly `BoxHauls` in copy and `boxhauls.com` for the domain. Never "Box Hauls", "Boxhauls", "BOXHAULS".
10. **Positioning** is "cheaper than a rental, safer than a stranger." Never premium, never "luxury", never "white glove".

## Stack and conventions
- Astro (static output) + TypeScript + Tailwind. React islands only for the booking widget and interactive pickers. No client-side routing.
- Routes are generated in `src/pages/[...slug].astro` from `docs/sitemap.json`; content per page lives in `src/content/pages/<url-as-path>.mdx` with frontmatter that mirrors the sitemap entry.
- One layout per `template` value in the sitemap: `home`, `core`, `pricing`, `service-hub`, `service-spoke`, `city`, `compare`, `guide`, `driver`, `partners`, `legal`.
- Design tokens live in `src/styles/tokens.css` only. Colors, type scale, radii, spacing. Every color reference is a token so the palette can be swapped in one file.
- **Brand** (decided 2026-10-02): red `#C8081A` / black / white, from the logo and banner. Display type is Saira 800 italic, uppercase (headings, CTAs, tagline); body is Inter. Both are self-hosted via `@fontsource`. Tagline: "Pick up. Deliver. Done." with "Deliver." in red. Use banner-style red/black slanted bands sparingly (hero photo frame, footer band). Logo sources are in `assets/brand-src/`; `npm run brand` regenerates `public/brand/` (wordmark, on-dark wordmark, truck mark, full logo, badge, favicons). The banner's truck photo is AI-generated and is never used on the site; real photography only.
- JSON-LD is assembled by `src/lib/schema.ts` from the sitemap entry + placeholders; one `@graph` per page; `Organization` `@id` is `https://boxhauls.com/#organization`.
- Internal links from `links_to` are rendered in body copy with descriptive anchors (Section 10), plus a per-page "Related" block of 3–5 links from the same cluster. Never a sitewide related-links block.
- URLs: lowercase, hyphenated, trailing slash. Canonical is self-referencing and absolute.
- Images: real photography only; AVIF/WebP; explicit width/height; lazy except the hero. Until real photos exist, use a neutral placeholder block labeled `[PHOTO: description]` — not stock, not AI.

## Commands
- `npm run dev` — local
- `npm run build` — static build; must pass with zero warnings
- `npm run map` — regenerate `docs/topical-map.md` and `docs/sitemap.json` from `build_map.py`
- `npm run qa` — builds, runs `astro check` (0 errors and 0 warnings required), then runs `scripts/qa.mjs`: for every Phase-1 route, checks H1 present and unique, JSON-LD parses and includes required types, breadcrumb matches path, every `links_to` target is linked in body, no unresolved `{{…}}`, TODO markers listed, no banned phrases, canonical correct, sitemap.xml includes it, no orphans. Fails the build if any Phase-1 page fails.
- `npm run links` — crawls the built site for broken internal links.
- `npm run qa -- --structural` — the same gate, failing only on structure (use while copy is still being written); `--no-build` reuses `dist/`.
- `npm run lighthouse` — Lighthouse CI mobile budgets (LCP < 2.5 s, CLS < 0.1, TBT < 200 ms) on one page per template.
- `npm run brand` — regenerate `public/brand/` from `assets/brand-src/`.
- `npm run deploy` — runs the QA gate, then deploys `dist/` to the Cloudflare Pages project `boxhaulsnew` (preview: https://boxhaulsnew.pages.dev, noindex). boxhauls.com is not attached yet; see `docs/LAUNCH.md`.
- `npm run build` also writes the Cloudflare files (`dist/_redirects`, `dist/_headers`, `deploy/cloudflare/bulk-redirects.csv`) and `docs/TODO.md`.

## Workflow
- Work in phases per map Section 13. Do not start Phase-2 pages until `npm run qa` passes for all of Phase 1.
- Commit per template or per cluster, not per page. Commit messages: `feat(pricing): couch page`, `chore(qa): …`, `content(city): fresno local blocks`.
- When you are unsure whether something is a fact or a guess, it is a guess. Mark it TODO.
- At the end of each session, update `docs/TODO.md` with every open TODO grouped by page and `docs/PROGRESS.md` with what shipped.
