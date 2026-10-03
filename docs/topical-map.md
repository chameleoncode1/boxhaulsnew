# BoxHauls — Topical Map & Site Build Specification

**Brand:** BoxHauls  ·  **Domain:** boxhauls.com  ·  **Version:** 1.0  ·  **Prepared by:** Chris Szetela  ·  **Date:** August 25, 2026

This file is the single source of truth for the BoxHauls website. It defines what the business *is* to a search engine, every page the site will have, what each page must contain, how pages link, what structured data each carries, and the order to build them in. It is written to be dropped into a repository (`/docs/topical-map.md`) and read by Claude Code or any developer. A machine-readable version of the page inventory is in `sitemap.json`.

**Totals:** 194 pages across 9 sections — cities: 2, compare: 13, core: 17, drive: 19, guides: 47, legal: 3, partners: 8, pricing: 29, services: 56. By phase — Phase 1 (launch): 67 · Phase 2 (weeks 7–13): 117 · Phase 3 (month 4+): 10.

---

## 0. How to use this file

1. Replace every `{{PLACEHOLDER}}` (Section 14) before generating any page. Do not build a page whose placeholders are unresolved.
2. Build in phase order (Section 13). Phase 1 is the launch set; nothing in Phase 2 or 3 ships before every Phase 1 page passes the content checklist (Section 9).
3. Every page in this map has a **primary query** (the one search it exists to win), an **H1**, **content blocks** it must contain, **links it must make**, and **schema** it must carry. Treat those as acceptance criteria.
4. Do not add pages that are not in this map without adding them to this map first. Do not create a page whose primary query already belongs to another page.
5. City pages and neighborhood pages are gated (Section 6). No city page is generated from a template. Ever.

### Suggested Claude Code prompt

```
Read /docs/topical-map.md and /docs/sitemap.json. Scaffold an Astro (or Next.js) site with static
generation that produces every Phase 1 URL in sitemap.json as a route, using the template named in
each page's "template" field. Each route must render server-side HTML containing the page's H1, the
content blocks listed, the internal links listed, the JSON-LD types listed, and a BreadcrumbList that
reflects the URL hierarchy. Generate robots.txt, sitemap.xml, and the redirect map in Section 12.
Do not invent content for placeholders; render them as visible TODO markers until replaced.
```

---

## 1. Entity definition

| Element | Definition |
|---|---|
| Brand name | BoxHauls (one word, capital B, capital H; never "Box Hauls" or "Boxhauls" in copy) |
| Legal entity | {{LEGAL_NAME}} |
| Domain | boxhauls.com (all lowercase in copy: boxhauls.com) |
| Central entity | An on-demand marketplace that dispatches a local pickup-truck owner to move one or a few large items between two addresses, priced per trip, with the price shown before booking. |
| Central search intent | "Get a truck and driver to move [large item] from A to B today, with the price up front." |
| Entity type (schema) | Organization (sitewide) + LocalBusiness/MovingCompany (real city pages only) + Service/Offer (service and pricing pages) |
| What BoxHauls is **not** | Not freight or LTL shipping. Not long-distance moving. Not dumpster rental. Not rideshare. Not a truck rental company. Not a labor-only mover. Say this on /about/ and never let content drift into those categories. |
| Positioning line | One truck. One trip. One price. |
| Secondary lines | "A truck, a driver, and a price — before you book." · "Doesn't fit in your car? It fits in ours." |
| Launch market | {{METRO}} only. Additional metros are added to this map when driver density is confirmed. |

### 1.1 Entity attributes (what Google must be able to read about BoxHauls)

| Attribute | Values | Where it lives |
|---|---|---|
| Services | furniture & large-item delivery · small moves · appliance delivery & haul-away · junk removal & dump runs · business & jobsite hauling | /services/ hubs, Service schema |
| Vehicle tiers | {{TIER_1}} (SUV / small bed) · {{TIER_2}} (standard half-ton, 5.5–6.5 ft bed) · {{TIER_3}} (3/4-ton, long bed, or trailer) | /pricing/truck-sizes/, tier picker, Offer schema |
| Pricing model | {{BASE_FARE}} base + {{PER_MILE}}/mile + item and helper fees; no hourly; no surge | /pricing/, /pricing/fees/, Offer.priceSpecification |
| Add-ons | helper ({{HELPER_FEE}}) · heavy item ({{HEAVY_FEE}}) · stairs · wait time · dump fee pass-through | /pricing/fees/ |
| Trust | cargo insurance ({{INSURANCE_CARRIER}}, {{COVERAGE_LIMIT}}) · background checks ({{BACKGROUND_PROVIDER}}) · vehicle inspection · damage-claim process · cancellation window | /trust/ cluster |
| Coverage | {{METRO}} metro; service radius {{RADIUS}} miles | /cities/{{metro-slug}}/, LocalBusiness.areaServed |
| Booking channels | iOS app · Android app · web | /app/, MobileApplication schema |
| Driver share | {{DRIVER_SHARE}}% of fare + 100% of tips | /drive/ only — never on rider pages |
| Founder | {{FOUNDER_NAME}} | /about/, Person schema |
| NAP | {{LEGAL_NAME}} · {{ADDRESS}} · {{PHONE}} — identical string on /contact/, footer, GBP, all citations | footer, /contact/, Organization schema |

---

## 2. Source contexts (three audiences, three sections, no crossover)

| Context | Who | What they search | Section | Cross-links allowed |
|---|---|---|---|---|
| Rider | Someone with an item, two addresses, and a time constraint | item + delivery/move/cost, store + delivery, service + city | /, /pricing/, /services/, /cities/, /compare/, /guides/, /trust/ | One link to /drive/ in the footer. Never in body. |
| Driver | Pickup-truck owner who wants paid work | make money with truck, hauling gigs, requirements, taxes | /drive/ | One link back to / in header. Driver pages never link to rider service pages. |
| Partner / Business | Store, supplier, or property manager who needs deliveries or wants to offer them | delivery partner, last mile, jobsite delivery | /partners/, /services/business-hauling/ | Links to /pricing/ and /trust/ allowed. |

Rationale: Google models a page's audience from its links and vocabulary. A page that talks to riders and drivers at once is a page for nobody. The current site's homepage shows the driver's 82% cut to customers; that is the mistake this rule prevents.

---

## 3. Site architecture

