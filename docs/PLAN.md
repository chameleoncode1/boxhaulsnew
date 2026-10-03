# BoxHauls build plan

Source of truth: `docs/topical-map.md`, `docs/sitemap.json`, `docs/placeholders.json`. This file says how the site turns those into HTML. It does not restate page content.

## Data flow

```
build_map.py ──npm run map──▶ docs/sitemap.json + docs/topical-map.md
                                     │
docs/placeholders.json ──▶ src/lib/placeholders.ts  (resolve {{KEY}})
                                     │
                              src/lib/sitemap.ts     (typed Page[], validated at build)
                                     │
                    src/pages/[...slug].astro        (getStaticPaths: one route per entry)
                                     │  picks layout by page.template
                    src/layouts/<Template>Layout.astro
                       │            │              │
             src/content/pages/   components    src/lib/schema.ts
             <url-as-path>.mdx    (header,       (one JSON-LD @graph per page,
             (Prompt 4 copy)      breadcrumbs,    from page.schema + placeholders)
                                  related, …)
```

- **Routes.** `[...slug].astro` is the only page file. Each sitemap entry becomes `dist/<url>/index.html`. `sitemap.ts` throws at build on an unknown template, a duplicate URL, a URL that isn't lowercase with a trailing slash, or a placeholder left in a URL. Route count must equal `pages.length` (194).
- **Content.** From Prompt 4, `src/content/pages/<url-as-path>.mdx` holds each page's copy. Its frontmatter mirrors the sitemap entry. The layout renders the MDX into the template's named slots. A page with no MDX yet renders the stub body (H1, required blocks, `links_to`).
- **Indexability.** Phase-1 pages are indexable. Phase-2 and 3 pages build so links and QA can see them, but emit `noindex` and stay out of `sitemap.xml` until they ship. This also keeps the gated `/cities/fresno/clovis/` page (map Section 6.6, Phase 3) out of the index.
- **Audience.** `page.audience` comes from the URL (`/drive/` means driver, `/partners/` means partner, anything else means rider). It decides header and footer, not the template. Driver guides use the `guide` template but get the driver chrome and must never link to `/services/` (map Section 2).

## Placeholder substitution

`resolve(text)` in `src/lib/placeholders.ts` replaces every `{{KEY}}`; dotted keys such as `SOCIAL.instagram` reach nested values.

- A known value is substituted.
- A missing value, or one that starts with `TODO`, becomes the literal `[TODO: KEY]`, and the key is recorded on the page (`page.todos`). `<Text>` renders each marker as a visible `.todo` span. Prompt 2 writes the collected keys to `docs/TODO.md`, and QA lists them per page.
- `resolveStrict()` is used for URLs and `links_to`. It throws instead of emitting a marker, so a broken URL can never ship.
- The map writes `{{DRIVER_SHARE}}%`, but the value already carries `%`, so the doubled sign is collapsed.

## Templates and components

Every layout wraps `BaseLayout` (head, canonical, robots, OG, JSON-LD slot, header/footer by audience, breadcrumbs). Shared components: `SiteHeader` (rider) / `DriverHeader`, `SiteFooter`, `Breadcrumbs` (+ `BreadcrumbList`), `BodyLinks`, `RelatedLinks` (3–5 links from the same cluster, never sitewide), `Faq` (H3 questions, mirrored into `FAQPage`), `BookCta` (`/book/?item=&tier=`), `Text` (TODO markers), `PhotoPlaceholder` (`[PHOTO: …]`), `ReviewedBy` / `AuthorBlock`, `FactsChecked` ("Prices checked {month year}").

