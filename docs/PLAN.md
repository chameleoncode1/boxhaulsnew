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

`src/styles/tokens.css` is the only place colors, type, spacing and radii are defined. It's a Tailwind v4 `@theme` block whose first line, `--color-*: initial`, removes Tailwind's built-in palette, so `bg-blue-500` doesn't exist and every color utility maps to a token. The neutral default palette passes WCAG AA, with every text pair at 7:1 or better. Fonts are the system stack until branding picks at most two self-hosted families.

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
- The driver side (`/drive/earnings/`, `/drive/requirements/`) explains that drivers who bring a helper can accept helper-requested jobs. How the $17 is split between driver and helper is **not known** and renders as a TODO until it's decided.

### Weight limits (decided 2026-10-02)

The heaviest single item is **1,000 lb** (`{{MAX_ITEM_WEIGHT}}`), and gun safes go up to **1,200 lb** (`{{MAX_SAFE_WEIGHT}}`). Both are in pounds. Anything heavier is referred out. /services/furniture-delivery/what-we-cant-move/ and /pricing/cost-to-move-a-gun-safe/ state both limits.

## Open questions (answer before the prompt that needs them)

1. **Helper fee split (needed before Prompt 4, driver pages).** Does the $17 go to the helper, the driver, or is it shared? Does `DRIVER_SHARE` (71%) apply to it?
2. **Hosting (needed before Prompt 3).** Vercel or Cloudflare Pages.
3. **Legacy booking component (needed before Prompt 5).** Can the Lovable component be exported into `./legacy/`?
4. **App store links.** `SOCIAL.app_store` and `SOCIAL.google_play` are TODO. Organization `sameAs` and /app/ will show markers until they're filled.