```
/
  about/
  app/
  cities/
    {{metro-slug}}/
      {{neighborhood-slug}}/
  compare/
    boxhauls-vs-borrowing-a-friends-truck/
    boxhauls-vs-bungii/
    boxhauls-vs-curri/
    boxhauls-vs-dolly/
    boxhauls-vs-goshare/
    boxhauls-vs-hiring-movers/
    boxhauls-vs-home-depot-truck-rental/
    boxhauls-vs-lugg/
    boxhauls-vs-store-delivery/
    boxhauls-vs-taskrabbit/
    boxhauls-vs-truck-it/
    boxhauls-vs-uhaul-truck-rental/
  contact/
  drive/
    apply/
    best-trucks-for-hauling-gigs/
    compare/
      boxhauls-vs-goshare-vs-lugg-vs-dolly-for-drivers/
    earnings/
    equipment/
    faq/
    guides/
      handling-a-customer-no-show/
      how-to-load-a-refrigerator-alone/
      how-to-strap-a-couch-in-a-pickup/
      is-hauling-worth-it-for-my-truck/
      tax-deductions-for-gig-haulers/
    how-payouts-work/
    insurance-and-liability/
    ratings-and-tips/
    requirements/
    safety/
    taxes/
    {{metro-slug}}/
  faq/
  guides/
    apartment-turnover-in-48-hours/
    bulky-item-pickup-in-{{metro-slug}}/
    college-move-in-{{metro-slug}}/
    college-move-out-week/
    delivery-insurance-explained/
    dump-fees-in-{{metro-slug}}/
    estate-cleanout-in-one-weekend/
    getting-lumber-home-from-home-depot/
    holiday-furniture-delivery-tips/
    how-costco-warehouse-pickup-works/
    how-much-to-tip-a-truck-driver/
    how-much-weight-can-a-pickup-carry/
    how-to-disassemble-a-bed-frame/
    how-to-get-a-couch-up-stairs/
    how-to-get-a-facebook-marketplace-purchase-home/
    how-to-inspect-used-furniture-before-buying/
    how-to-load-a-pickup-bed/
    how-to-move-a-couch-without-a-truck/
    how-to-move-a-mattress-without-getting-it-dirty/
    how-to-move-a-refrigerator/
    how-to-move-a-washer-and-dryer/
    how-to-pay-safely-on-marketplace-pickups/
    how-to-prep-appliances-for-transport/
    how-to-tie-down-a-load-in-a-pickup/
    how-to-wrap-furniture-for-a-truck/
    ikea-flat-pack-vs-assembled/
    is-it-worth-hiring-delivery-for-one-item/
    mattress-in-a-box-vs-traditional-delivery/
    mattress-recycling-in-{{metro-slug}}/
    movers-vs-truck-and-driver-for-a-studio/
    moving-out-of-a-dorm-in-one-trip/
    pickup-truck-bed-sizes-explained/
    renting-a-truck-vs-hiring-a-truck-and-driver/
    spring-cleanout-checklist/
    storage-unit-run-in-one-trip/
    what-to-do-if-an-item-is-damaged/
    what-to-do-when-a-marketplace-seller-no-shows/
    what-to-expect-from-a-boxhauls-driver/
    when-you-need-a-second-helper/
    where-to-donate-furniture-in-{{metro-slug}}/
    will-4x8-plywood-fit-in-a-pickup/
    will-a-king-mattress-fit-in-a-pickup/
    will-a-refrigerator-fit-in-a-pickup/
    will-a-sectional-fit-in-a-pickup/
    will-a-washer-fit-in-a-pickup/
    will-it-fit-in-a-pickup-bed/
  how-it-works/
  legal/
    driver-agreement/
    privacy/
    terms/
  partners/
    apply/
    directory/
    for-appliance-dealers/
    for-contractors-and-suppliers/
    for-furniture-stores/
    for-property-managers/
    for-thrift-stores/
  press/
  pricing/
    cost-of-a-dump-run/
    cost-to-deliver-a-kayak/
    cost-to-deliver-a-pallet/
    cost-to-deliver-patio-furniture/
    cost-to-deliver-plywood-and-lumber/
    cost-to-haul-a-motorcycle/
    cost-to-move-a-bed-frame/
    cost-to-move-a-couch/
    cost-to-move-a-desk/
    cost-to-move-a-dining-table/
    cost-to-move-a-dishwasher/
    cost-to-move-a-dresser/
    cost-to-move-a-grill/
    cost-to-move-a-gun-safe/
    cost-to-move-a-hot-tub/
    cost-to-move-a-mattress/
    cost-to-move-a-one-bedroom-apartment/
    cost-to-move-a-piano/
    cost-to-move-a-refrigerator/
    cost-to-move-a-sectional/
    cost-to-move-a-storage-unit/
    cost-to-move-a-stove/
    cost-to-move-a-studio-apartment/
    cost-to-move-a-treadmill/
    cost-to-move-a-tv/
    cost-to-move-a-washer-and-dryer/
    cost-to-move-an-exercise-bike/
    fees/
    pickup-truck-delivery-cost/
    truck-and-driver-hourly-vs-per-trip/
    truck-sizes/
  reviews/
  services/
    appliance-delivery/
      dishwasher-and-range/
      freezer/
      haul-away/
      refrigerator/
      washer-and-dryer/
      water-heater/
    business-hauling/
      jobsite-material-runs/
      pallet-and-bulk-pickup/
      property-manager-turnovers/
      restaurant-and-office-equipment/
      retail-last-mile/
    furniture-delivery/
      couch-delivery/
      estate-sale-pickup/
      marketplace-pickup/
        craigslist/
        facebook-marketplace/
        nextdoor/
        offerup/
      mattress-delivery/
      single-item-delivery/
      store-pickup/
        ashley-furniture/
        big-lots/
        costco/
        home-depot/
        ikea/
        living-spaces/
        lowes/
        mattress-firm/
        target/
        walmart/
      thrift-store-pickup/
      what-we-cant-move/
    junk-removal/
      construction-debris-removal/
      couch-disposal/
      dump-runs/
      e-waste-and-electronics/
      estate-cleanout/
      furniture-donation-pickup/
      garage-cleanout/
      hot-tub-removal/
      mattress-disposal/
      yard-waste-removal/
    small-moves/
      dorm-move/
      in-building-move/
      last-minute-move/
      one-bedroom-move/
      senior-downsizing-move/
      small-office-move/
      storage-unit-move/
      studio-apartment-move/
  trust/
    cancellation-and-refunds/
    damage-claims/
    driver-vetting/
    insurance/
```

Hierarchy rules: every URL has a trailing slash; every page has a BreadcrumbList that matches its path; no page is more than four levels deep; pricing pages live under /pricing/ (the current site has them at root — they move, with 301s).

---

## 4. Core section

The pages that capture booking intent or answer a trust question directly. All Phase 1.

| URL | H1 | Primary query | Content blocks / attributes |
|---|---|---|---|
| / | A truck and driver, on demand. Price shown before you book. | truck and driver near me | Booking widget above the fold (pickup, dropoff, item picker, tier, live price only after both addresses); one-line launch-metro statement; three trust badges (insured / background-checked / upfront price); real reviews module; 3-step how-it-works; five service tiles; app download; single driver CTA in footer. No placeholder driver cards, ETAs, or ratings. |
| /how-it-works/ | How BoxHauls works | how does boxhauls work | Numbered steps with real app screenshots: enter addresses → pick item/tier → see price → match driver → track → load/unload → pay → rate. Payment hold explained. Messaging. Cancellation window. Link to driver side once. |
| /pricing/ | BoxHauls pricing: what a truck and driver costs | how much does a truck and driver cost | Formula stated in one sentence ({{BASE_FARE}} + {{PER_MILE}}/mi + item/helper fees); tier table with bed length, payload, what fits; every fee listed (heavy item {{HEAVY_FEE}}, helper {{HELPER_FEE}}, stairs, wait time); worked examples at 3 / 10 / 25 miles; first-haul promo terms; link grid to every item-cost page; FAQ (6–8). |
| /pricing/truck-sizes/ | Truck sizes: which BoxHauls tier fits your stuff | what size truck do I need to move a couch | One section per tier ({{TIER_1}} / {{TIER_2}} / {{TIER_3}}): bed length, width between wheel wells, payload, typical vehicles, what fits (with item silhouettes to scale), what does not, price difference. This is the fleet-attributes page for the whole entity. |
| /pricing/fees/ | Every BoxHauls fee, explained | boxhauls fees | Table of every possible line item with trigger and amount; what is never charged (no surge, no fuel surcharge if true); how tips work; how dump fees are passed through. |
| /trust/ | Trust & safety: insurance, driver vetting, and what happens if something breaks | is boxhauls safe | Plain-language overview with links into the four sub-pages; insurance carrier and limits stated; vetting steps listed; support hours and channels; link to reviews. |
| /trust/insurance/ | How your items are insured during a BoxHauls haul | is my furniture insured during delivery | Who carries the policy ({{INSURANCE_CARRIER}}), coverage limits, what is excluded, how to declare high-value items, difference between cargo and liability. |
| /trust/driver-vetting/ | How BoxHauls checks drivers and trucks | are boxhauls drivers background checked | Each check listed with provider ({{BACKGROUND_PROVIDER}}): identity, license, driving record, criminal background, vehicle inspection, insurance verification; re-check cadence; rating threshold for staying active. |
| /trust/damage-claims/ | What happens if something is damaged | what if my furniture is damaged during delivery | Step-by-step claim process with timeline, photo requirements, who pays, typical resolution window. |
| /trust/cancellation-and-refunds/ | Cancellation and refund policy | boxhauls cancellation policy | Free-cancellation window, late-cancel fee, driver no-show policy, weather policy, refund timing. |
| /about/ | About BoxHauls | who owns boxhauls | Founder with real name and photo; legal entity ({{LEGAL_NAME}}); headquarters ({{ADDRESS}}); founding year; what BoxHauls is in one sentence and what it is not (not freight, not long-distance moving, not dumpster rental, not rideshare). Disambiguation paragraph. |
| /contact/ | Contact BoxHauls | boxhauls phone number | One phone ({{PHONE}}), one email, one address, hours, in-app chat note. NAP block identical to GBP. |
| /press/ | Press & media kit | boxhauls press | Boilerplate, facts sheet (founded, HQ, service area = real metros only), logo files, founder bio, contact. |
| /faq/ | BoxHauls FAQ | boxhauls faq | Only questions not owned by another page; each answer is 2–3 sentences and links to the page that covers it in depth. Grouped: booking, pricing, safety, drivers, business. |
| /reviews/ | BoxHauls reviews | boxhauls reviews | Real reviews only, pulled from Google; rating summary; filter by service; link to leave a review. Empty state acceptable at launch. |
| /app/ | Get the BoxHauls app | boxhauls app | Store badges, screenshots, feature list, QR code, driver app link. |
| /cities/ | Where BoxHauls operates | boxhauls service area | Real metros only. One card per live city. Waitlist form for others. Never claims 'anywhere'. |