| Template | Pages | Template-specific components |
|---|---|---|
| `home` | 1 | `BookingWidget` island (no price until both addresses), launch-metro line, `TrustBadges` (insured / background-checked / upfront price), `ReviewsModule` (empty state), `HowItWorksSteps` (3), `ServiceTiles` (5 hubs), `AppBadges`. Schema: Organization, WebSite. |
| `core` | 16 | Generic prose page with optional `Steps` (HowTo), `TierTable`, `FeeTable`, `PriceExamples` (3/10/25 mi), `PricingLinkGrid`, `NapBlock` (/contact/), `CityCards` + waitlist (/cities/). Covers /pricing/, /trust/*, /about/, /contact/, /app/, /faq/, /reviews/. |
| `pricing` | 29 | Fixed 7-part order (map Section 5): `PriceAnswer` (range in sentence one), `Formula`, `DistanceTable` (3/10/25 mi), `ItemAttributesTable` (L × W × H in, lb range, tier, helper, prep), price drivers, `Faq` (4–6), `BookCta` with item preselected. `FactsChecked` + `ReviewedBy`. Service + Offer/PriceSpecification. |
| `service-hub` | 5 | Definition sentence, who uses it, what's included, `TierFitTable`, price example, `TrustStrip`, `SpokeList` (every spoke, structured), 2–3 pricing links, `Faq`. Service + Offer. |
| `service-spoke` | 51 | Scenario copy, link up to its hub within the first 200 words, attribute block (store pickup lane, platform rule, appliance prep), price example, `Faq`. Sub-hubs (store-pickup, marketplace-pickup) add `SpokeList`. Service. |
| `city` | 2 | Human-written local blocks only (Section 6.6/16): `LocalDisposalSites` (address/hours/fees), `RetailerPickupNotes` (Section 16 order), bulky-item rules, campus dates, corridors, `CoverageMap`; driver profiles, reviews and trip-price table render as empty states until real. LocalBusiness/MovingCompany. |
| `compare` | 13 | `CompareTable` (8 criteria, fixed order), where each wins, verdict by use case, sources with dates. /compare/ index = verdict list + master table. |
| `guide` | 52 | `AuthorBlock` (Person), answer-first intro, tables, exactly one inward core link, `Faq`. /guides/ index groups by cluster. Article + Person (+ HowTo for how-tos). |
| `driver` | 14 | Driver header ("For customers" → /), `EarningsMath` (`{{DRIVER_SHARE}}` + tier fares), requirements list, `ApplyCta`. JobPosting on /drive/ and /drive/fresno/. Never links to `/services/`. |
| `partners` | 8 | Checkout-flow explainer, what the customer pays, `PartnerLogos` (real only; empty state), `PartnerApply` form. May link to /pricing/ and /trust/. |
| `legal` | 3 | Plain text, dated, BreadcrumbList only. Linked from footer with `rel="nofollow"`. |

## Styling

`src/styles/tokens.css` is the only place colors, type, spacing and radii are defined. It's a Tailwind v4 `@theme` block whose first line, `--color-*: initial`, removes Tailwind's built-in palette, so every color utility maps to a token.

**Brand (decided 2026-10-02):** taken from the logo and banner files in `assets/brand-src/`.

- **Colors:** brand red `#C8081A` (sampled from the logo), black `#0D0D0D`, white.
  - Red on white is 6.0:1. Red on black is only 3.2:1, so red on dark backgrounds is for display text and graphics; small red text there uses `brand-on-night` (`#FF4D5A`, 6.0:1).
- **Type:** Saira 800 italic, uppercase, for H1/H2, CTAs and the tagline (the closest open font to the logo's lettering). Inter for body text. Both self-hosted with `font-display: swap`.
- **Motifs from the banner:**
  - Home H1: the first sentence in black, the second in red.
  - "Pick up. Deliver. Done." tagline with red rules on each side.
  - Red-circle icons for the three trust facts.
  - A slanted black frame with a red offset around the hero photo slot.
  - A red/black slanted band across the top of the footer.
- **Headers:** white rider header with a red top rule; black driver header with the white wordmark, so drivers can tell which section they're in.
- **Footer:** black.
- **Assets:** `npm run brand` cuts web assets from the two source files: the wordmark (light and dark), the truck mark, the full logo (also the Organization `logo` in JSON-LD), a dark badge, and favicons from the BH monogram.
- **Not used:** the banner's truck photo is AI-generated, so it's never used (CLAUDE.md: real photography only). `03_31_42` is skipped because its background is a baked-in checkerboard, not real transparency.

## Stack notes

- Astro 7.3 (static, `trailingSlash: 'always'`, `build.format: 'directory'`), MDX, React 19 (islands only), Tailwind 4.3 via `@tailwindcss/vite`.
- TypeScript is pinned to 6.x because `astro check` doesn't support TS 7 yet.
- Node is installed at `~/.local/node` (no Homebrew on this machine).

## Decisions

### Helpers (decided 2026-10-02)

A second helper is an optional **$17** add-on (`{{HELPER_FEE}}`). It is available only when the matched driver brings a helper and accepts a job that requests one. **BoxHauls does not guarantee a helper** (`{{HELPER_POLICY}}`). Content rules for Prompt 4:

- Keep the map's "with and without helper" columns in distance tables. The with-helper column is the base price + $17, and a footnote under the table says helpers depend on driver availability.
- Never write "helper included", "two-person crew guaranteed" or "we'll send two people". Say "request a helper" and "if a driver with a helper accepts".
- For items the map marks "helper required" or "two-person" (refrigerator, washer/dryer, sectional, treadmill, gun safe, hot tub), tell the customer the job needs a helper request. If no driver with a helper accepts, the customer must have a second person ready to help load. The booking flow should say this before checkout. That's a Prompt 5 note, and the Q&A belongs in the FAQ on those pages.
- /pricing/fees/ lists the helper line as "$17, when available".
- /guides/when-you-need-a-second-helper/ (Phase 2) owns the "do I need a helper" question. Other pages link there rather than re-explaining.
- **Fee split (decided 2026-10-02).** The $17 is added to the trip's final price, and the driver's `{{DRIVER_SHARE}}` applies to the whole total, helper fee included. Drivers pay their helper themselves; BoxHauls never pays helpers.
  - Driver pages only (`/drive/earnings/`, `/drive/requirements/`, `/drive/how-payouts-work/`, `/drive/faq/`): drivers who bring a helper can accept helper-requested jobs; the helper fee raises the fare their share is calculated on (71% of $17 = $12.07 per job); paying the helper, and any tax or contractor obligations that come with it, is the driver's responsibility.
  - Rider pages show only "$17 for a helper, when available". They never mention the driver share, who pays the helper, or how the fee is split (CLAUDE.md rule 7).

### Weight limits (decided 2026-10-02)

The heaviest single item is **1,000 lb** (`{{MAX_ITEM_WEIGHT}}`), and gun safes go up to **1,200 lb** (`{{MAX_SAFE_WEIGHT}}`). Both are in pounds. Anything heavier is referred out. /services/furniture-delivery/what-we-cant-move/ and /pricing/cost-to-move-a-gun-safe/ state both limits.

### Prompt 2 implementation choices

- **Blocks.** Each layout renders its template's blocks in a fixed order. A block holds copy passed through a named slot, or a visible `[TODO: write — …]` marker when there is none. Each page also shows the sitemap's spec in a collapsed box until it's written.
- **Schema waits for copy.** FAQPage, HowTo, Article and JobPosting are emitted only when their copy exists (FAQ items, steps, publish date, posting date). Until then they are missing from the graph, which makes Prompt 3's QA fail the page. That's intended: an unwritten page isn't shippable. Organization, the founder Person, and a WebPage node are on every page.
- **Offer.** Built from the real formula: a $17 base `UnitPriceSpecification` plus $3.10 per statute mile (`SMI`). No price ranges until the pricing copy computes them.
- **Left out of the schema until real:** LocalBusiness `geo`, `openingHours`, `priceRange` and a radius `GeoCircle` (needs coordinates), and JobPosting `baseSalary`.
- **Linking.** `BodyLinks` writes each `links_to` target as a sentence anchored on the target's H1. The sentences are placeholders and Prompt 4 prose replaces them. A target that breaks audience isolation is **not** linked; it renders a `[TODO: spec — …]` marker. `RelatedLinks` and the hub child lists only link indexable pages from indexable pages.
- **Breadcrumbs** skip path segments that have no page: `/services/`, `/legal/`, `/drive/guides/`, `/drive/compare/`.
- **Legal links** sit in the footer's small-print row with `rel="nofollow"`, outside the 12-link nav. Rider footers show Terms and Privacy; driver footers also show the Driver agreement.
- **OG images.** 1200×630 PNG per page at `/og/<slug>.png`, rendered at build with Satori + resvg and Inter (self-hosted from `@fontsource/inter`). Colors are read from `tokens.css`. No item silhouette yet, since there are no assets.
- **docs/TODO.md** is regenerated after every `npm run build` by `scripts/todo.mjs`, from the markers in the built HTML.

### Decided 2026-10-02 (round 2)

- **Audience exceptions.** Four rider → driver body links are allowed: /app/ → /drive/, /cities/fresno/ → /drive/fresno/, /trust/driver-vetting/ → /drive/requirements/, /guides/how-to-tie-down-a-load-in-a-pickup/ → /drive/equipment/. They live in `AUDIENCE_EXCEPTIONS` (`src/lib/links.ts`), and CLAUDE.md rule 7 lists them.
- **Phase changes.** `/guides/` and `/services/business-hauling/` moved to Phase 1 because both are linked sitewide. Phase 1 is now 67 pages.
- **Deferred links.** Any other `links_to` target that isn't live yet is held back on live pages and starts rendering when its phase ships, so the spec keeps the full link graph. docs/TODO.md lists the held links; they don't block launch.
  - **Thin at launch:** the store-pickup and marketplace-pickup sub-hubs have no retailer or platform links until those Phase-2 spokes ship. Their launch copy must stand on its own: how store and marketplace pickup works, with the store and platform names in prose.
- **Spanish.** Support covers English and Spanish (`SUPPORT_LANGUAGES: "en, es"`), so ContactPoint `availableLanguage` is `["en", "es"]`.
- **"What we can't move".** Vehicles are dropped from the list (there's no vehicle limit to state).
- **Hosting.** Cloudflare, where the site is already hosted. Prompt 3 writes Cloudflare `_redirects` and `_headers` files.

### Prompt 3 implementation notes

- **sitemap.xml** lists the 67 indexable pages. `lastmod` is the last git commit of the page's MDX file and is left out until that file exists, so there are no invented dates. **robots.txt** follows Section 12. Phase-2 stubs are deliberately *not* disallowed, so crawlers can see their noindex tag.
- **Cloudflare.** `scripts/cloudflare.mjs` runs after every build and writes three files:
  - `dist/_redirects`: 29 path-only rules that can't shadow a real route.
  - `dist/_headers`: noindex on app routes, plus cache and security headers.
  - `deploy/cloudflare/bulk-redirects.csv`: 54 rules for truck-n-go.com → boxhauls.com and www → apex.
  - `_redirects` can't match hostnames, so the cross-domain rules need Bulk Redirects. They're uploaded once by hand; steps are in `deploy/cloudflare/README.md`.
- **QA gate** (`npm run qa`). It builds, serves `dist/` like Cloudflare does, and `curl`s every Phase-1 route.
  - Failures are either STRUCTURE (code or spec) or CONTENT (waits on copy). `--structural` checks only the plumbing.
  - I verified it by injecting faults: a duplicate H1, a banned word, a misspelled brand, a missing canonical, a missing body link, and an unresolved placeholder. Every one was caught.
- **Banned-word exceptions** (`ALLOWED` in `scripts/qa.mjs`). The map itself needs two words that CLAUDE.md rule 8 bans:
  - "cargo", only in insurance terms: the `COVERAGE_LIMIT` value, "cargo insurance", "cargo coverage", "cargo and liability", "cargo vs. liability".
  - "not freight", only on /about/, because Section 1 requires saying what BoxHauls isn't.
- **Links crawler** (`npm run links`) checks every internal href, src, srcset and og:image across all 194 pages. `/book/` is reported as an app route, not a failure, until Prompt 5 builds it.
- **Lighthouse CI** (`npm run lighthouse`) runs mobile budgets on one page per template: LCP < 2.5 s, CLS < 0.1, TBT < 200 ms as the lab stand-in for INP, and accessibility and SEO ≥ 0.95.
  - Measured on the stub pages: LCP about 2.0 s, CLS about 0.00, TBT 0 ms, accessibility 1.00.
  - SEO is 0.92 only because meta descriptions don't exist yet (content).
  - Preloading the Saira display font took CLS from 0.05 to 0.
- **Analytics.** `bhTrack()` accepts only the six Section 12 events.
  - Two fire from CTAs today: `booking_started` on pricing CTAs and `driver_apply_started` on driver CTAs.
  - The booking island (Prompt 5) and the apply forms will fire `price_shown`, `booking_completed`, `driver_apply_completed` and `partner_apply`.
  - gtag.js loads only once `GA4_MEASUREMENT_ID` is set.

### Decided 2026-10-03

- **Banned-word exceptions are approved:** "cargo" only in insurance terms, and "not freight" only on /about/ (the `ALLOWED` list in `scripts/qa.mjs`).
- **GA4.** Keep the stub until there's a measurement ID. The privacy policy must disclose analytics cookies before it goes live.
- **Unmapped truck-n-go.com paths** redirect to the boxhauls.com homepage. The catch-all is its own Bulk Redirect list, ordered last, so exact paths and sections always win (`deploy/cloudflare/README.md`).

### Prompt 5 implementation notes

- **Booking widget** (`src/components/BookingWidget.tsx`). It's a React island on `/` (in the hero, above the fold) and on `/book/`, hydrated with `client:idle`. The form is server-rendered, so it's visible without JavaScript.
  - **Preselect:** item and job type come from `?item=<slug>&tier=<slug>`. Item slugs are in `src/lib/items.ts`; tier slugs come from the tier names (`movin-boxes`, `dump-run`, `large-item-pick-up`).
  - **Price:** none until both addresses are entered. The breakdown and total come from `src/lib/pricing.ts`.
  - **Stub:** there's no `./legacy/` component, no routing and no booking API, so the trip distance is a labeled demo slider with a visible TODO, and submitting shows a TODO instead of booking.
  - **Events:** `price_shown` fires once when the price first appears, and `booking_started` fires on submit. `booking_completed` waits for the booking API.
  - **Never shown:** driver cards, ETAs, ratings or the payout split.
- **`/book/`** is the one route outside `sitemap.json` (CLAUDE.md rule 1 exception). It uses `AppLayout`, with noindex, no JSON-LD and no canonical. It's already disallowed in robots.txt, and `_headers` sends X-Robots-Tag noindex.
- **Spanish scaffolding** (`src/lib/i18n.ts`). hreflang en/es/x-default appears only when both `/drive/<path>/` and `/es/drive/<path>/` are pages in the sitemap.
  - Spanish pages get `lang="es"` and driver chrome.
  - QA checks that every hreflang target exists and links back.
  - No `/es/` routes exist yet. The steps to add them are in the `i18n.ts` header.
- **QA now type-checks.** `npm run qa` fails on any `astro check` error or warning. An earlier `tail`-truncated check had hidden 4 type errors from Prompt 4; they're fixed.
- **Performance.** Footer logos load lazily, and the wordmarks were cut to 440 px lossless WebP.
  - Content pages: LCP about 1.8 s.
  - Home and `/book/`: about 2.4 s, because React's roughly 66 KB runtime is on the critical path.
  - If home needs more headroom later, switch the island to Preact (`@astrojs/preact` with compat), which saves about 55 KB.
- **docs/LAUNCH.md** is the cutover runbook. Its section 7, the Phase-1 TODOs and the pages they block, is rewritten by `scripts/todo.mjs` on every build.

## Open questions (answer before the prompt that needs them)

1. **Booking backend.** No `./legacy/` component was provided, so the widget is a stub. To make booking real, the stub needs a routing or distance API (trip miles from two addresses) and the booking API, or the Lovable component exported into `./legacy/` for porting.
2. **App store links.** `SOCIAL.app_store` and `SOCIAL.google_play` are TODO. Organization `sameAs` and /app/ will show markers until they're filled.
3. **GA4 measurement ID.** `GA4_MEASUREMENT_ID` is TODO. No Google script loads until it's set (format `G-XXXXXXX`). Before turning it on, the privacy policy (/legal/privacy/) has to disclose analytics cookies; California's CCPA applies.
4. **Bulk Redirects upload.** Someone with access to the Cloudflare account imports the three CSVs and orders the rules 1 → 3 (steps in `deploy/cloudflare/README.md`). It's on the Prompt 5 launch checklist.
