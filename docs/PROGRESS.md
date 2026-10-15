# Progress

## Status (2026-10-03)

**Phase 1 is written. `npm run qa` passes all 67 launch pages, but none are shippable yet:** every page still shows at least one visible TODO marker. That's mainly the App Store and Google Play links in the footer, plus the facts listed below. `docs/TODO.md` has the full per-page list. It's regenerated on every build.

| Check | Result |
|---|---|
| `npm run qa` | PASS: 67 routes, 0 structure failures, 0 content pending |
| `npm run links` | 0 broken across 194 pages (`/book/` is reported as an app route until Prompt 5) |
| `npm run build` | 195 pages (194 + `/book/`), 0 warnings |
| Type check | 0 errors, 0 warnings. Now part of `npm run qa`. A truncated earlier check had hidden 4 Prompt-4 type errors; they're fixed. |
| Lighthouse (mobile) | Every budget passes. Content pages: LCP about 1.8 s. Home and /book/: about 2.4 s (React island). TBT 0 ms, accessibility 1.00, SEO 1.00 (except /book/, which is noindex by design). CLS is at most 0.09 on /cities/fresno/. |

## boxhauls.com cutover (2026-10-15)

- boxhauls.com now serves the new site, from the Pages project `boxhaulsnew`. The old `boxhauls` Worker is still deployed but has no domain attached. `api.boxhauls.com` (the `boxhauls-api` Worker) was not touched. `bash scripts/cutover.sh rollback` reattaches the old site.
- www.boxhauls.com and boxhaulsnew.pages.dev redirect (301) to the same path on boxhauls.com. `/api/*` is exempt, so Stripe webhooks and links in already-sent texts keep working.
- `PUBLIC_SITE_URL` is `https://boxhauls.com` for the Pages project and the dispatch cron.
- Checked live:
  - The home page renders with a self-referencing canonical, no noindex, and the sitemap is in robots.txt.
  - The service worker is active and the manifest returns 200.
  - Address search works.
  - www and pages.dev redirect correctly.
  - POSTs to `/api/stripe-webhook` on pages.dev aren't redirected.
- Still open:
  - The production Stripe and Twilio secrets aren't set (only the Google, quote and email secrets are), so online payment and texts don't work on the live site yet. Run `bash scripts/setup-secrets.sh` when ready.
  - Point the Stripe webhook at `https://boxhauls.com/api/stripe-webhook`.
  - Search Console, Bulk Redirects for truck-n-go.com, and Google Business Profile: see `docs/LAUNCH.md` sections 3–6.

## Design pass, mobile layout and installable app (2026-10-15)

- **Installable app (PWA):** web app manifest (`/manifest.webmanifest`, opens at `/book/`), a service worker (`public/sw.js`: page requests try the network first, `/api/` is never cached, plus an offline notice), and maskable icons. Every "Download app now" button is a link to `/app/`. With JavaScript it shows the browser's install prompt on Android, Chrome and Edge, or Add to Home Screen steps on iPhone and iPad. Once the app is installed, the button says it's already installed. App Store and Google Play badges show only when their URLs are set; the TODO markers for them now appear on `/app/` only.
- **Design:**
  - Sticky header: on desktop, the nav plus "Download app now" and "Get a price"; on phones, "Get a price" plus a menu button.
  - Homepage: full-width dark hero with the booking widget, step cards, five service tiles with icons, and an app band.
  - Inner pages: a header band holding breadcrumbs, the H1 and the byline, and a sticky "See your price" card on wide screens.
  - Child and related links show as cards, and FAQs as an accordion (every answer is still in the HTML).
  - Rider pages end with a light "Get a price" band. On phones, a "Get a price / Get app" bar is fixed to the bottom of rider pages.
- **Speed:** the logo is now served as PNG, which is smaller than the WebP here, and an early 192 px icon download was removed. Lighthouse mobile budgets pass: home LCP 1.4–2.4 s, `/book/` 2.48 s (close to the 2.5 s limit).
- Copy fix: "insured by Hiscox Inc.." no longer shows a double period.

## Payment tests (2026-10-15, Stripe test mode, local)

All 8 paths passed against real Stripe test mode, with exact amounts verified in Stripe:

1. **Booking:** a $34.67 hold through the real widget and Payment Element (test card 4242).
2. **Cancel within 5 minutes:** hold released, $0 charged.
3. **Completed trip:** $34.67 charged; the driver's $24.62 share (71%) recorded.
4. **Cancel after acceptance:** $17.34 charged (50%); the driver's $12.31 share (71% of the fee) recorded.
5. **Late cancel, no driver:** $17.34 charged, kept by BoxHauls.
6. **Dump run:** $34.67 + a $42 fee = $76.67 charged; the driver gets $66.62. A fee above the $50 hold was rejected.
7. **Driver cancel:** hold released, $0 charged.
8. **No driver accepts:** the cron released the hold and texted the customer.

**Not yet tested:** a driver payout actually landing. Stripe Connect isn't enabled on the account yet, so test payouts went to the "failed, retry" path, which also worked. Enable Connect, onboard one test driver through `/drive/payouts/`, and rerun test 3.

## What shipped