### 4.1 Title tag formulas

| Template | Title formula (≤ 60 chars where possible) |
|---|---|
| home | BoxHauls: Truck & Driver On Demand in {{METRO}} |
| core | {H1} \| BoxHauls |
| pricing | How Much Does It Cost to Move a {Item}? ({{YEAR}}) \| BoxHauls |
| service-hub | {Service} in {{METRO}}: Truck & Driver On Demand \| BoxHauls |
| service-spoke | {Spoke} in {{METRO}} \| BoxHauls |
| city | Truck & Driver On Demand in {{METRO}} \| BoxHauls |
| compare | BoxHauls vs. {Competitor}: Price, Coverage, Insurance ({{YEAR}}) |
| guide | {H1} \| BoxHauls Guides |
| driver | {H1} \| Drive for BoxHauls |

Meta descriptions: 140–155 chars, state the answer or the price range, no "welcome to", no keyword lists.

---

## 5. Pricing cluster

The strongest content on the current site is the four "cost to move a ___" pages. This cluster scales that pattern. Every page follows the identical structure so the cluster reads as one authoritative source:

1. First sentence: the price range for the launch metro ("Most couch moves in {{METRO}} cost $X–$Y.").
2. The formula, restated.
3. Distance table: 3 mi / 10 mi / 25 mi with and without helper.
4. Item attributes table: dimensions, weight range, tier fit, helper required?, prep needed.
5. What drives the price up or down for this specific item.
6. 4–6 FAQs, question-first.
7. Book CTA with the item pre-selected.

| URL | Primary query | Content blocks / attributes | Phase |
|---|---|---|---|
| /pricing/cost-to-move-a-couch/ | cost to move a couch | Answer with price range in sentence one; formula; distance table (3/10/25 mi); item attributes: Length 72–96 in, 100–200 lb, one helper recommended, {{TIER_2}}; helper guidance; what to prep; 4–6 FAQs; book CTA. Status: migrate. | 1 |
| /pricing/cost-to-move-a-sectional/ | cost to move a sectional sofa | Answer with price range in sentence one; formula; distance table (3/10/25 mi); item attributes: 2–5 pieces, 250–450 lb total, helper required, {{TIER_2}}/{{TIER_3}}; helper guidance; what to prep; 4–6 FAQs; book CTA. Status: new. | 2 |
| /pricing/cost-to-move-a-mattress/ | cost to move a mattress | Answer with price range in sentence one; formula; distance table (3/10/25 mi); item attributes: Twin–king dimensions table, 50–150 lb, bag recommended, {{TIER_1}}/{{TIER_2}}; helper guidance; what to prep; 4–6 FAQs; book CTA. Status: migrate. | 1 |
| /pricing/cost-to-move-a-bed-frame/ | cost to move a bed frame | Answer with price range in sentence one; formula; distance table (3/10/25 mi); item attributes: Disassembly notes, headboard sizes, {{TIER_2}}; helper guidance; what to prep; 4–6 FAQs; book CTA. Status: new. | 2 |
| /pricing/cost-to-move-a-dresser/ | cost to move a dresser | Answer with price range in sentence one; formula; distance table (3/10/25 mi); item attributes: Drawers out or taped, 100–250 lb, helper for stairs; helper guidance; what to prep; 4–6 FAQs; book CTA. Status: new. | 2 |
| /pricing/cost-to-move-a-dining-table/ | cost to move a dining table | Answer with price range in sentence one; formula; distance table (3/10/25 mi); item attributes: Leg removal, glass tops, chairs count, {{TIER_2}}; helper guidance; what to prep; 4–6 FAQs; book CTA. Status: new. | 2 |
| /pricing/cost-to-move-a-desk/ | cost to move a desk | Answer with price range in sentence one; formula; distance table (3/10/25 mi); item attributes: L-desks, standing desks, disassembly; helper guidance; what to prep; 4–6 FAQs; book CTA. Status: new. | 2 |
| /pricing/cost-to-move-a-refrigerator/ | cost to move a refrigerator | Answer with price range in sentence one; formula; distance table (3/10/25 mi); item attributes: Upright transport only, 200–350 lb, two-person, defrost 24h, {{TIER_2}}/{{TIER_3}}; helper guidance; what to prep; 4–6 FAQs; book CTA. Status: migrate. | 1 |
| /pricing/cost-to-move-a-washer-and-dryer/ | cost to move a washer and dryer | Answer with price range in sentence one; formula; distance table (3/10/25 mi); item attributes: Shipping bolts, 150–250 lb each, two-person; helper guidance; what to prep; 4–6 FAQs; book CTA. Status: migrate. | 1 |
| /pricing/cost-to-move-a-dishwasher/ | cost to move a dishwasher | Answer with price range in sentence one; formula; distance table (3/10/25 mi); item attributes: Disconnect required, 75–125 lb; helper guidance; what to prep; 4–6 FAQs; book CTA. Status: new. | 2 |
| /pricing/cost-to-move-a-stove/ | cost to move a stove | Answer with price range in sentence one; formula; distance table (3/10/25 mi); item attributes: Gas disconnect by licensed pro, 150–250 lb; helper guidance; what to prep; 4–6 FAQs; book CTA. Status: new. | 2 |
| /pricing/cost-to-move-a-treadmill/ | cost to move a treadmill | Answer with price range in sentence one; formula; distance table (3/10/25 mi); item attributes: Fold vs non-fold, 200–350 lb, helper required; helper guidance; what to prep; 4–6 FAQs; book CTA. Status: new. | 2 |
| /pricing/cost-to-move-a-gun-safe/ | cost to move a gun safe | Answer with price range in sentence one; formula; distance table (3/10/25 mi); item attributes: Weight tiers 300/600/1000 lb, stair limits, {{TIER_3}} + helper; refer out above {{MAX_SAFE_WEIGHT}} lb; helper guidance; what to prep; 4–6 FAQs; book CTA. Status: new. | 2 |
| /pricing/cost-to-move-a-piano/ | cost to move a piano | Answer with price range in sentence one; formula; distance table (3/10/25 mi); item attributes: Honest limit page: uprights only if drivers can; grands referred to specialists. Sets entity boundary.; helper guidance; what to prep; 4–6 FAQs; book CTA. Status: new. | 2 |
| /pricing/cost-to-move-a-hot-tub/ | cost to move a hot tub | Answer with price range in sentence one; formula; distance table (3/10/25 mi); item attributes: Removal/disposal yes, relocation only with {{TIER_3}} + 2 helpers; permit notes; helper guidance; what to prep; 4–6 FAQs; book CTA. Status: new. | 2 |
| /pricing/cost-to-move-a-tv/ | cost to move a tv | Answer with price range in sentence one; formula; distance table (3/10/25 mi); item attributes: Box or blanket, upright, {{TIER_1}}; helper guidance; what to prep; 4–6 FAQs; book CTA. Status: new. | 2 |
| /pricing/cost-to-move-a-grill/ | cost to move a grill | Answer with price range in sentence one; formula; distance table (3/10/25 mi); item attributes: Propane tank rules (tank rides separately), 100–200 lb; helper guidance; what to prep; 4–6 FAQs; book CTA. Status: new. | 2 |
| /pricing/cost-to-deliver-patio-furniture/ | cost to deliver patio furniture | Answer with price range in sentence one; formula; distance table (3/10/25 mi); item attributes: Sets vs single pieces, stacking, weather; helper guidance; what to prep; 4–6 FAQs; book CTA. Status: new. | 2 |
| /pricing/cost-to-move-an-exercise-bike/ | cost to move an exercise bike | Answer with price range in sentence one; formula; distance table (3/10/25 mi); item attributes: Peloton/rower dimensions, screen protection; helper guidance; what to prep; 4–6 FAQs; book CTA. Status: new. | 2 |
| /pricing/cost-to-deliver-a-kayak/ | cost to deliver a kayak | Answer with price range in sentence one; formula; distance table (3/10/25 mi); item attributes: Overhang rules, red flag, {{TIER_2}}; helper guidance; what to prep; 4–6 FAQs; book CTA. Status: new. | 2 |
| /pricing/cost-to-haul-a-motorcycle/ | cost to haul a motorcycle | Answer with price range in sentence one; formula; distance table (3/10/25 mi); item attributes: Ramp + tie-downs, {{TIER_3}} only if driver equipped; else refer out; helper guidance; what to prep; 4–6 FAQs; book CTA. Status: new. | 2 |
| /pricing/cost-to-deliver-plywood-and-lumber/ | cost to deliver plywood and lumber | Answer with price range in sentence one; formula; distance table (3/10/25 mi); item attributes: 4x8 sheets flat vs angled, overhang, {{TIER_2}}/{{TIER_3}}; helper guidance; what to prep; 4–6 FAQs; book CTA. Status: new. | 2 |
| /pricing/cost-to-deliver-a-pallet/ | cost to deliver a pallet | Answer with price range in sentence one; formula; distance table (3/10/25 mi); item attributes: Business hub cross-link, liftgate not available, forklift-to-bed loading; helper guidance; what to prep; 4–6 FAQs; book CTA. Status: new. | 2 |
| /pricing/cost-to-move-a-studio-apartment/ | cost to move a studio apartment | Answer with price range in sentence one; formula; distance table (3/10/25 mi); item attributes: One or two trips, helper, boxes count table; helper guidance; what to prep; 4–6 FAQs; book CTA. Status: new. | 2 |
| /pricing/cost-to-move-a-one-bedroom-apartment/ | cost to move a one bedroom apartment | Answer with price range in sentence one; formula; distance table (3/10/25 mi); item attributes: Two trips typical, helper, when movers are cheaper; helper guidance; what to prep; 4–6 FAQs; book CTA. Status: new. | 2 |
| /pricing/cost-to-move-a-storage-unit/ | cost to move a storage unit | Answer with price range in sentence one; formula; distance table (3/10/25 mi); item attributes: 5x5 / 5x10 / 10x10 load estimates; helper guidance; what to prep; 4–6 FAQs; book CTA. Status: new. | 2 |
| /pricing/cost-of-a-dump-run/ | how much does a dump run cost | Per-load pricing; how dump fees pass through; load-size photos (quarter / half / full bed); what is not accepted. | 1 |
| /pricing/truck-and-driver-hourly-vs-per-trip/ | truck and driver hourly rate | Side-by-side math for 1 item / 5 items / studio; break-even point; when hourly wins. | 2 |
| /pricing/pickup-truck-delivery-cost/ | pickup truck delivery cost | Anonymized real trip data from the launch metro once available; distribution chart; medians by item type. Information-gain page. | 3 |

