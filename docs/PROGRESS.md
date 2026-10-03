# Progress

## Status (2026-10-03)

**Phase 1 is written. `npm run qa` passes all 67 launch pages, but none are shippable yet:** every page still shows at least one visible TODO marker. That's mainly the App Store and Google Play links in the footer, plus the facts listed below. `docs/TODO.md` has the full per-page list. It's regenerated on every build.

| Check | Result |
|---|---|
| `npm run qa` | PASS: 67 routes, 0 structure failures, 0 content pending |
| `npm run links` | 0 broken across 194 pages (`/book/` is reported as an app route until Prompt 5) |
| `npm run build` | 194 pages, 0 warnings |
| Type check | 0 errors |
| Lighthouse (mobile, stub pages) | LCP about 2.0 s, CLS about 0, TBT 0 ms, accessibility 1.00. Not re-run since the copy was written. |

## What shipped

| Prompt | What | Commit |
|---|---|---|
| 1 | Astro scaffold; one route per sitemap entry; design tokens | `82dada9` |
| 2 | 11 layouts, header and footer, breadcrumbs, JSON-LD, body and related links, OG images, TODO report | `f4d7d7e` |
| Brand | Red, black and white palette; logo assets; banner-style hero, header, footer and OG images | `256171e` |
| 3 | sitemap.xml, robots.txt, Cloudflare redirects and headers, QA gate, link crawler, Lighthouse CI, GA4 stub | `892e519`, `0ccb7db` |
| 4 | Content for all 67 Phase-1 pages, cluster by cluster: core, pricing, services, city, drive, guides, legal | `e2718b1` … `4d792e5` |

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
1. When is the card authorized, and when is it charged?
2. Same-day booking, scheduled windows, or both?
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

- **Prompt 5:** the booking island, `/es/` scaffolding for `/drive/`, and `docs/LAUNCH.md`. It needs an answer on whether the Lovable booking component can be exported into `./legacy/`.
- **Re-run Lighthouse** now that real copy exists.
- **Phase 2** waits until the Phase-1 TODO markers are cleared.
