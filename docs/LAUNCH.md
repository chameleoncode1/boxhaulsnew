# Launch checklist: boxhauls.com

Work top to bottom. Don't cut over until section 1 is all checked.

## 1. Gate: the site is shippable

- [ ] `npm run qa` passes. It currently does: 67 routes, 0 failures.
- [ ] `npm run links` reports 0 broken links. It currently does.
- [ ] `npm run lighthouse` passes the mobile budgets. It currently does.
- [ ] **Zero visible TODO markers on Phase-1 pages.** Not yet: see section 7. CLAUDE.md rule 2 says a page with a visible TODO can't ship.
- [ ] Real photos replace every `[PHOTO: …]` block on Phase-1 pages, at minimum the home hero and the city page.
- [ ] Counsel has reviewed and supplied the terms, privacy policy and driver agreement.
- [ ] Booking is live with auto-dispatch. Work through `deploy/cloudflare/README.md` → "Booking backend":
  - a Google Maps key
  - a Twilio number with **A2P 10DLC or toll-free verification approved**
  - `bash scripts/setup-secrets.sh`
  - drivers added with `npm run drivers -- add …`
  - `npm run deploy` and `npm run deploy:cron`
- [ ] An end-to-end test with a real driver phone: book a trip, the driver gets a text, accepts, then the customer gets a text. Then a second test where nobody accepts: the customer gets the "no driver" text.
- [ ] `PUBLIC_SITE_URL` switched to `https://boxhauls.com` in both wrangler configs at cutover.
- [ ] A WAF rate-limiting rule on `/api/*`, and a Google budget alert plus quotas.
- [ ] Confirm `SERVICE_CENTER`, `BOOKING_WINDOWS`, `BOOKING_DAYS_AHEAD` and the dispatch deadlines in `docs/placeholders.json`.
- [ ] The driver agreement covers job texts, and sharing the driver's first name and phone with the customer.
- [ ] The privacy policy covers booking data (name, phone, email and addresses, stored in D1), sharing the customer's name, phone and addresses with the assigned driver, and texts sent through Twilio.
- [ ] If GA4 is turned on, set `GA4_MEASUREMENT_ID` and update the privacy policy to disclose analytics cookies first.

## 2. Deploy to Cloudflare

The site is already hosted on Cloudflare. Deploy the new build to the Cloudflare project that serves boxhauls.com.

1. **Build settings:** build command `npm run build`, output directory `dist`, and environment variable `NODE_VERSION=24`.
2. Push or upload, then open the **preview URL** Cloudflare gives you. Before going further, check:
   - Home, pricing, the city page and `/drive/` render.
   - `/book/?item=couch` preselects the couch.
   - `/sitemap.xml` lists 67 URLs.
   - `/robots.txt` has the Sitemap line.
3. Confirm `_redirects` and `_headers` deployed. On the preview URL these should both return a 301 or a header:

   ```bash
   curl -sI https://<preview-url>/cost-to-move-a-couch | grep -i '^location'
   ```

   ```bash
   curl -sI https://<preview-url>/book/ | grep -i '^x-robots-tag'
   ```

4. **Promote to production** on boxhauls.com. Keep the previous deployment so you can roll back with one click.

## 3. DNS and domains

1. `boxhauls.com` is the production custom domain on the Cloudflare project.
2. `www.boxhauls.com` has a proxied (orange-cloud) DNS record. It redirects to the apex through Bulk Redirects (next step).
3. `truck-n-go.com` (and `www.`) need proxied DNS records on Cloudflare, so Bulk Redirects can catch the requests. Keep the domain registered and redirecting for **at least 12 months**.
4. Upload the three Bulk Redirect lists and create the rules in order 1 → 2 → 3. Steps are in `deploy/cloudflare/README.md`.

## 4. Verify the redirects

Run after DNS and Bulk Redirects are live. Each line prints the `Location` header; the expected value is in the comment.