Cluster linking: every pricing page links up to /pricing/ and sideways to the two most related items (couch ↔ sectional ↔ mattress; refrigerator ↔ washer ↔ dishwasher; studio ↔ one-bedroom ↔ storage unit). /pricing/ links to every page in this cluster.

---

## 6. Service section

Five hubs. Each hub owns attributes the others do not. Each spoke targets one scenario. A spoke is only created when it has an attribute set the hub doesn't (a store's pickup lane, a platform's payment rule, an appliance's prep step). If two spokes could swap H1s, one is deleted.

### 6.1 Hub A — Furniture & Large-Item Delivery
Owns: store pickup, marketplace pickup, single-item / no-minimum, wrapping and protection, delivery windows, the "what we can't move" boundary.

| URL | H1 | Primary query | Phase |
|---|---|---|---|
| /services/furniture-delivery/ | Furniture & large-item delivery with a truck and driver | furniture delivery service {{METRO}} | 1 |
| /services/furniture-delivery/store-pickup/ | Store pickup and delivery: we bring it home from the store | store pickup and delivery service | 1 |
| /services/furniture-delivery/store-pickup/ikea/ | Ikea pickup and delivery in {{METRO}} | ikea pickup and delivery {{METRO}} | 2 |
| /services/furniture-delivery/store-pickup/costco/ | Costco pickup and delivery in {{METRO}} | costco delivery alternative {{METRO}} | 2 |
| /services/furniture-delivery/store-pickup/home-depot/ | Home Depot pickup and delivery in {{METRO}} | home depot truck delivery alternative {{METRO}} | 2 |
| /services/furniture-delivery/store-pickup/lowes/ | Lowes pickup and delivery in {{METRO}} | lowes delivery alternative {{METRO}} | 2 |
| /services/furniture-delivery/store-pickup/living-spaces/ | Living Spaces pickup and delivery in {{METRO}} | living spaces delivery alternative {{METRO}} | 2 |
| /services/furniture-delivery/store-pickup/ashley-furniture/ | Ashley Furniture pickup and delivery in {{METRO}} | ashley furniture delivery alternative {{METRO}} | 2 |
| /services/furniture-delivery/store-pickup/big-lots/ | Big Lots pickup and delivery in {{METRO}} | big lots furniture delivery {{METRO}} | 2 |
| /services/furniture-delivery/store-pickup/walmart/ | Walmart pickup and delivery in {{METRO}} | walmart big item pickup delivery {{METRO}} | 2 |
| /services/furniture-delivery/store-pickup/target/ | Target pickup and delivery in {{METRO}} | target large item delivery alternative {{METRO}} | 2 |
| /services/furniture-delivery/store-pickup/mattress-firm/ | Mattress Firm pickup and delivery in {{METRO}} | mattress firm delivery alternative {{METRO}} | 2 |
| /services/furniture-delivery/marketplace-pickup/ | Facebook Marketplace, Craigslist & OfferUp pickup with a truck | facebook marketplace pickup service | 1 |
| /services/furniture-delivery/marketplace-pickup/facebook-marketplace/ | Facebook Marketplace pickup and delivery | facebook marketplace delivery {{METRO}} | 2 |
| /services/furniture-delivery/marketplace-pickup/craigslist/ | Craigslist pickup and delivery | craigslist pickup service {{METRO}} | 2 |
| /services/furniture-delivery/marketplace-pickup/offerup/ | Offerup pickup and delivery | offerup delivery service {{METRO}} | 2 |
| /services/furniture-delivery/marketplace-pickup/nextdoor/ | Nextdoor pickup and delivery | nextdoor furniture pickup {{METRO}} | 2 |
| /services/furniture-delivery/couch-delivery/ | Couch and sofa delivery | couch delivery service {{METRO}} | 1 |
| /services/furniture-delivery/mattress-delivery/ | Mattress delivery | mattress delivery service {{METRO}} | 1 |
| /services/furniture-delivery/single-item-delivery/ | Single-item delivery, no minimum | single item delivery service {{METRO}} | 1 |
| /services/furniture-delivery/thrift-store-pickup/ | Thrift store & consignment pickup | thrift store furniture delivery {{METRO}} | 2 |
| /services/furniture-delivery/estate-sale-pickup/ | Estate sale & auction pickup | estate sale pickup service {{METRO}} | 2 |
| /services/furniture-delivery/what-we-cant-move/ | What BoxHauls cannot move | what won't a truck delivery service move {{METRO}} | 1 |

### 6.2 Hub B — Small Moves
Owns: per-trip vs hourly, one-load capacity, helper add-on, multi-trip logic.

| URL | H1 | Primary query | Phase |
|---|---|---|---|
| /services/small-moves/ | Small moves: studio, one-bedroom, dorm and storage moves by the trip | small moving service {{METRO}} | 1 |
| /services/small-moves/studio-apartment-move/ | Studio apartment move | studio apartment movers | 1 |
| /services/small-moves/one-bedroom-move/ | One-bedroom apartment move | one bedroom apartment movers | 1 |
| /services/small-moves/dorm-move/ | Dorm move-in and move-out | dorm movers {{METRO}} | 1 |
| /services/small-moves/storage-unit-move/ | Storage unit moves | storage unit movers | 1 |
| /services/small-moves/senior-downsizing-move/ | Senior downsizing moves | senior downsizing movers | 2 |
| /services/small-moves/small-office-move/ | Small office moves | small office movers | 2 |
| /services/small-moves/last-minute-move/ | Last-minute and same-day moves | same day movers near me | 2 |
| /services/small-moves/in-building-move/ | In-building and across-the-street moves | movers for moving within same building | 2 |

### 6.3 Hub C — Appliance Delivery & Haul-Away
Owns: two-person handling, prep (defrost/disconnect/strap), doorways and stairs, old-unit removal, what drivers do not do (hookups).