| Prompt | What | Commit |
|---|---|---|
| 1 | Astro scaffold; one route per sitemap entry; design tokens | `82dada9` |
| 2 | 11 layouts, header and footer, breadcrumbs, JSON-LD, body and related links, OG images, TODO report | `f4d7d7e` |
| Brand | Red, black and white palette; logo assets; banner-style hero, header, footer and OG images | `256171e` |
| 3 | sitemap.xml, robots.txt, Cloudflare redirects and headers, QA gate, link crawler, Lighthouse CI, GA4 stub | `892e519`, `0ccb7db` |
| 4 | Content for all 67 Phase-1 pages, cluster by cluster: core, pricing, services, city, drive, guides, legal | `e2718b1` … `4d792e5` |
| 5 | Booking widget stub on `/` and `/book/`, `/es/` hreflang scaffolding, `docs/LAUNCH.md`, type check inside QA | see git log |

## How the copy stays honest

- Every price is computed from `docs/placeholders.json` (`<Price>`, `<PriceTable>`, `{{price:…}}`), so changing the fare formula updates every page.
- Facts come from `placeholders.json` and map Section 16 only. Anything else renders as a visible `[TODO: …]` marker.
- Dimensions and weights in the fit tables are typical manufacturer ranges, and the pages say so.
- Earnings tables are computed from `DRIVER_SHARE` and refuse to build outside `/drive/`. QA fails if the payout share appears on a rider page.
- No reviews, driver profiles, ratings, trip counts or partner logos. Those spots show empty states.
- The legal pages are shells waiting for counsel; none of their legal text was invented.

## Open questions, by theme

Answering one question clears it on every page that asks it. The most-referenced ones come first.

**Booking and the trip**
1. Payment is decided: card authorized at request and charged on completion. Still open: tips, the driver no-show and driver-cancel policy, the weather policy, and the dump-fee hold buffer ($60 default).
2. Confirm the booking time windows (8 AM–6 PM in two-hour slots, up to 14 days ahead) and the service-area center (downtown Fresno).
3. Do drivers bring items inside, and how far (for example, to the first room)?
4. Confirm drivers don't assemble furniture or connect water, gas, drain or power.
5. Does a customer have to be present at pickup and drop-off? (Store pickups, Marketplace sellers, storage units.) How does store-pickup authorization work?
6. In-app tracking, messaging, receipts and ratings: which exist?
7. Ride-alongs: allowed?

**Pricing details**

8. Does the $29 heavy-item fee apply per item or per trip? This matters for a washer *and* dryer.
9. Do mini fridges get the heavy-item fee?
10. How is a second trip priced and booked for multi-load moves, and can two drivers be booked at once?
11. How is the dump fee shown and charged: estimated up front, or added after the trip?
12. Is there a first-haul promotion?

**Cancellations and claims**

13. Free-cancellation window, late-cancel fee, driver no-show policy, weather policy, and the "job can't be done on arrival" policy.
14. Refund timing and method.
15. Damage claims: the reporting deadline, who decides, typical resolution time, and any deductible.
16. Insurance: when coverage starts and ends, the separate cargo coverage and liability coverage limits, exclusions, and how to declare high-value items.

**Driver vetting and onboarding**

17. The exact Checkr reports run, the driving-record check, the truck inspection, and re-check cadence.
18. Minimum truck year, bed length, driver age, license class, and auto-insurance minimums.
19. Do helpers need their own background check? Can a helper drive?
20. Payout schedule, instant payout and its fee, and which 1099 form drivers get.
21. The driver application link, onboarding steps, and approval timeline.
22. Rating threshold, and whether declining jobs affects standing.

**Local facts (Fresno and Clovis)**

23. American Avenue Disposal Site and CARTS: addresses, hours, gate fees, accepted materials, and which site drivers use for which loads.
24. Operation Clean Up's schedule and exclusions, and the Clovis bulky-item program.
25. Pickup-area notes for Costco Clovis, Living Spaces, Home Depot Clovis, Costco Fresno and Lowe's.
26. This year's Fresno State, Clovis Community College and Fresno City College move dates, and campus loading rules.
27. Apartment corridors with the most moves.
28. The nearest Fresno-area household hazardous waste drop-off and mattress recycling site.

**Company and app**

29. Founding year and a one-line founder bio.
30. Support hours, and whether there's in-app support chat.
31. App Store and Google Play links, the QR code, and the Google review link.
32. Upright pianos and hot tub removal: offered or not?
33. Donation drop-offs on junk runs: yes or no?
34. Business accounts, invoicing, and recurring runs.

**Needs counsel**

35. Terms of service, privacy policy (including CCPA/CPRA and GA4 cookies), and the driver agreement.

## Next

- **Booking go-live:**
  - Built: real quotes (live on the preview with the Google key since 2026-10-14), auto-dispatch by text, and Uber-style Stripe payments.
  - Still needed:
    - Stripe: Connect, webhook and keys. Test mode first, and `bash scripts/dev-stripe-keys.sh` for a local end-to-end test.
    - A registered Twilio number.
    - Drivers added, each finishing payout setup.
    - Then `npm run deploy` and `npm run deploy:cron`.
- **Work through `docs/LAUNCH.md`** once the Phase-1 TODOs are cleared.
- **Watch CLS on /cities/fresno/** (0.09, close to the 0.1 budget). It will move when real photos replace the placeholders.
- **Phase 2** waits until the Phase-1 TODO markers are cleared.