```bash
curl -sI https://www.boxhauls.com/pricing/ | grep -i '^location'              # https://boxhauls.com/pricing/
curl -sI https://truck-n-go.com/ | grep -i '^location'                          # https://boxhauls.com/
curl -sI https://truck-n-go.com/pricing | grep -i '^location'                   # https://boxhauls.com/pricing/
curl -sI https://truck-n-go.com/cost-to-move-a-couch | grep -i '^location'      # https://boxhauls.com/pricing/cost-to-move-a-couch/
curl -sI https://truck-n-go.com/services/junk-hauling | grep -i '^location'     # https://boxhauls.com/services/junk-removal/
curl -sI https://truck-n-go.com/cities/fresno | grep -i '^location'             # https://boxhauls.com/cities/fresno/  (exact beats section)
curl -sI https://truck-n-go.com/cities/london | grep -i '^location'             # https://boxhauls.com/cities/
curl -sI https://truck-n-go.com/blog/any-post | grep -i '^location'             # https://boxhauls.com/guides/
curl -sI https://truck-n-go.com/anything-else | grep -i '^location'             # https://boxhauls.com/  (catch-all)
curl -sI https://boxhauls.com/link-to-us | grep -i '^location'                  # /press/  (_redirects on the new site)
```

To check every mapped path at once:

```bash
cut -d, -f1,2 deploy/cloudflare/bulk-redirects-1-exact.csv | while IFS=, read src dst; do got=$(curl -s -o /dev/null -w '%{redirect_url}' "https://$src"); [ "$got" = "$dst" ] && echo "ok   $src" || echo "FAIL $src → $got (want $dst)"; done
```

## 5. Search Console and Bing

1. **Google Search Console:** add **Domain properties** for `boxhauls.com` and `truck-n-go.com`. Verify each with the DNS TXT record Google gives you, added in Cloudflare DNS.
2. In the boxhauls.com property, submit `https://boxhauls.com/sitemap.xml`.
3. In the truck-n-go.com property, run **Settings → Change of address**, pointing to boxhauls.com. This only works once both are verified and the 301s from section 4 are live.
4. Use **URL Inspection** on `/`, `/pricing/`, `/cities/fresno/` and `/pricing/cost-to-move-a-couch/`, then request indexing.
5. **Bing Webmaster Tools:** import both properties from Search Console, then submit the sitemap.
6. Watch **Core Web Vitals** in Search Console for real INP. Lighthouse can only use TBT as a stand-in.

## 6. Google Business Profile

The NAP must match `/contact/`, the site footer and every citation exactly:

| Field | Value (from `docs/placeholders.json`) |
|---|---|
| Business name | BoxHauls |
| Legal name (footer, /contact/) | BoxHauls, LLC |
| Address | 3690 E. International, Clovis, CA 93619 |
| Phone | (559) 628-2794 |
| Website | https://boxhauls.com/ |

- Set it up as a **service-area business** covering Fresno and Clovis (25 miles). If the Clovis address is residential, hide it, as map Section 16 says.
- Once GBP is verified, put its review link on `/reviews/`. It's a TODO there now.
- If any of these values change, change them in `docs/placeholders.json` first. The site updates on the next build; then update GBP to match.

## 7. Remaining TODOs, by the page they block

Generated from the built site by `scripts/todo.mjs` on every build. Phase-1 pages only; see `docs/TODO.md` for everything.

<!-- TODO:START -->

67 of 67 Phase-1 pages are blocked by visible TODO markers.

**On nearly every page:** `SOCIAL.app_store` (175 pages, in the footer), `SOCIAL.google_play` (175 pages, in the footer).