| URL | H1 | Primary query | Phase |
|---|---|---|---|
| /services/appliance-delivery/ | Appliance delivery and haul-away | appliance delivery service {{METRO}} | 1 |
| /services/appliance-delivery/refrigerator/ | Refrigerator delivery | refrigerator delivery service | 1 |
| /services/appliance-delivery/washer-and-dryer/ | Washer and dryer delivery | washer dryer delivery service | 1 |
| /services/appliance-delivery/dishwasher-and-range/ | Dishwasher and range delivery | stove delivery service | 2 |
| /services/appliance-delivery/water-heater/ | Water heater pickup and delivery | water heater delivery | 2 |
| /services/appliance-delivery/freezer/ | Chest and upright freezer delivery | freezer delivery service | 2 |
| /services/appliance-delivery/haul-away/ | Old appliance haul-away and recycling | appliance removal service | 1 |

### 6.4 Hub D — Junk Removal & Dump Runs
Owns: per-load pricing, accepted/not-accepted, dump-fee pass-through, donation-first, local transfer-station knowledge.

| URL | H1 | Primary query | Phase |
|---|---|---|---|
| /services/junk-removal/ | Junk removal and dump runs by the truckload | junk removal {{METRO}} | 1 |
| /services/junk-removal/dump-runs/ | Dump runs | dump run service near me | 1 |
| /services/junk-removal/couch-disposal/ | Couch disposal | couch removal service | 1 |
| /services/junk-removal/mattress-disposal/ | Mattress disposal | mattress removal service | 1 |
| /services/junk-removal/garage-cleanout/ | Garage cleanouts | garage cleanout service | 1 |
| /services/junk-removal/yard-waste-removal/ | Yard waste removal | yard waste removal service | 2 |
| /services/junk-removal/construction-debris-removal/ | Construction debris removal | construction debris removal | 2 |
| /services/junk-removal/e-waste-and-electronics/ | E-waste and electronics pickup | electronics recycling pickup | 2 |
| /services/junk-removal/hot-tub-removal/ | Hot tub removal | hot tub removal service | 2 |
| /services/junk-removal/estate-cleanout/ | Estate cleanouts | estate cleanout service | 2 |
| /services/junk-removal/furniture-donation-pickup/ | Furniture donation drop-off | furniture donation pickup | 2 |

### 6.5 Hub E — Business & Jobsite Hauling
Owns: accounts, invoicing, recurring runs, pallets, turnovers, last-mile for retailers.

| URL | H1 | Primary query | Phase |
|---|---|---|---|
| /services/business-hauling/ | Business and jobsite hauling | business delivery service pickup truck {{METRO}} | 1 |
| /services/business-hauling/pallet-and-bulk-pickup/ | Pallet and bulk pickup | pallet pickup and delivery local | 2 |
| /services/business-hauling/jobsite-material-runs/ | Jobsite material runs | jobsite delivery service | 2 |
| /services/business-hauling/property-manager-turnovers/ | Property manager unit turnovers | property management hauling service | 2 |
| /services/business-hauling/retail-last-mile/ | Retail last-mile delivery | last mile delivery for furniture stores | 2 |
| /services/business-hauling/restaurant-and-office-equipment/ | Restaurant and office equipment moves | restaurant equipment movers | 2 |

### 6.6 City pages — gated

A city page is created only when all of the following are true: (a) ≥ {{MIN_ACTIVE_DRIVERS}} active drivers in the metro, (b) a real, verifiable address or service-area anchor for Google Business Profile, (c) a human has written the local blocks listed below. It is never generated from a template and never quotes the global formula as "local pricing."

| URL | H1 | Primary query | Content blocks / attributes |
|---|---|---|---|
| /cities/{{metro-slug}}/ | Truck and driver on demand in {{METRO}} | truck delivery service {{METRO}} | MUST CONTAIN (no template filler): local transfer stations/landfills with address, hours, fees; the retailers drivers pick up from most with pickup-lane notes; {{METRO}} bulky-item pickup rules and gaps; {{UNIVERSITY}} move-in/out dates; apartment corridors; real driver profiles with photos; real reviews from {{METRO}}; pricing table from actual trips; coverage map. Neighborhood sub-pages only when trip volume justifies. |
| /cities/{{metro-slug}}/{{neighborhood-slug}}/ | BoxHauls in {{NEIGHBORHOOD}} | furniture delivery {{NEIGHBORHOOD}} | OPTIONAL, phase 3, only with ≥20 completed trips in the neighborhood: local landmarks drivers use, parking/loading realities, nearest transfer station, real trips and reviews. |

**City × service pages** (e.g. /cities/{{metro-slug}}/ikea-delivery/) are **not** in this map. If demand data later justifies them, they are added one at a time with the same local-content gate, capped at five per metro, and each must contain content that the service hub does not (local store address, local price table from real trips, local reviews). Absent that, the service hub already ranks for "{service} {metro}" because the hub states the metro and the city page links to it.

---

## 7. Compare cluster

Someone searching a competitor's name next to yours is one step from booking. Each page is an honest side-by-side. Where the competitor wins, say so — that credibility is what makes the verdict believable.

Criteria table on every page (same order): price model · minimum charge · coverage in {{METRO}} · cargo insurance · driver vetting · scheduling (on-demand vs window) · helpers · app quality. Facts are dated and sourced; refresh quarterly.

| URL | H1 | Primary query | Phase |
|---|---|---|---|
| /compare/ | BoxHauls vs. the alternatives | best on demand truck delivery app | 2 |
| /compare/boxhauls-vs-lugg/ | BoxHauls vs. Lugg | boxhauls vs lugg | 2 |
| /compare/boxhauls-vs-dolly/ | BoxHauls vs. Dolly | boxhauls vs dolly | 2 |
| /compare/boxhauls-vs-goshare/ | BoxHauls vs. GoShare | boxhauls vs goshare | 2 |
| /compare/boxhauls-vs-bungii/ | BoxHauls vs. Bungii | boxhauls vs bungii | 2 |
| /compare/boxhauls-vs-taskrabbit/ | BoxHauls vs. TaskRabbit | boxhauls vs taskrabbit | 2 |
| /compare/boxhauls-vs-truck-it/ | BoxHauls vs. Truck It | boxhauls vs truck it app | 2 |
| /compare/boxhauls-vs-curri/ | BoxHauls vs. Curri | boxhauls vs curri | 2 |
| /compare/boxhauls-vs-uhaul-truck-rental/ | BoxHauls vs. renting a U-Haul | truck delivery service vs uhaul rental | 2 |
| /compare/boxhauls-vs-home-depot-truck-rental/ | BoxHauls vs. Home Depot truck rental | home depot truck rental vs delivery service | 2 |
| /compare/boxhauls-vs-store-delivery/ | BoxHauls vs. store delivery | store delivery vs pickup truck delivery service | 2 |
| /compare/boxhauls-vs-hiring-movers/ | BoxHauls vs. hiring movers | movers vs truck and driver for one item | 2 |
| /compare/boxhauls-vs-borrowing-a-friends-truck/ | BoxHauls vs. borrowing a friend's truck | is it worth borrowing a friends truck | 2 |

---

## 8. Guides (outer section)

Guides exist to answer the question *around* a haul and to send authority into the core. Each guide has exactly one inward link with a descriptive anchor into the core page listed under "Links to." Guides never link to /drive/.

Clusters: **fit** (dimension tables — the information-gain cluster nobody else does well) · **howto** · **decision** · **marketplace** · **retail** · **local** · **scenario** · **trust** · **seasonal**.

| URL | H1 | Primary query | Links to | Phase |
|---|---|---|---|---|
| /guides/ | Guides: moving big stuff without owning a truck | how to move furniture without a truck | /guides/will-it-fit-in-a-pickup-bed/, /guides/how-to-move-a-couch-without-a-truck/ | 1 |
| /guides/will-it-fit-in-a-pickup-bed/ | Will it fit in a pickup bed? Dimensions for 40 common items | will a couch fit in a truck bed | /guides/, /pricing/truck-sizes/ | 1 |
| /guides/will-a-sectional-fit-in-a-pickup/ | Will a sectional fit in a pickup truck? | sectional fit in truck bed | /guides/, /pricing/cost-to-move-a-sectional/ | 2 |
| /guides/will-a-king-mattress-fit-in-a-pickup/ | Will a king mattress fit in a pickup truck? | king mattress fit in truck bed | /guides/, /pricing/cost-to-move-a-mattress/ | 2 |
| /guides/will-a-refrigerator-fit-in-a-pickup/ | Will a refrigerator fit in a pickup truck? (and can it lay down?) | can you lay a refrigerator down in a truck | /guides/, /pricing/cost-to-move-a-refrigerator/ | 2 |
| /guides/will-a-washer-fit-in-a-pickup/ | Will a washer and dryer fit in a pickup truck? | washer dryer fit in truck bed | /guides/, /pricing/cost-to-move-a-washer-and-dryer/ | 2 |
| /guides/will-4x8-plywood-fit-in-a-pickup/ | Will 4x8 plywood fit in a short-bed pickup? | 4x8 sheet fit in 5.5 ft bed | /guides/, /pricing/cost-to-deliver-plywood-and-lumber/ | 2 |
| /guides/pickup-truck-bed-sizes-explained/ | Pickup truck bed sizes explained (5.5, 6.5, 8 ft) | pickup truck bed sizes | /guides/, /pricing/truck-sizes/ | 2 |
| /guides/how-much-weight-can-a-pickup-carry/ | How much weight can a pickup truck carry? | how much weight can a half ton truck carry | /guides/, /pricing/truck-sizes/ | 2 |
| /guides/how-to-move-a-couch-without-a-truck/ | How to move a couch without a truck | how to move a couch without a truck | /guides/, /services/furniture-delivery/couch-delivery/ | 1 |
| /guides/how-to-move-a-refrigerator/ | How to move a refrigerator (prep, transport, restart) | how to move a refrigerator | /guides/, /services/appliance-delivery/refrigerator/ | 2 |
| /guides/how-to-move-a-washer-and-dryer/ | How to move a washer and dryer without breaking them | how to move a washing machine | /guides/, /services/appliance-delivery/washer-and-dryer/ | 2 |
| /guides/how-to-tie-down-a-load-in-a-pickup/ | How to tie down a load in a pickup bed | how to secure furniture in a truck bed | /guides/, /drive/equipment/ | 2 |
| /guides/how-to-move-a-mattress-without-getting-it-dirty/ | How to move a mattress without getting it dirty | how to transport a mattress in a truck | /guides/, /services/furniture-delivery/mattress-delivery/ | 2 |
| /guides/how-to-get-a-couch-up-stairs/ | How to get a couch up stairs or through a tight doorway | couch won't fit through door | /guides/, /services/furniture-delivery/couch-delivery/ | 2 |
| /guides/how-to-prep-appliances-for-transport/ | How to prep appliances for transport | prepare appliance for moving | /guides/, /services/appliance-delivery/ | 2 |
| /guides/how-to-wrap-furniture-for-a-truck/ | How to wrap furniture for an open truck bed | how to protect furniture in truck bed | /guides/, /services/furniture-delivery/ | 2 |
| /guides/how-to-load-a-pickup-bed/ | How to load a pickup bed (weight, order, tailgate) | how to load a pickup truck bed | /guides/, /pricing/truck-sizes/ | 2 |
| /guides/how-to-disassemble-a-bed-frame/ | How to disassemble a bed frame for moving | how to take apart a bed frame | /guides/, /pricing/cost-to-move-a-bed-frame/ | 3 |
| /guides/renting-a-truck-vs-hiring-a-truck-and-driver/ | Renting a truck vs. hiring a truck and driver: the real all-in cost | is it cheaper to rent a truck or hire delivery | /guides/, /compare/boxhauls-vs-uhaul-truck-rental/ | 1 |
| /guides/when-you-need-a-second-helper/ | When you need a second helper (stairs, doorways, weight) | do I need a helper to move a couch | /guides/, /pricing/fees/ | 2 |
| /guides/is-it-worth-hiring-delivery-for-one-item/ | Is it worth hiring delivery for one item? | cheapest way to move one piece of furniture | /guides/, /services/furniture-delivery/single-item-delivery/ | 2 |
| /guides/how-much-to-tip-a-truck-driver/ | How much to tip a truck delivery driver | how much to tip furniture delivery | /guides/, /how-it-works/ | 2 |
| /guides/movers-vs-truck-and-driver-for-a-studio/ | Movers vs. a truck and driver for a studio apartment | cheapest way to move a studio apartment | /guides/, /services/small-moves/studio-apartment-move/ | 2 |
| /guides/what-to-expect-from-a-boxhauls-driver/ | What to expect from a BoxHauls driver | what does a truck delivery driver do | /guides/, /trust/ | 1 |
| /guides/how-to-get-a-facebook-marketplace-purchase-home/ | How to get a Facebook Marketplace purchase home safely | how to pick up furniture from facebook marketplace | /guides/, /services/furniture-delivery/marketplace-pickup/facebook-marketplace/ | 1 |
| /guides/what-to-do-when-a-marketplace-seller-no-shows/ | What to do when a Marketplace seller no-shows | facebook marketplace seller didn't show up | /guides/, /services/furniture-delivery/marketplace-pickup/ | 2 |
| /guides/how-to-inspect-used-furniture-before-buying/ | How to inspect used furniture before you buy it | what to check when buying used couch | /guides/, /services/furniture-delivery/marketplace-pickup/ | 2 |
| /guides/how-to-pay-safely-on-marketplace-pickups/ | How to pay safely on Marketplace pickups | safest way to pay facebook marketplace | /guides/, /services/furniture-delivery/marketplace-pickup/ | 3 |
| /guides/ikea-flat-pack-vs-assembled/ | IKEA flat-pack vs. assembled: what to buy if a pickup is bringing it home | should I buy ikea furniture assembled | /guides/, /services/furniture-delivery/store-pickup/ikea/ | 2 |
| /guides/how-costco-warehouse-pickup-works/ | How Costco warehouse pickup works for big items | costco pickup large items | /guides/, /services/furniture-delivery/store-pickup/costco/ | 2 |
| /guides/getting-lumber-home-from-home-depot/ | Getting lumber home from Home Depot without a truck | how to transport lumber without a truck | /guides/, /services/furniture-delivery/store-pickup/home-depot/ | 2 |
| /guides/mattress-in-a-box-vs-traditional-delivery/ | Mattress-in-a-box vs. traditional mattress delivery | mattress in a box vs regular mattress delivery | /guides/, /services/furniture-delivery/mattress-delivery/ | 3 |
| /guides/dump-fees-in-{{metro-slug}}/ | Dump fees in {{METRO}}: what the transfer stations charge | dump fees {{METRO}} | /guides/, /cities/{{metro-slug}}/ | 1 |
| /guides/bulky-item-pickup-in-{{metro-slug}}/ | What {{METRO}}'s bulky-item pickup will and won't take | bulky item pickup {{METRO}} | /guides/, /cities/{{metro-slug}}/ | 1 |
| /guides/college-move-in-{{metro-slug}}/ | {{UNIVERSITY}} move-in and move-out: what fits in one truck | {{UNIVERSITY}} move in day tips | /guides/, /services/small-moves/dorm-move/ | 2 |
| /guides/where-to-donate-furniture-in-{{metro-slug}}/ | Where to donate furniture in {{METRO}} (and who picks up) | donate furniture {{METRO}} | /guides/, /services/junk-removal/furniture-donation-pickup/ | 2 |
| /guides/mattress-recycling-in-{{metro-slug}}/ | Mattress recycling in {{METRO}} | mattress recycling {{METRO}} | /guides/, /services/junk-removal/mattress-disposal/ | 2 |
| /guides/storage-unit-run-in-one-trip/ | Storage-unit runs: how to load it in one trip | how to move storage unit | /guides/, /services/small-moves/storage-unit-move/ | 2 |
| /guides/estate-cleanout-in-one-weekend/ | Clearing out an estate in one weekend | how to clean out a parents house | /guides/, /services/junk-removal/estate-cleanout/ | 2 |
| /guides/apartment-turnover-in-48-hours/ | Property managers: turning a unit in 48 hours | apartment turnover checklist | /guides/, /services/business-hauling/property-manager-turnovers/ | 3 |
| /guides/moving-out-of-a-dorm-in-one-trip/ | Moving out of a dorm in one trip | dorm move out tips | /guides/, /services/small-moves/dorm-move/ | 2 |
| /guides/what-to-do-if-an-item-is-damaged/ | What to do if an item is damaged in delivery | furniture damaged during delivery what to do | /guides/, /trust/damage-claims/ | 1 |
| /guides/delivery-insurance-explained/ | Delivery insurance explained: cargo vs. liability | does delivery insurance cover furniture | /guides/, /trust/insurance/ | 2 |
| /guides/spring-cleanout-checklist/ | Spring cleanout checklist | spring garage cleanout checklist | /guides/, /services/junk-removal/garage-cleanout/ | 3 |
| /guides/holiday-furniture-delivery-tips/ | Holiday furniture delivery: getting it there before guests arrive | furniture delivery before christmas | /guides/, /services/furniture-delivery/ | 3 |
| /guides/college-move-out-week/ | College move-out week: booking ahead | when to book movers for college move out | /guides/, /services/small-moves/dorm-move/ | 3 |