| Page | Blocked by |
|---|---|
| /about/ | founding year |
| /app/ | confirm the other in-app features: tracking, messaging, receipts, ratings; QR code linking to the app stores |
| /cities/ | waitlist form for other cities |
| /cities/fresno/ | hours; gate fees; street addresses for both sites; pickup-area location and loading notes for each store; current Operation Clean Up schedule and exclusions, and the Clovis program; this year’s move-in and move-out dates for each campus; the apartment corridors with the most move-ins and move-outs, written from local knowledge; real driver profiles with photos, once drivers agree to be featured; coverage map; which site drivers use for which loads; pickup-area notes for each store |
| /contact/ | support hours; confirm in-app chat or messaging with support |
| /drive/ | how jobs are offered to drivers in the app, and how long a driver has to accept; a real driver’s story, once a driver agrees to share it; minimum model year and any bed-length requirement |
| /drive/apply/ | driver application form or app download link; truck and document verification step; onboarding or app walkthrough; typical approval timeline; typical approval timeline, including the background check; whether drivers pay for the background check |
| /drive/earnings/ | realistic hourly ranges from real Fresno trip data; busiest days and hours from real trip data; current IRS standard mileage rate |
| /drive/equipment/ | confirm required minimum gear for BoxHauls drivers |
| /drive/faq/ | how drivers go online and offline in the app; whether declining jobs affects a driver's standing; driver ratings and the threshold for staying active; whether a helper can drive the truck on a job; customer no-show policy for drivers and any wait compensation |
| /drive/fresno/ | busiest zones and hours from real trip data; how drivers pay the gate fee and get reimbursed; hours and accepted materials at each site; pickup-area notes for each store; real earnings examples from Fresno trips |
| /drive/how-payouts-work/ | payout schedule: weekly day and cutoff; whether instant payout is available and its fee; any payout or processing fees drivers pay; confirm tips are paid on the same schedule; which year-end form drivers receive (1099-NEC or 1099-K) and the threshold; payout schedule; which form (1099-NEC or 1099-K) and the threshold |
| /drive/insurance-and-liability/ | confirm; confirm: driver’s own auto policy; occupational accident coverage, if any; when the policy applies: from job acceptance, from arrival at pickup, or only while loaded; when the policy applies to drivers (accepted, en route, loaded) and what it covers for the driver; driver responsibility, deductibles and the claim process for drivers |
| /drive/requirements/ | minimum model year, bed length and condition standards; license class and driving-record standard; minimum driver age; minimum coverage amounts; confirm minimum gear counts; whether helpers need their own background check; onboarding steps: truck inspection, document upload, app training; minimum coverage amounts drivers must carry |
| /drive/safety/ | driver safety support line and in-app reporting; how drivers decline or report a job in the app |
| /faq/ | ride-along policy; whether someone must be present at both ends; confirm drivers don't assemble furniture or connect appliances; business accounts and invoicing |
| /guides/bulky-item-pickup-in-fresno/ | current Operation Clean Up schedule and how to find your area’s date; set-out rules: when, where, and how much; Operation Clean Up accepted items; Operation Clean Up exclusions; Clovis bulky-item program details; current schedule and how to find your area's date |
| /guides/dump-fees-in-fresno/ | current gate fees at both sites, dated; address; hours; minimum fee; fee; accepted? fee?; “facts checked” date once fees are verified; which site takes which materials; Fresno-area household hazardous waste site and each site’s accepted-materials rules; current gate fees at American Avenue Disposal Site and CARTS, dated; each site's accepted-materials rules |
| /guides/renting-a-truck-vs-hiring-a-truck-and-driver/ | current Fresno rental rates, dated and sourced; current per-mile rental charge, dated and sourced |
| /guides/what-to-do-if-an-item-is-damaged/ | BoxHauls reporting deadline |
| /guides/what-to-expect-from-a-boxhauls-driver/ | confirm in-app tracking during the trip; whether drivers bring items inside, and how far; confirm drivers don’t assemble furniture or connect appliances; confirm drivers don't assemble furniture or connect appliances |
| /guides/will-it-fit-in-a-pickup-bed/ | heavy fee for mini fridges? |
| /how-it-works/ | confirm in-app messaging and live tracking during the trip; free-cancellation window and late-cancel fee; how customers pay after the haul |
| /legal/driver-agreement/ | driver agreement text, reviewed by California counsel, including contractor classification, consent to job texts, and sharing the driver’s first name and phone with the customer |
| /legal/privacy/ | privacy policy text, reviewed by California counsel, including CCPA/CPRA rights, booking data (name, phone, email and addresses, stored with Cloudflare; addresses looked up with Google Maps; shared with the assigned driver; texts sent through Twilio), and the analytics cookies used once GA4 is enabled |
| /legal/terms/ | terms of service text, reviewed by California counsel |
| /press/ | founding year; founder bio, one or two sentences |
| /pricing/ | first-haul promo terms, or remove this section if there is no promotion |
| /pricing/cost-of-a-dump-run/ | which site drivers use for which loads; hours; gate fee; confirm tires, electronics and appliances with refrigerant against the sites’ rules; current gate fees at American Avenue Disposal Site and Cedar Avenue Recycling and Transfer Station; confirm the full not-accepted list against the disposal sites' rules; whether drivers drop usable items at donation centers on the same trip |
| /pricing/cost-to-move-a-refrigerator/ | whether the heavy-item fee applies per item or per trip; confirm drivers don’t disconnect or connect water lines; confirm drivers don't connect water lines or install appliances |
| /pricing/cost-to-move-a-washer-and-dryer/ | whether the heavy-item fee applies to each machine or once per trip; confirm drivers don't connect water, drain, gas or power |
| /pricing/fees/ | per item or per trip; how the dump fee is shown and charged: on the receipt after the trip, or estimated before booking; late-cancel fee amount; confirm whether the fee is per item or per trip; cancellation window and late-cancel fee |
| /pricing/truck-sizes/ | whether customers can request a long bed |
| /reviews/ | Google Business Profile review link |
| /services/appliance-delivery/ | confirm drivers don’t connect or disconnect water, gas, drain or power lines; confirm drivers don't connect water, gas, drain or power |
| /services/appliance-delivery/haul-away/ | confirm California requirements and where drivers take refrigerant appliances; recycling fees at the sites drivers use; current utility or city appliance recycling rebate programs in Fresno; confirm California requirements and where drivers take these units |
| /services/appliance-delivery/refrigerator/ | whether drivers remove and reinstall refrigerator doors |
| /services/appliance-delivery/washer-and-dryer/ | whether the heavy-item fee applies to each machine or once per trip |
| /services/business-hauling/ | business accounts, invoicing and payment terms; whether recurring or scheduled runs are available; confirm pallet handling and weight limits |
| /services/furniture-delivery/ | whether drivers bring items inside, and how far; whether the customer must be present or authorize the pickup with the store; confirm whether drivers bring items inside and how far (for example, to the first room) |
| /services/furniture-delivery/marketplace-pickup/ | whether drivers can carry payment to the seller, or the buyer pays the seller directly; seller no-show policy and what the buyer is charged; whether the buyer must be present at pickup; what the driver will and won’t inspect at pickup; what the driver will and won't inspect at pickup |
| /services/furniture-delivery/mattress-delivery/ | whether drivers bring mattress bags or the customer provides one |
| /services/furniture-delivery/store-pickup/ | whether the customer must be present or authorize the pickup with the store; pickup-area location and notes for each store; confirm the store-pickup authorization process |
| /services/furniture-delivery/what-we-cant-move/ | whether drivers take upright pianos; Fresno-area household hazardous waste site; whether hot tub removal or relocation is offered |
| /services/junk-removal/ | confirm the full not-accepted list against the disposal sites’ rules; whether drivers drop usable items at donation centers on the same trip; gate fees; confirm the full not-accepted list against the disposal sites' rules |
| /services/junk-removal/couch-disposal/ | whether drivers drop items at donation centers; current Operation Clean Up schedule, what’s excluded, and the Clovis program; current Operation Clean Up schedule and what's excluded |
| /services/junk-removal/dump-runs/ | which site drivers use for which loads, plus hours; how the dump fee is shown and charged; which site drivers use for which loads |
| /services/junk-removal/garage-cleanout/ | Fresno-area household hazardous waste site; how multi-load cleanouts are priced and booked |
| /services/junk-removal/mattress-disposal/ | nearest participating drop-off site in Fresno and its rules; whether disposal or recycling sites require bagged mattresses; disposal or recycling fees drivers pay, passed through at cost |
| /services/small-moves/ | how multi-trip moves are priced and booked, and whether two drivers can be booked at once; how multi-trip moves are priced and booked |
| /services/small-moves/dorm-move/ | this year’s Fresno State move-in and move-out dates; campus loading-zone and parking rules for move days; whether mini fridges get the heavy-item fee; this year's Fresno State move-in and move-out dates |
| /services/small-moves/one-bedroom-move/ | how a second trip is priced and booked; whether two drivers can be booked for the same move; how a second trip is priced |
| /services/small-moves/storage-unit-move/ | how multi-trip storage moves are priced and booked; whether the customer must be present or can share the gate code and unit access |
| /services/small-moves/studio-apartment-move/ | how a second trip is priced and booked; how a second trip is priced |
| /trust/ | support hours; reporting window and typical resolution time |
| /trust/cancellation-and-refunds/ | free-cancellation window; late-cancel fee; driver no-show policy; weather policy; policy when the driver arrives and the job can’t be done; refund timing and method; free-cancellation window and late-cancel fee; driver no-show policy and what the customer gets; refund timing |
| /trust/damage-claims/ | reporting deadline after drop-off; who decides the claim and how long review takes; typical resolution window and how payment is made; deductible, if any |
| /trust/driver-vetting/ | which records the check covers; provider for the driving-record check; how trucks are inspected; minimum auto coverage drivers must carry; confirm the exact list of checks run; re-check cadence and the rating threshold drivers must keep; re-check cadence; rating threshold for staying active |
| /trust/insurance/ | confirm when coverage starts and ends; cargo coverage limit from the policy; liability coverage limit from the policy; policy exclusions, e.g. items packed by the customer, pre-existing damage, cash, jewelry, documents; how to declare high-value items before booking and whether extra coverage can be added; how to declare high-value items and whether added coverage is available |

<!-- TODO:END -->