---

## 9. Content standards (every page)

1. **Answer first.** The first sentence of the first paragraph answers the primary query with a number, a yes/no, or a definition. No throat-clearing.
2. **One page, one intent.** The primary query in this map is the only query the page is optimized for. Secondary queries are covered by sections, not by a second H1-style heading.
3. **Attributes, not adjectives.** State bed length in inches, weight in pounds, price in dollars, time in minutes. "Spacious" is not an attribute.
4. **Consistent tables.** Dimensions are always L × W × H in inches. Weight is always a range in lb. Prices are always for {{METRO}} unless labeled. Same column order on every page in a cluster.
5. **Entity vocabulary.** Use "truck and driver," "haul," "trip," "tier," "helper," "pickup," "drop-off." Never "logistics," "solution," "on-demand ecosystem," "cargo," "freight," "buddy with a truck" (Truxx), "friend with a truck" (GoShare trademark), or "too big for my car" (existing company).
6. **Real media only.** Photos are real hauls, real drivers, real trucks in {{METRO}}, with descriptive alt text ("driver strapping a grey sectional into a half-ton bed in {{NEIGHBORHOOD}}"). No stock, no AI imagery, no build-tool screenshots.
7. **FAQ format.** Question as an H3 in the user's words; answer in 2–4 sentences; first sentence is the answer. FAQPage schema mirrors the on-page text exactly.
8. **Authorship.** Guides carry a named author with a one-line bio and a Person entity. Service and pricing pages are authored by "BoxHauls" with a "Reviewed by {{FOUNDER_NAME}}" line.
9. **Dates.** Pricing, compare, and local pages show a "Prices/facts checked {month year}" line and are reviewed quarterly.
10. **Length.** Pricing page 700–1,100 words. Service hub 900–1,400. Service spoke 500–900. Guide 800–1,500. City page 1,200–2,000. Compare 900–1,300. Length is a consequence of covering the attributes, never a target in itself.
11. **No boilerplate blocks.** The identical "Keep exploring" block on every page of the current site is not carried over. Related links are chosen per page (Section 10).
12. **Honest limits.** Pages that say what BoxHauls will not do (/services/furniture-delivery/what-we-cant-move/, piano, hot tub relocation) are trust pages. They stay.
13. **No placeholder social proof.** Driver cards, ratings, ETAs, and haul counts appear only when they are live data. Empty states are acceptable.

---

## 10. Internal linking rules

| Rule | Detail |
|---|---|
| Header | Logo → / ; Pricing ; Services (dropdown: five hubs) ; How it works ; Trust ; Get the app. Driver link appears only in the footer on rider pages. |
| Footer | ≤ 12 links: five hubs, /pricing/, /trust/, /cities/, /guides/, /drive/, /partners/, /contact/. Plus NAP block and app badges. Nothing else. |
| Breadcrumbs | Every page; mirrors URL; BreadcrumbList schema. |
| In-body links | 3–8 per page, in sentences, with descriptive anchors that name the destination's topic ("what a couch move costs in {{METRO}}", "how the damage-claim process works"). Never "click here," "learn more," or a bare brand name as anchor. |
| Hub → spoke | Every hub links to every one of its spokes in a structured list plus at least once in prose. |
| Spoke → hub | Every spoke links up to its hub in the first 200 words and in the breadcrumb. |
| Spoke ↔ spoke | Sideways links only within the same hub or to the directly related pricing page. |
| Guide → core | Exactly one inward link per guide (the "Links to" target). Additional links stay within /guides/. |
| Pricing ↔ service | Each pricing page links to the service page that performs that haul; each service hub links to its 2–3 most relevant pricing pages. |
| Related-links block | 3–5 links chosen per page from the same cluster; never sitewide; never the homepage. |
| CTA links | Book buttons deep-link into the booking flow with the item/tier pre-selected (e.g. /book/?item=couch), not to /. |
| Context isolation | Rider pages never link to /drive/ in body. Driver pages never link to /services/. /partners/ may link to /pricing/ and /trust/. |
| Orphans | Zero. Every page in sitemap.json is reachable within three clicks from /. |

---

## 11. Structured data specification

All JSON-LD is server-rendered in the initial HTML. One `@graph` per page containing the types below. IDs use `https://boxhauls.com/#organization`, `https://boxhauls.com{url}#webpage`, etc.

| Type | Where | Required properties |
|---|---|---|
| Organization | every page (@id #organization) | name "BoxHauls", legalName, url, logo, telephone, address (PostalAddress), founder (Person), sameAs [Instagram, TikTok, Facebook, X, LinkedIn, App Store, Google Play], contactPoint |
| WebSite | / | name, url, publisher → #organization |
| LocalBusiness (MovingCompany) | /cities/{metro}/ only | name, address, telephone, areaServed (City + radius), openingHours, priceRange, geo, hasOfferCatalog → services |
| Service | service hubs & spokes, pricing pages | name, serviceType, provider → #organization, areaServed, offers → Offer |
| Offer + PriceSpecification | pricing pages, /pricing/ | price or priceRange (minPrice/maxPrice), priceCurrency USD, eligibleRegion |
| FAQPage | any page with an FAQ block | mainEntity Question/Answer mirroring on-page text |
| HowTo | /how-it-works/, howto guides, /trust/damage-claims/ | name, step[] with name + text |
| Article | guides, driver guides | headline, author (Person), datePublished, dateModified, image, publisher → #organization |
| Person | /about/, guide authors | name, jobTitle, image, sameAs |
| BreadcrumbList | every page | itemListElement mirroring URL path |
| MobileApplication | /app/ | name, operatingSystem, applicationCategory, offers (free), aggregateRating only when real |
| JobPosting | /drive/, /drive/{metro}/ | title, description, hiringOrganization, jobLocation, employmentType CONTRACTOR, baseSalary (range, only if publishable) |
| ContactPoint | /contact/ | telephone, contactType, areaServed, availableLanguage [en, es] |

Never emit: Review/AggregateRating without real reviews; LocalBusiness on non-city pages; FAQPage whose questions are not visible on the page.

---

## 12. Technical specification

| Item | Requirement |
|---|---|
| Stack | Astro (preferred) or Next.js with static generation for every marketing route. Booking app is a client-side island mounted on /, /book/, and the CTA targets. |
| Rendering | Every indexable URL returns complete HTML (H1, body, JSON-LD, links) with JavaScript disabled. Test with `curl` — if the body is empty, it fails. |
| Hosting | Vercel or Cloudflare Pages; custom domain boxhauls.com; www → apex 301. |
| URLs | Lowercase, hyphenated, trailing slash, no parameters on indexable pages. |
| Sitemap | /sitemap.xml generated from sitemap.json, only indexable pages, lastmod real. |
| robots.txt | Allow all; Disallow /auth, /account, /embed/, /api/, /book/ (booking flow is app UI, not a landing page); Sitemap line. |
| Noindex | /auth, /account, /embed/*, /book/*, share-intent URLs, search-result pages, tag/archive pages. |
| Canonical | Self-referencing on every page; absolute URL; matches trailing-slash form. |
| Redirects | Cross-domain 301 map below from truck-n-go.com; keep the old domain live and redirecting for ≥ 12 months. |
| OG / Twitter | Per-template OG image generated at build (brand + page title + item silhouette). No third-party screenshot services. Correct ampersand encoding. |
| Performance | Mobile LCP < 2.5 s, INP < 200 ms, CLS < 0.1. Booking island lazy-loads below the fold on content pages. Images AVIF/WebP, width-sized, lazy except hero. |
| Fonts | Two families max, self-hosted, `font-display: swap`. |
| Analytics | GA4 or equivalent with events: price_shown, booking_started, booking_completed, driver_apply_started, driver_apply_completed, partner_apply. Search Console + Bing Webmaster verified. |
| i18n | English at launch. Spanish (`/es/`) is Phase 2 (Fresno County is majority-Hispanic) with hreflang; build the driver-recruitment pages in Spanish first. Do not stub empty /es/ routes. |
| Accessibility | Semantic headings (one H1), labeled form fields, 4.5:1 contrast, keyboard-navigable booking flow. |

### 12.1 Redirect map (truck-n-go.com → boxhauls.com)

| Old URL (truck-n-go.com) | New URL (boxhauls.com) |
|---|---|
| / | / |
| /how-it-works | /how-it-works/ |
| /pricing | /pricing/ |
| /faq | /faq/ |
| /contact | /contact/ |
| /press | /press/ |
| /drive | /drive/ |
| /partners | /partners/ |
| /link-to-us | /press/ |
| /blog | /guides/ |
| /blog/* | /guides/  (map each post to its rewritten guide; else /guides/) |
| /services/on-demand-moving-and-hauling | / |
| /services/furniture-delivery | /services/furniture-delivery/ |
| /services/large-item-delivery | /services/furniture-delivery/ |
| /services/move-furniture | /services/furniture-delivery/ |
| /services/single-item-movers | /services/furniture-delivery/single-item-delivery/ |
| /services/same-day-delivery | / |
| /services/local-hauling | / |
| /services/truck-and-driver-for-hire | / |
| /services/small-moves | /services/small-moves/ |
| /services/junk-hauling | /services/junk-removal/ |
| /cities | /cities/ |
| /cities/{{metro-slug}} | /cities/{{metro-slug}}/ |
| /cities/* (all other cities incl. Europe) | /cities/  (301; do not recreate) |
| /cost-to-move-a-couch | /pricing/cost-to-move-a-couch/ |
| /cost-to-move-a-mattress | /pricing/cost-to-move-a-mattress/ |
| /cost-to-move-a-refrigerator | /pricing/cost-to-move-a-refrigerator/ |
| /cost-to-move-a-washer-and-dryer | /pricing/cost-to-move-a-washer-and-dryer/ |
| /embed/moving-cost-calculator | keep on new domain, noindex |
| /auth, /account | keep, noindex |

---

## 13. Build phases

| Phase | Timing | Scope | Gate to next phase |
|---|---|---|---|
| 0 | Weeks 1–2 | Placeholders resolved (Section 14); launch metro confirmed; old site: remove placeholder social proof, noindex all /cities/* and duplicate service pages; GBP address established; Search Console on both domains | All Section 14 values filled; GBP verification submitted |
| 1 | Weeks 3–7 | All Phase-1 pages (67): core, four migrated pricing pages + dump run, five hubs with Phase-1 spokes, launch city page, /drive/ Phase-1 pages, legal; schema; sitemap; redirects live; domain cutover | Every Phase-1 page passes Section 9 checklist; CWV green on mobile; zero orphans |
| 2 | Weeks 7–13 | Phase-2 pages (117): remaining pricing items, retailer and marketplace spokes, remaining service spokes, compare cluster, guides (2/week), /partners/, driver compare + guides, Spanish /es/ for /drive/ and core pages | 20+ real Google reviews; 5 real partners in directory; compare facts dated |
| 3 | Month 4+ | Phase-3 pages (10): real-trip pricing data page, neighborhood pages (gated, Clovis first), seasonal guides, second metro (copy of Section 6.6 gate) | Second metro meets Section 6.6 gate |

Publishing cadence in Phase 2: two guides per week, one compare page per week, retailer spokes in the order of local store proximity to the metro center.

---

## 14. Placeholders to resolve before building

| Placeholder | Meaning | Example |
|---|---|---|
| `{{LEGAL_NAME}}` | Registered entity name | BoxHauls, LLC |
| `{{FOUNDER_NAME}}` | Real name for /about/ and "Reviewed by" | John … |
| `{{METRO}}` / `{{metro-slug}}` | Launch metro display name / URL slug | Albuquerque / albuquerque |
| `{{NEIGHBORHOOD}}` / `{{neighborhood-slug}}` | Only when Section 6.6 gate is met | Nob Hill / nob-hill |
| `{{UNIVERSITY}}` | Largest campus in the metro for dorm content | University of New Mexico |
| `{{ADDRESS}}` | Real, GBP-verifiable address (may be hidden as SAB) | — |
| `{{PHONE}}` | One number, local to the metro | (505) … |
| `{{RADIUS}}` | Service radius in miles | 30 |
| `{{TIER_1}}` `{{TIER_2}}` `{{TIER_3}}` | Tier names (current site: Box Run / standard pickup / heavy hauler — confirm) | Box Run / Half-Ton / Heavy Hauler |
| `{{BASE_FARE}}` `{{PER_MILE}}` | Pricing formula constants | $39 / $2.10 |
| `{{HEAVY_FEE}}` `{{HELPER_FEE}}` | Current site shows $29 / $28 — confirm | — |
| `{{MAX_ITEM_WEIGHT}}` `{{MAX_SAFE_WEIGHT}}` | Hard limits for the "what we can't move" boundary | 400 lb / 600 lb |
| `{{INSURANCE_CARRIER}}` `{{COVERAGE_LIMIT}}` | Publishable insurance facts | — |
| `{{BACKGROUND_PROVIDER}}` | Vetting vendor | Checkr |
| `{{DRIVER_SHARE}}` | Driver payout percentage | 82 |
| `{{MIN_ACTIVE_DRIVERS}}` | Gate for creating a city page | 15 |
| `{{YEAR}}` | Current year for title tags | 2026 |

---

## 15. Query network summary (what the whole map is built to win)

| Query family | Example | Owned by |
|---|---|---|
| Brand | boxhauls, boxhauls app, boxhauls reviews, is boxhauls legit | /, /app/, /reviews/, /trust/ |
| Category + metro | truck delivery {metro}, furniture delivery {metro}, junk removal {metro} | /cities/{metro}/ + hubs |
| Item + cost | cost to move a couch, refrigerator delivery cost | /pricing/ cluster |
| Item + fit | will a sectional fit in a pickup | /guides/ fit cluster |
| Store + delivery | ikea pickup and delivery, costco delivery alternative | store-pickup spokes |
| Platform + pickup | facebook marketplace delivery, craigslist pickup service | marketplace spokes |
| Scenario | studio apartment movers, dump run near me, dorm movers | small-moves / junk spokes |
| Competitor | boxhauls vs lugg, lugg alternative, uhaul vs delivery service | /compare/ |
| Trust | is my furniture insured during delivery, what if furniture is damaged | /trust/ cluster |
| Driver | make money with my pickup truck, hauling gigs {metro} | /drive/ |
| Partner | delivery option for furniture store, last mile partner | /partners/ |

---

## 16. Launch market addendum — Fresno / Clovis

Resolved values: `{{METRO}}` = Fresno · `{{metro-slug}}` = fresno · `{{UNIVERSITY}}` = Fresno State · `{{RADIUS}}` = 25 · base address in Clovis, CA (Google Business Profile as a service-area business; hide the address if residential). "Fresno" is the head term; "Clovis" is the first neighborhood page under /cities/fresno/ once the trip-count gate is met.

| Local entity | Use in content | Verify before publishing |
|---|---|---|
| American Avenue Disposal Site (Fresno County landfill, near Kerman) | dump-run pages, /guides/dump-fees-in-fresno/ | hours, gate fees, accepted materials |
| Cedar Avenue Recycling & Transfer Station (CARTS), Fresno | closer dump-run option, mattress/appliance recycling | hours, fees |
| City of Fresno Operation Clean Up (scheduled bulky pickup by area) | /guides/bulky-item-pickup-in-fresno/ — the gap between pickups is the demand | current schedule, what is excluded |
| Clovis bulky-item rules | same guide, Clovis section | current program |
| Costco (Fresno; Clovis) · Living Spaces Fresno · Home Depot / Lowe's (Herndon & Shaw corridors) · Ashley · Big Lots · Walmart · Target · Mattress Firm | retailer spokes, in this order: Costco Clovis → Living Spaces → Home Depot Clovis → Costco Fresno → Lowe's → rest | addresses, pickup-lane notes |
| No IKEA in Fresno (nearest ≈ 3 hours) | guide: "IKEA delivery to Fresno: your real options"; future scheduled-run product | — |
| Fresno State, Clovis Community College, Fresno City College | dorm-move spoke, college guides; peaks: January move-in, May move-out, August move-in | dates |
| Summer heat (100°F+ June–September) | appliance-transport prep notes, driver safety page | — |
| Spanish-speaking majority county | /es/ in Phase 2; bilingual driver recruitment; ContactPoint.availableLanguage [en, es] | — |

Positioning in this market: "cheaper than a rental, safer than a stranger." The competitor to beat is the cash hauler on Craigslist and Facebook, not the national apps. Never position as premium.

---

*End of specification. Changes to page inventory are made in `build_map.py` (or `sitemap.json`) first, then regenerated, so the map and the site never drift apart.*
