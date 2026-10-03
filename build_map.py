import json, os, textwrap

# =====================================================================
# PAGE INVENTORY — single source of truth
# =====================================================================
PAGES = []

def P(url, h1, primary, secondary, links, schema, blocks, cluster, ptype, phase, template):
    PAGES.append(dict(
        url=url, h1=h1, primary_query=primary, secondary_queries=secondary,
        links_to=links, schema=schema, content_blocks=blocks, cluster=cluster,
        page_type=ptype, phase=phase, template=template
    ))

M = "{{metro-slug}}"          # e.g. albuquerque
MN = "{{METRO}}"              # e.g. Albuquerque
ORG = ["Organization", "BreadcrumbList"]

# ---------------------------------------------------------------- CORE
P("/", "A truck and driver, on demand. Price shown before you book.",
  "truck and driver near me",
  ["on demand truck delivery " + MN, "pickup truck delivery service", "boxhauls"],
  ["/pricing/", "/how-it-works/", "/trust/", "/services/furniture-delivery/", "/services/small-moves/",
   "/services/appliance-delivery/", "/services/junk-removal/", "/services/business-hauling/", f"/cities/{M}/", "/app/"],
  ["Organization", "WebSite"],
  "Booking widget above the fold (pickup, dropoff, item picker, tier, live price only after both addresses); one-line launch-metro statement; three trust badges (insured / background-checked / upfront price); real reviews module; 3-step how-it-works; five service tiles; app download; single driver CTA in footer. No placeholder driver cards, ETAs, or ratings.",
  "core", "home", 1, "home")

P("/how-it-works/", "How BoxHauls works", "how does boxhauls work",
  ["how does on demand truck delivery work", "how to book a pickup truck and driver"],
  ["/pricing/", "/trust/", "/pricing/truck-sizes/", "/faq/"], ORG + ["HowTo"],
  "Numbered steps with real app screenshots: enter addresses → pick item/tier → see price → match driver → track → load/unload → pay → rate. Payment hold explained. Messaging. Cancellation window. Link to driver side once.",
  "core", "hub", 1, "core")

P("/pricing/", "BoxHauls pricing: what a truck and driver costs",
  "how much does a truck and driver cost",
  ["boxhauls pricing", "pickup truck delivery cost", "on demand hauling prices " + MN],
  ["/pricing/truck-sizes/", "/pricing/fees/", "/pricing/cost-to-move-a-couch/", "/pricing/cost-of-a-dump-run/",
   "/pricing/truck-and-driver-hourly-vs-per-trip/", "/services/furniture-delivery/"],
  ORG + ["Service", "Offer", "FAQPage"],
  "Formula stated in one sentence ({{BASE_FARE}} + {{PER_MILE}}/mi + item/helper fees); tier table with bed length, payload, what fits; every fee listed (heavy item {{HEAVY_FEE}}, helper {{HELPER_FEE}}, stairs, wait time); worked examples at 3 / 10 / 25 miles; first-haul promo terms; link grid to every item-cost page; FAQ (6–8).",
  "core", "hub", 1, "core")

P("/pricing/truck-sizes/", "Truck sizes: which BoxHauls tier fits your stuff",
  "what size truck do I need to move a couch",
  ["pickup truck bed sizes", "what fits in a pickup truck bed", "boxhauls truck tiers"],
  ["/pricing/", "/guides/will-it-fit-in-a-pickup-bed/", "/services/furniture-delivery/"],
  ORG + ["Service"],
  "One section per tier ({{TIER_1}} / {{TIER_2}} / {{TIER_3}}): bed length, width between wheel wells, payload, typical vehicles, what fits (with item silhouettes to scale), what does not, price difference. This is the fleet-attributes page for the whole entity.",
  "core", "spoke", 1, "core")

P("/pricing/fees/", "Every BoxHauls fee, explained", "boxhauls fees",
  ["heavy item fee", "helper fee truck delivery", "cancellation fee truck delivery"],
  ["/pricing/", "/trust/cancellation-and-refunds/"], ORG + ["FAQPage"],
  "Table of every possible line item with trigger and amount; what is never charged (no surge, no fuel surcharge if true); how tips work; how dump fees are passed through.",
  "core", "spoke", 1, "core")

P("/trust/", "Trust & safety: insurance, driver vetting, and what happens if something breaks",
  "is boxhauls safe", ["is boxhauls legit", "boxhauls insurance", "are boxhauls drivers background checked"],
  ["/trust/insurance/", "/trust/driver-vetting/", "/trust/damage-claims/", "/trust/cancellation-and-refunds/", "/reviews/"],
  ORG + ["FAQPage"],
  "Plain-language overview with links into the four sub-pages; insurance carrier and limits stated; vetting steps listed; support hours and channels; link to reviews.",
  "core", "hub", 1, "core")
P("/trust/insurance/", "How your items are insured during a BoxHauls haul", "is my furniture insured during delivery",
  ["cargo insurance truck delivery", "boxhauls insurance coverage"], ["/trust/", "/trust/damage-claims/"], ORG + ["FAQPage"],
  "Who carries the policy ({{INSURANCE_CARRIER}}), coverage limits, what is excluded, how to declare high-value items, difference between cargo and liability.", "core", "spoke", 1, "core")
P("/trust/driver-vetting/", "How BoxHauls checks drivers and trucks", "are boxhauls drivers background checked",
  ["truck delivery driver background check", "how are gig hauling drivers vetted"], ["/trust/", "/drive/requirements/"], ORG + ["FAQPage"],
  "Each check listed with provider ({{BACKGROUND_PROVIDER}}): identity, license, driving record, criminal background, vehicle inspection, insurance verification; re-check cadence; rating threshold for staying active.", "core", "spoke", 1, "core")
P("/trust/damage-claims/", "What happens if something is damaged", "what if my furniture is damaged during delivery",
  ["truck delivery damage claim", "boxhauls damage policy"], ["/trust/", "/trust/insurance/", "/guides/what-to-do-if-an-item-is-damaged/"], ORG + ["FAQPage", "HowTo"],
  "Step-by-step claim process with timeline, photo requirements, who pays, typical resolution window.", "core", "spoke", 1, "core")
P("/trust/cancellation-and-refunds/", "Cancellation and refund policy", "boxhauls cancellation policy",
  ["cancel truck delivery fee", "truck delivery no show refund"], ["/trust/", "/pricing/fees/"], ORG + ["FAQPage"],
  "Free-cancellation window, late-cancel fee, driver no-show policy, weather policy, refund timing.", "core", "spoke", 1, "core")

P("/about/", "About BoxHauls", "who owns boxhauls", ["boxhauls company", "boxhauls " + MN],
  ["/press/", "/trust/", "/contact/"], ["Organization", "Person", "BreadcrumbList"],
  "Founder with real name and photo; legal entity ({{LEGAL_NAME}}); headquarters ({{ADDRESS}}); founding year; what BoxHauls is in one sentence and what it is not (not freight, not long-distance moving, not dumpster rental, not rideshare). Disambiguation paragraph.",
  "core", "spoke", 1, "core")
P("/contact/", "Contact BoxHauls", "boxhauls phone number", ["boxhauls support", "boxhauls customer service"],
  ["/faq/", "/trust/"], ["Organization", "ContactPoint", "BreadcrumbList"],
  "One phone ({{PHONE}}), one email, one address, hours, in-app chat note. NAP block identical to GBP.", "core", "utility", 1, "core")
P("/press/", "Press & media kit", "boxhauls press", ["boxhauls media kit", "boxhauls logo"],
  ["/about/"], ORG, "Boilerplate, facts sheet (founded, HQ, service area = real metros only), logo files, founder bio, contact.", "core", "utility", 1, "core")
P("/faq/", "BoxHauls FAQ", "boxhauls faq", ["truck delivery questions"],
  ["/pricing/", "/trust/", "/how-it-works/"], ORG + ["FAQPage"],
  "Only questions not owned by another page; each answer is 2–3 sentences and links to the page that covers it in depth. Grouped: booking, pricing, safety, drivers, business.", "core", "utility", 1, "core")
P("/reviews/", "BoxHauls reviews", "boxhauls reviews", ["boxhauls " + MN + " reviews"],
  ["/trust/", "/"], ORG + ["Organization"],
  "Real reviews only, pulled from Google; rating summary; filter by service; link to leave a review. Empty state acceptable at launch.", "core", "utility", 1, "core")
P("/app/", "Get the BoxHauls app", "boxhauls app", ["boxhauls app download", "boxhauls ios", "boxhauls android"],
  ["/how-it-works/", "/drive/"], ["MobileApplication", "BreadcrumbList"],
  "Store badges, screenshots, feature list, QR code, driver app link.", "core", "utility", 1, "core")
P("/cities/", "Where BoxHauls operates", "boxhauls service area", ["boxhauls cities", "boxhauls near me"],
  [f"/cities/{M}/"], ORG, "Real metros only. One card per live city. Waitlist form for others. Never claims 'anywhere'.", "core", "hub", 1, "core")

# ------------------------------------------------------------- PRICING
PRICING_ITEMS = [
  ("couch", "cost to move a couch", ["couch delivery cost", "how much to move a sofa"], "migrate", "Length 72–96 in, 100–200 lb, one helper recommended, {{TIER_2}}"),
  ("sectional", "cost to move a sectional sofa", ["sectional delivery cost", "how much to move a sectional"], "new", "2–5 pieces, 250–450 lb total, helper required, {{TIER_2}}/{{TIER_3}}"),
  ("mattress", "cost to move a mattress", ["mattress delivery cost", "how much to move a king mattress"], "migrate", "Twin–king dimensions table, 50–150 lb, bag recommended, {{TIER_1}}/{{TIER_2}}"),
  ("bed-frame", "cost to move a bed frame", ["bedroom set moving cost", "how much to move a bed"], "new", "Disassembly notes, headboard sizes, {{TIER_2}}"),
  ("dresser", "cost to move a dresser", ["dresser delivery cost"], "new", "Drawers out or taped, 100–250 lb, helper for stairs"),
  ("dining-table", "cost to move a dining table", ["dining table delivery cost"], "new", "Leg removal, glass tops, chairs count, {{TIER_2}}"),
  ("desk", "cost to move a desk", ["desk delivery cost", "office desk moving cost"], "new", "L-desks, standing desks, disassembly"),
  ("refrigerator", "cost to move a refrigerator", ["refrigerator delivery cost", "how much to move a fridge"], "migrate", "Upright transport only, 200–350 lb, two-person, defrost 24h, {{TIER_2}}/{{TIER_3}}"),
  ("washer-and-dryer", "cost to move a washer and dryer", ["washer dryer delivery cost"], "migrate", "Shipping bolts, 150–250 lb each, two-person"),
  ("dishwasher", "cost to move a dishwasher", ["dishwasher delivery cost"], "new", "Disconnect required, 75–125 lb"),
  ("stove", "cost to move a stove", ["range delivery cost", "how much to move an oven"], "new", "Gas disconnect by licensed pro, 150–250 lb"),
  ("treadmill", "cost to move a treadmill", ["treadmill delivery cost", "how much to move gym equipment"], "new", "Fold vs non-fold, 200–350 lb, helper required"),
  ("gun-safe", "cost to move a gun safe", ["safe moving cost", "how much to move a safe"], "new", "Weight tiers 300/600/1000 lb, stair limits, {{TIER_3}} + helper; refer out above {{MAX_SAFE_WEIGHT}} lb"),
  ("piano", "cost to move a piano", ["piano moving cost"], "new", "Honest limit page: uprights only if drivers can; grands referred to specialists. Sets entity boundary."),
  ("hot-tub", "cost to move a hot tub", ["hot tub removal cost", "hot tub moving cost"], "new", "Removal/disposal yes, relocation only with {{TIER_3}} + 2 helpers; permit notes"),
  ("tv", "cost to move a tv", ["tv delivery cost", "how much to deliver a 75 inch tv"], "new", "Box or blanket, upright, {{TIER_1}}"),
  ("grill", "cost to move a grill", ["grill delivery cost", "how much to deliver a bbq"], "new", "Propane tank rules (tank rides separately), 100–200 lb"),
  ("patio-furniture", "cost to deliver patio furniture", ["patio furniture delivery cost"], "new", "Sets vs single pieces, stacking, weather"),
  ("exercise-bike", "cost to move an exercise bike", ["peloton delivery cost", "how much to move a peloton"], "new", "Peloton/rower dimensions, screen protection"),
  ("kayak", "cost to deliver a kayak", ["kayak delivery cost", "how to transport a kayak without a roof rack"], "new", "Overhang rules, red flag, {{TIER_2}}"),
  ("motorcycle", "cost to haul a motorcycle", ["motorcycle transport local cost"], "new", "Ramp + tie-downs, {{TIER_3}} only if driver equipped; else refer out"),
  ("plywood-and-lumber", "cost to deliver plywood and lumber", ["lumber delivery cost", "home depot delivery cost lumber"], "new", "4x8 sheets flat vs angled, overhang, {{TIER_2}}/{{TIER_3}}"),
  ("pallet", "cost to deliver a pallet", ["pallet delivery cost local"], "new", "Business hub cross-link, liftgate not available, forklift-to-bed loading"),
  ("studio-apartment", "cost to move a studio apartment", ["studio apartment moving cost", "small move cost"], "new", "One or two trips, helper, boxes count table"),
  ("one-bedroom-apartment", "cost to move a one bedroom apartment", ["1 bedroom apartment moving cost"], "new", "Two trips typical, helper, when movers are cheaper"),
  ("storage-unit", "cost to move a storage unit", ["storage unit moving cost"], "new", "5x5 / 5x10 / 10x10 load estimates"),
]
for slug, q, sec, status, attrs in PRICING_ITEMS:
    name = slug.replace("-", " ")
    verb = "deliver" if slug in ("patio-furniture", "kayak", "plywood-and-lumber", "pallet") else "move"
    if slug == "motorcycle": verb = "haul"
    art = 'an' if (name[0] in 'aeiou' and not name.startswith('one')) else 'a'
    url = f"/pricing/cost-to-{verb}-{art}-{slug}/" if slug not in ("patio-furniture","plywood-and-lumber") else f"/pricing/cost-to-deliver-{slug}/"
    P(url, f"How much does it cost to {verb} {art} {name}?", q, sec,
      ["/pricing/", "/pricing/truck-sizes/", "/services/furniture-delivery/" if slug not in ("refrigerator","washer-and-dryer","dishwasher","stove") else "/services/appliance-delivery/"],
      ORG + ["Service", "Offer", "FAQPage"],
      f"Answer with price range in sentence one; formula; distance table (3/10/25 mi); item attributes: {attrs}; helper guidance; what to prep; 4–6 FAQs; book CTA. Status: {status}.",
      "pricing", "spoke", 1 if status == "migrate" else 2, "pricing")

P("/pricing/cost-of-a-dump-run/", "How much does a dump run cost?", "how much does a dump run cost",
  ["dump run price", "cost to haul junk to the dump"],
  ["/pricing/", "/services/junk-removal/", f"/guides/dump-fees-in-{M}/"], ORG + ["Service", "Offer", "FAQPage"],
  "Per-load pricing; how dump fees pass through; load-size photos (quarter / half / full bed); what is not accepted.", "pricing", "spoke", 1, "pricing")
P("/pricing/truck-and-driver-hourly-vs-per-trip/", "Hourly movers vs. per-trip truck and driver: real cost comparison",
  "truck and driver hourly rate", ["hourly movers vs truck delivery", "cheapest way to move one item"],
  ["/pricing/", "/compare/boxhauls-vs-hiring-movers/"], ORG + ["FAQPage"],
  "Side-by-side math for 1 item / 5 items / studio; break-even point; when hourly wins.", "pricing", "spoke", 2, "pricing")
P("/pricing/pickup-truck-delivery-cost/", "Pickup truck delivery cost: what people actually pay",
  "pickup truck delivery cost", ["how much does pickup truck delivery cost", "average cost of truck delivery service"],
  ["/pricing/", "/pricing/cost-to-move-a-couch/", "/compare/"], ORG + ["FAQPage"],
  "Anonymized real trip data from the launch metro once available; distribution chart; medians by item type. Information-gain page.", "pricing", "spoke", 3, "pricing")

# ------------------------------------------------------------- SERVICES
def hub(url, h1, primary, sec, links, blocks, phase=1):
    P(url, h1, primary, sec, links, ORG + ["Service", "Offer", "FAQPage"], blocks, "services", "hub", phase, "service-hub")
def spoke(url, h1, primary, sec, huburl, extra, blocks, phase=1):
    P(url, h1, primary, sec, [huburl] + extra, ORG + ["Service", "FAQPage"], blocks, "services", "spoke", phase, "service-spoke")

A = "/services/furniture-delivery/"
hub(A, "Furniture & large-item delivery with a truck and driver", "furniture delivery service " + MN,
    ["large item delivery", "same day furniture delivery near me", "furniture pickup and delivery"],
    [A+"store-pickup/", A+"marketplace-pickup/", A+"couch-delivery/", A+"mattress-delivery/", A+"single-item-delivery/", A+"what-we-cant-move/", "/pricing/cost-to-move-a-couch/"],
    "Definition sentence; who uses it (store buyers, marketplace buyers, one-item moves); what is included (load, secure, unload, placement to first room); wrapping and protection; delivery windows; tier fit table; price example; trust strip; real photo; FAQs.")
SP = A + "store-pickup/"
spoke(SP, "Store pickup and delivery: we bring it home from the store", "store pickup and delivery service",
      ["furniture store delivery alternative", "pick up my order from the store"], A,
      [SP+"ikea/", SP+"costco/", SP+"home-depot/"],
      "Sub-hub. How store pickup works (order number, pickup lane, ID); which stores; same-day windows; links to each retailer page.")
for store, q, note in [
    ("ikea", "ikea pickup and delivery", "Click-and-collect pickup, flat-pack counts, the {{METRO}} IKEA (or nearest) pickup lane notes, assembly not included"),
    ("costco", "costco delivery alternative", "Warehouse pickup logistics, membership card rule, TVs and furniture, mattress-in-a-box"),
    ("home-depot", "home depot truck delivery alternative", "Pro desk pickup, lumber overhang, appliances, cheaper than store truck rental for one trip"),
    ("lowes", "lowes delivery alternative", "Same as Home Depot with store-specific notes"),
    ("living-spaces", "living spaces delivery alternative", "Warehouse pickup, protected transport"),
    ("ashley-furniture", "ashley furniture delivery alternative", "Outlet pickup, boxed vs assembled"),
    ("big-lots", "big lots furniture delivery", "Boxed furniture, mattress-in-a-box"),
    ("walmart", "walmart big item pickup delivery", "Pickup tower vs curbside, TVs, furniture"),
    ("target", "target large item delivery alternative", "Drive Up limits, furniture pickup"),
    ("mattress-firm", "mattress firm delivery alternative", "Same-day mattress pickup"),
]:
    spoke(SP + store + "/", f"{store.replace('-', ' ').title()} pickup and delivery in {MN}", q + " " + MN,
          [q, f"{store.replace('-', ' ')} delivery cost"], SP, [A, "/pricing/"],
          f"Retailer-specific: {note}. Pickup lane instructions for the launch-metro location. Price example from that store to three neighborhoods.", 2)
MP = A + "marketplace-pickup/"
spoke(MP, "Facebook Marketplace, Craigslist & OfferUp pickup with a truck", "facebook marketplace pickup service",
      ["marketplace delivery service", "craigslist delivery service", "offerup delivery"], A,
      [MP+"facebook-marketplace/", MP+"craigslist/", MP+"offerup/", "/guides/how-to-get-a-facebook-marketplace-purchase-home/"],
      "Sub-hub. Pay-on-pickup handling, seller no-show policy, safety, what the driver will/won't inspect.")
for mk, q in [("facebook-marketplace", "facebook marketplace delivery"), ("craigslist", "craigslist pickup service"),
              ("offerup", "offerup delivery service"), ("nextdoor", "nextdoor furniture pickup")]:
    spoke(MP + mk + "/", f"{mk.replace('-', ' ').title()} pickup and delivery", q + " " + MN, [q], MP, [A, "/trust/"],
          "Platform-specific flow, meeting-point rules, what to send the driver (listing link, seller phone), price example.", 2)
for s, h1, q, note in [
    ("couch-delivery", "Couch and sofa delivery", "couch delivery service", "Sizes, doorway check, stairs, wrapping"),
    ("mattress-delivery", "Mattress delivery", "mattress delivery service", "Bag provided, upright transport, box spring"),
    ("single-item-delivery", "Single-item delivery, no minimum", "single item delivery service", "The no-minimum promise; typical single items; price example"),
    ("thrift-store-pickup", "Thrift store & consignment pickup", "thrift store furniture delivery", "Goodwill/Habitat ReStore/consignment pickup windows"),
    ("estate-sale-pickup", "Estate sale & auction pickup", "estate sale pickup service", "Pickup-day timing, multiple items, fragile pieces"),
    ("what-we-cant-move", "What BoxHauls cannot move", "what won't a truck delivery service move", "Honest limits: grand pianos, hazmat, vehicles over X, items over {{MAX_ITEM_WEIGHT}} lb without equipment, live animals, etc. Referrals for each."),
]:
    spoke(A + s + "/", h1, q + " " + MN, [q], A, ["/pricing/"], note + ". Tier fit, price example, FAQs.", 1 if s in ("couch-delivery","mattress-delivery","single-item-delivery","what-we-cant-move") else 2)

B = "/services/small-moves/"
hub(B, "Small moves: studio, one-bedroom, dorm and storage moves by the trip", "small moving service " + MN,
    ["small movers near me", "one item movers", "cheap studio apartment movers"],
    [B+"studio-apartment-move/", B+"one-bedroom-move/", B+"dorm-move/", B+"storage-unit-move/", "/pricing/cost-to-move-a-studio-apartment/", "/compare/boxhauls-vs-hiring-movers/"],
    "Per-trip vs hourly explained; what fits in one {{TIER_3}} load; helper add-on; multi-trip logic; what is not a small move; price examples; FAQs.")
for s, h1, q, note, ph in [
    ("studio-apartment-move", "Studio apartment move", "studio apartment movers", "1–2 trips, box counts, helper", 1),
    ("one-bedroom-move", "One-bedroom apartment move", "one bedroom apartment movers", "2 trips typical, when to add a second truck", 1),
    ("dorm-move", "Dorm move-in and move-out", "dorm movers " + MN, "{{UNIVERSITY}} dates, parking rules, mini-fridge and futon", 1),
    ("storage-unit-move", "Storage unit moves", "storage unit movers", "Unit sizes to loads, gate codes, hours", 1),
    ("senior-downsizing-move", "Senior downsizing moves", "senior downsizing movers", "Partial moves, donation drop-offs, patience", 2),
    ("small-office-move", "Small office moves", "small office movers", "Desks, chairs, after-hours, elevators", 2),
    ("last-minute-move", "Last-minute and same-day moves", "same day movers near me", "What can be done today, realistic limits", 2),
    ("in-building-move", "In-building and across-the-street moves", "movers for moving within same building", "Labor-only option, no truck needed pricing", 2),
]:
    spoke(B + s + "/", h1, q, [q + " " + MN], B, ["/pricing/"], note + ". Price example, FAQs.", ph)

C = "/services/appliance-delivery/"
hub(C, "Appliance delivery and haul-away", "appliance delivery service " + MN,
    ["appliance delivery near me", "refrigerator delivery service", "appliance haul away"],
    [C+"refrigerator/", C+"washer-and-dryer/", C+"dishwasher-and-range/", C+"haul-away/", "/pricing/cost-to-move-a-refrigerator/"],
    "Two-person handling standard; prep checklist (defrost, disconnect, strap doors); stairs and doorways; old-unit haul-away; what drivers do not do (gas/water hookups); tier fit; FAQs.")
for s, h1, q, note, ph in [
    ("refrigerator", "Refrigerator delivery", "refrigerator delivery service", "Upright only, defrost 24h, door removal for tight doorways", 1),
    ("washer-and-dryer", "Washer and dryer delivery", "washer dryer delivery service", "Shipping bolts, stacking kits, dryer vent note", 1),
    ("dishwasher-and-range", "Dishwasher and range delivery", "stove delivery service", "Disconnect by licensed pro, gas safety", 2),
    ("water-heater", "Water heater pickup and delivery", "water heater delivery", "Tank sizes, upright, plumber coordination", 2),
    ("freezer", "Chest and upright freezer delivery", "freezer delivery service", "Lay-flat rules, 24h rest before plugging in", 2),
    ("haul-away", "Old appliance haul-away and recycling", "appliance removal service", "Refrigerant rules, recycling fees, utility rebate programs in {{METRO}}", 1),
]:
    spoke(C + s + "/", h1, q, [q + " " + MN], C, ["/pricing/"], note + ". Price example, FAQs.", ph)

D = "/services/junk-removal/"
hub(D, "Junk removal and dump runs by the truckload", "junk removal " + MN,
    ["junk hauling near me", "dump run service", "cheap junk removal"],
    [D+"couch-disposal/", D+"mattress-disposal/", D+"garage-cleanout/", D+"dump-runs/", "/pricing/cost-of-a-dump-run/", f"/guides/dump-fees-in-{M}/"],
    "Per-load pricing with load-size photos; what is accepted / not accepted; how dump fees pass through; donation-first option; local transfer stations; FAQs.")
for s, h1, q, note, ph in [
    ("dump-runs", "Dump runs", "dump run service near me", "You load or we load, transfer station list, fee pass-through", 1),
    ("couch-disposal", "Couch disposal", "couch removal service", "Donation vs dump, {{METRO}} bulky-item rules", 1),
    ("mattress-disposal", "Mattress disposal", "mattress removal service", "Recycling programs, bag requirement, fees", 1),
    ("garage-cleanout", "Garage cleanouts", "garage cleanout service", "Sorting, hazmat exclusions, multi-load", 1),
    ("yard-waste-removal", "Yard waste removal", "yard waste removal service", "Green waste sites, bagging, branches length", 2),
    ("construction-debris-removal", "Construction debris removal", "construction debris removal", "Drywall, tile, weight limits per load, contractor accounts", 2),
    ("e-waste-and-electronics", "E-waste and electronics pickup", "electronics recycling pickup", "TVs, monitors, recycling fees, data note", 2),
    ("hot-tub-removal", "Hot tub removal", "hot tub removal service", "Cut vs whole, crew size, disposal fee", 2),
    ("estate-cleanout", "Estate cleanouts", "estate cleanout service", "Multi-day, donation coordination, sensitivity", 2),
    ("furniture-donation-pickup", "Furniture donation drop-off", "furniture donation pickup", "Which charities accept what in {{METRO}}, receipts", 2),
]:
    spoke(D + s + "/", h1, q, [q + " " + MN], D, ["/pricing/cost-of-a-dump-run/"], note + ". Price example, FAQs.", ph)

E = "/services/business-hauling/"
hub(E, "Business and jobsite hauling", "business delivery service pickup truck " + MN,
    ["jobsite delivery service", "pallet delivery local", "on demand delivery for contractors"],
    [E+"pallet-and-bulk-pickup/", E+"jobsite-material-runs/", E+"property-manager-turnovers/", E+"retail-last-mile/", "/partners/"],
    "Account setup, invoicing, recurring runs, who this is for (contractors, suppliers, property managers, retailers, restaurants), price model, FAQs.", 2)
for s, h1, q, note in [
    ("pallet-and-bulk-pickup", "Pallet and bulk pickup", "pallet pickup and delivery local", "Forklift-to-bed, weight per pallet, no liftgate"),
    ("jobsite-material-runs", "Jobsite material runs", "jobsite delivery service", "Supply-house pickup, overhang, same-day"),
    ("property-manager-turnovers", "Property manager unit turnovers", "property management hauling service", "Left-behind furniture, 48-hour turns, recurring accounts"),
    ("retail-last-mile", "Retail last-mile delivery", "last mile delivery for furniture stores", "How stores offer BoxHauls at checkout, partner program"),
    ("restaurant-and-office-equipment", "Restaurant and office equipment moves", "restaurant equipment movers", "Commercial fridges, desks, after-hours"),
]:
    spoke(E + s + "/", h1, q, [q + " " + MN], E, ["/partners/"], note + ". Price model, FAQs.", 2)

# ------------------------------------------------------------- CITIES
P(f"/cities/{M}/", f"Truck and driver on demand in {MN}", "truck delivery service " + MN,
  ["furniture delivery " + MN, "junk removal " + MN, "small movers " + MN, "dump run " + MN],
  ["/pricing/", "/services/furniture-delivery/", "/services/junk-removal/", "/services/small-moves/", f"/guides/dump-fees-in-{M}/", f"/drive/{M}/"],
  ["LocalBusiness", "Service", "FAQPage", "BreadcrumbList"],
  "MUST CONTAIN (no template filler): local transfer stations/landfills with address, hours, fees; the retailers drivers pick up from most with pickup-lane notes; {{METRO}} bulky-item pickup rules and gaps; {{UNIVERSITY}} move-in/out dates; apartment corridors; real driver profiles with photos; real reviews from {{METRO}}; pricing table from actual trips; coverage map. Neighborhood sub-pages only when trip volume justifies.",
  "cities", "hub", 1, "city")
P(f"/cities/{M}/{{{{neighborhood-slug}}}}/", "BoxHauls in {{NEIGHBORHOOD}}", "furniture delivery {{NEIGHBORHOOD}}",
  ["truck delivery {{NEIGHBORHOOD}}"], [f"/cities/{M}/"], ["LocalBusiness", "BreadcrumbList"],
  "OPTIONAL, phase 3, only with ≥20 completed trips in the neighborhood: local landmarks drivers use, parking/loading realities, nearest transfer station, real trips and reviews.",
  "cities", "spoke", 3, "city")

# ------------------------------------------------------------- COMPARE
P("/compare/", "BoxHauls vs. the alternatives", "best on demand truck delivery app", ["lugg alternatives", "apps like lugg"],
  ["/compare/boxhauls-vs-lugg/", "/compare/boxhauls-vs-dolly/", "/compare/boxhauls-vs-goshare/", "/compare/boxhauls-vs-uhaul-truck-rental/"], ORG,
  "Index with one-line verdict per comparison and a master table.", "compare", "hub", 2, "compare")
for slug, name, q in [
    ("lugg", "Lugg", "boxhauls vs lugg"), ("dolly", "Dolly", "boxhauls vs dolly"), ("goshare", "GoShare", "boxhauls vs goshare"),
    ("bungii", "Bungii", "boxhauls vs bungii"), ("taskrabbit", "TaskRabbit", "boxhauls vs taskrabbit"),
    ("truck-it", "Truck It", "boxhauls vs truck it app"), ("curri", "Curri", "boxhauls vs curri"),
    ("uhaul-truck-rental", "renting a U-Haul", "truck delivery service vs uhaul rental"),
    ("home-depot-truck-rental", "Home Depot truck rental", "home depot truck rental vs delivery service"),
    ("store-delivery", "store delivery", "store delivery vs pickup truck delivery service"),
    ("hiring-movers", "hiring movers", "movers vs truck and driver for one item"),
    ("borrowing-a-friends-truck", "borrowing a friend's truck", "is it worth borrowing a friends truck"),
]:
    P(f"/compare/boxhauls-vs-{slug}/", f"BoxHauls vs. {name}", q, [f"{name} alternative", f"{name} vs boxhauls"],
      ["/compare/", "/pricing/", "/trust/"], ORG + ["FAQPage"],
      "Side-by-side table on 8 criteria (price model, minimums, coverage, insurance, vetting, scheduling, helpers, app); where each wins; verdict by use-case; facts dated and sourced. Honest, including where the competitor wins.",
      "compare", "spoke", 2, "compare")

# ------------------------------------------------------------- GUIDES
P("/guides/", "Guides: moving big stuff without owning a truck", "how to move furniture without a truck",
  ["moving guides", "how to haul furniture"], ["/guides/will-it-fit-in-a-pickup-bed/", "/guides/how-to-move-a-couch-without-a-truck/"], ORG,
  "Index grouped by cluster with one-line summaries.", "guides", "hub", 2, "guide")
GUIDES = [
  # Fit & capacity (information-gain cluster)
  ("will-it-fit-in-a-pickup-bed", "Will it fit in a pickup bed? Dimensions for 40 common items", "will a couch fit in a truck bed", "/pricing/truck-sizes/", "fit", 1),
  ("will-a-sectional-fit-in-a-pickup", "Will a sectional fit in a pickup truck?", "sectional fit in truck bed", "/pricing/cost-to-move-a-sectional/", "fit", 2),
  ("will-a-king-mattress-fit-in-a-pickup", "Will a king mattress fit in a pickup truck?", "king mattress fit in truck bed", "/pricing/cost-to-move-a-mattress/", "fit", 2),
  ("will-a-refrigerator-fit-in-a-pickup", "Will a refrigerator fit in a pickup truck? (and can it lay down?)", "can you lay a refrigerator down in a truck", "/pricing/cost-to-move-a-refrigerator/", "fit", 2),
  ("will-a-washer-fit-in-a-pickup", "Will a washer and dryer fit in a pickup truck?", "washer dryer fit in truck bed", "/pricing/cost-to-move-a-washer-and-dryer/", "fit", 2),
  ("will-4x8-plywood-fit-in-a-pickup", "Will 4x8 plywood fit in a short-bed pickup?", "4x8 sheet fit in 5.5 ft bed", "/pricing/cost-to-deliver-plywood-and-lumber/", "fit", 2),
  ("pickup-truck-bed-sizes-explained", "Pickup truck bed sizes explained (5.5, 6.5, 8 ft)", "pickup truck bed sizes", "/pricing/truck-sizes/", "fit", 2),
  ("how-much-weight-can-a-pickup-carry", "How much weight can a pickup truck carry?", "how much weight can a half ton truck carry", "/pricing/truck-sizes/", "fit", 2),
  # How-to
  ("how-to-move-a-couch-without-a-truck", "How to move a couch without a truck", "how to move a couch without a truck", "/services/furniture-delivery/couch-delivery/", "howto", 1),
  ("how-to-move-a-refrigerator", "How to move a refrigerator (prep, transport, restart)", "how to move a refrigerator", "/services/appliance-delivery/refrigerator/", "howto", 2),
  ("how-to-move-a-washer-and-dryer", "How to move a washer and dryer without breaking them", "how to move a washing machine", "/services/appliance-delivery/washer-and-dryer/", "howto", 2),
  ("how-to-tie-down-a-load-in-a-pickup", "How to tie down a load in a pickup bed", "how to secure furniture in a truck bed", "/drive/equipment/", "howto", 2),
  ("how-to-move-a-mattress-without-getting-it-dirty", "How to move a mattress without getting it dirty", "how to transport a mattress in a truck", "/services/furniture-delivery/mattress-delivery/", "howto", 2),
  ("how-to-get-a-couch-up-stairs", "How to get a couch up stairs or through a tight doorway", "couch won't fit through door", "/services/furniture-delivery/couch-delivery/", "howto", 2),
  ("how-to-prep-appliances-for-transport", "How to prep appliances for transport", "prepare appliance for moving", "/services/appliance-delivery/", "howto", 2),
  ("how-to-wrap-furniture-for-a-truck", "How to wrap furniture for an open truck bed", "how to protect furniture in truck bed", "/services/furniture-delivery/", "howto", 2),
  ("how-to-load-a-pickup-bed", "How to load a pickup bed (weight, order, tailgate)", "how to load a pickup truck bed", "/pricing/truck-sizes/", "howto", 2),
  ("how-to-disassemble-a-bed-frame", "How to disassemble a bed frame for moving", "how to take apart a bed frame", "/pricing/cost-to-move-a-bed-frame/", "howto", 3),
  # Decision
  ("renting-a-truck-vs-hiring-a-truck-and-driver", "Renting a truck vs. hiring a truck and driver: the real all-in cost", "is it cheaper to rent a truck or hire delivery", "/compare/boxhauls-vs-uhaul-truck-rental/", "decision", 1),
  ("when-you-need-a-second-helper", "When you need a second helper (stairs, doorways, weight)", "do I need a helper to move a couch", "/pricing/fees/", "decision", 2),
  ("is-it-worth-hiring-delivery-for-one-item", "Is it worth hiring delivery for one item?", "cheapest way to move one piece of furniture", "/services/furniture-delivery/single-item-delivery/", "decision", 2),
  ("how-much-to-tip-a-truck-driver", "How much to tip a truck delivery driver", "how much to tip furniture delivery", "/how-it-works/", "decision", 2),
  ("movers-vs-truck-and-driver-for-a-studio", "Movers vs. a truck and driver for a studio apartment", "cheapest way to move a studio apartment", "/services/small-moves/studio-apartment-move/", "decision", 2),
  ("what-to-expect-from-a-boxhauls-driver", "What to expect from a BoxHauls driver", "what does a truck delivery driver do", "/trust/", "decision", 1),
  # Marketplace
  ("how-to-get-a-facebook-marketplace-purchase-home", "How to get a Facebook Marketplace purchase home safely", "how to pick up furniture from facebook marketplace", "/services/furniture-delivery/marketplace-pickup/facebook-marketplace/", "marketplace", 1),
  ("what-to-do-when-a-marketplace-seller-no-shows", "What to do when a Marketplace seller no-shows", "facebook marketplace seller didn't show up", "/services/furniture-delivery/marketplace-pickup/", "marketplace", 2),
  ("how-to-inspect-used-furniture-before-buying", "How to inspect used furniture before you buy it", "what to check when buying used couch", "/services/furniture-delivery/marketplace-pickup/", "marketplace", 2),
  ("how-to-pay-safely-on-marketplace-pickups", "How to pay safely on Marketplace pickups", "safest way to pay facebook marketplace", "/services/furniture-delivery/marketplace-pickup/", "marketplace", 3),
  # Retail
  ("ikea-flat-pack-vs-assembled", "IKEA flat-pack vs. assembled: what to buy if a pickup is bringing it home", "should I buy ikea furniture assembled", "/services/furniture-delivery/store-pickup/ikea/", "retail", 2),
  ("how-costco-warehouse-pickup-works", "How Costco warehouse pickup works for big items", "costco pickup large items", "/services/furniture-delivery/store-pickup/costco/", "retail", 2),
  ("getting-lumber-home-from-home-depot", "Getting lumber home from Home Depot without a truck", "how to transport lumber without a truck", "/services/furniture-delivery/store-pickup/home-depot/", "retail", 2),
  ("mattress-in-a-box-vs-traditional-delivery", "Mattress-in-a-box vs. traditional mattress delivery", "mattress in a box vs regular mattress delivery", "/services/furniture-delivery/mattress-delivery/", "retail", 3),
  # Local
  (f"dump-fees-in-{M}", f"Dump fees in {MN}: what the transfer stations charge", f"dump fees {MN}", f"/cities/{M}/", "local", 1),
  (f"bulky-item-pickup-in-{M}", f"What {MN}'s bulky-item pickup will and won't take", f"bulky item pickup {MN}", f"/cities/{M}/", "local", 1),
  (f"college-move-in-{M}", f"{{{{UNIVERSITY}}}} move-in and move-out: what fits in one truck", f"{{{{UNIVERSITY}}}} move in day tips", "/services/small-moves/dorm-move/", "local", 2),
  (f"where-to-donate-furniture-in-{M}", f"Where to donate furniture in {MN} (and who picks up)", f"donate furniture {MN}", "/services/junk-removal/furniture-donation-pickup/", "local", 2),
  (f"mattress-recycling-in-{M}", f"Mattress recycling in {MN}", f"mattress recycling {MN}", "/services/junk-removal/mattress-disposal/", "local", 2),
  # Scenarios
  ("storage-unit-run-in-one-trip", "Storage-unit runs: how to load it in one trip", "how to move storage unit", "/services/small-moves/storage-unit-move/", "scenario", 2),
  ("estate-cleanout-in-one-weekend", "Clearing out an estate in one weekend", "how to clean out a parents house", "/services/junk-removal/estate-cleanout/", "scenario", 2),
  ("apartment-turnover-in-48-hours", "Property managers: turning a unit in 48 hours", "apartment turnover checklist", "/services/business-hauling/property-manager-turnovers/", "scenario", 3),
  ("moving-out-of-a-dorm-in-one-trip", "Moving out of a dorm in one trip", "dorm move out tips", "/services/small-moves/dorm-move/", "scenario", 2),
  # Safety / trust
  ("what-to-do-if-an-item-is-damaged", "What to do if an item is damaged in delivery", "furniture damaged during delivery what to do", "/trust/damage-claims/", "trust", 1),
  ("delivery-insurance-explained", "Delivery insurance explained: cargo vs. liability", "does delivery insurance cover furniture", "/trust/insurance/", "trust", 2),
  # Seasonal (rotating)
  ("spring-cleanout-checklist", "Spring cleanout checklist", "spring garage cleanout checklist", "/services/junk-removal/garage-cleanout/", "seasonal", 3),
  ("holiday-furniture-delivery-tips", "Holiday furniture delivery: getting it there before guests arrive", "furniture delivery before christmas", "/services/furniture-delivery/", "seasonal", 3),
  ("college-move-out-week", "College move-out week: booking ahead", "when to book movers for college move out", "/services/small-moves/dorm-move/", "seasonal", 3),
]
for slug, h1, q, feeds, cl, ph in GUIDES:
    P(f"/guides/{slug}/", h1, q, [], ["/guides/", feeds], ["Article", "Person", "BreadcrumbList"] + (["HowTo"] if cl == "howto" else []),
      f"Cluster: {cl}. Answer in sentence one; named author with bio; real photos; consistent dimension/weight/price tables; exactly one descriptive-anchor link into {feeds}; 3 FAQs.",
      "guides", "spoke", ph, "guide")

# ------------------------------------------------------------- DRIVE
DR = "/drive/"
P(DR, "Drive for BoxHauls: get paid for your pickup truck", "make money with my pickup truck",
  ["pickup truck gigs", "hauling gigs near me", "drive for boxhauls"],
  [DR+"requirements/", DR+"earnings/", DR+"insurance-and-liability/", DR+"how-payouts-work/", f"/drive/{M}/", DR+"apply/"],
  ORG + ["JobPosting", "FAQPage"],
  "Driver-side hub. Earnings headline ({{DRIVER_SHARE}}% of fare + 100% tips); requirements summary; how jobs arrive; a real driver story; apply CTA. Never links to rider service pages.",
  "drive", "hub", 1, "driver")
for s, h1, q, note, ph in [
    ("requirements", "Driver requirements", "boxhauls driver requirements", "Truck year/condition, license, age, insurance minimums, background check, phone, straps/blankets", 1),
    ("earnings", "How much BoxHauls drivers make", "how much do truck delivery drivers make", "Payout math per tier with worked examples; per-hour realistic ranges; tips; busy times; fuel and wear considered honestly", 1),
    ("insurance-and-liability", "Driver insurance and liability", "gig hauling insurance", "What the platform covers when, what personal auto policies exclude, commercial add-on options", 1),
    ("how-payouts-work", "How payouts work", "boxhauls driver pay schedule", "Payout schedule, instant vs weekly, fees, tax forms", 1),
    ("taxes", "Taxes for gig haulers", "1099 truck delivery driver taxes", "1099 status, mileage vs actual expenses, deductible gear, quarterly estimates", 2),
    ("equipment", "Equipment every hauling driver should carry", "what equipment do I need for hauling gigs", "Ratchet straps, blankets, dolly, ramps, tarp, gloves; buy list with rough costs", 1),
    ("best-trucks-for-hauling-gigs", "Best trucks for hauling gigs", "best truck for gig hauling", "F-150 vs Tacoma vs 2500 vs trailer; bed length, payload, fuel economy tradeoffs", 2),
    ("ratings-and-tips", "Ratings, tips, and staying active", "boxhauls driver rating", "Rating threshold, how to earn tips, common deductions", 2),
    ("safety", "Driver safety", "safe practices for hauling gigs", "Lifting, meeting-point safety, weather, what to refuse", 1),
    ("faq", "Driver FAQ", "boxhauls driver faq", "Everything not owned elsewhere", 1),
    ("apply", "Apply to drive", "boxhauls driver application", "Form or app link, what happens next, timeline", 1),
]:
    P(DR + s + "/", h1, q, [], [DR], ORG + ["FAQPage"], note + ".", "drive", "spoke", ph, "driver")
P(f"/drive/{M}/", f"Drive for BoxHauls in {MN}", f"hauling gigs {MN}", [f"pickup truck jobs {MN}", f"make money with truck {MN}"],
  [DR, DR+"earnings/", DR+"apply/"], ORG + ["JobPosting"],
  "Where demand is, busiest zones and hours, local transfer stations, local retailer pickup lanes, real earnings examples from {{METRO}}.", "drive", "spoke", 1, "driver")
P(DR + "compare/boxhauls-vs-goshare-vs-lugg-vs-dolly-for-drivers/", "BoxHauls vs. GoShare vs. Lugg vs. Dolly for drivers",
  "goshare vs lugg vs dolly driver pay", ["best truck delivery app to drive for"], [DR, DR+"earnings/"], ORG + ["FAQPage"],
  "Driver-side comparison: payout %, minimums, vehicle rules, insurance, payout speed, markets. Honest.", "drive", "spoke", 2, "driver")
for slug, h1, q, ph in [
    ("how-to-strap-a-couch-in-a-pickup", "How to strap a couch in a pickup bed", "how to secure a couch in truck bed", 2),
    ("how-to-load-a-refrigerator-alone", "How to load a refrigerator with one person (and when not to)", "how to load a fridge into a truck by yourself", 2),
    ("handling-a-customer-no-show", "Handling a customer no-show", "what to do when delivery customer doesn't answer", 2),
    ("is-hauling-worth-it-for-my-truck", "Is gig hauling worth it for my truck? Fuel and wear math", "is gig hauling worth it", 2),
    ("tax-deductions-for-gig-haulers", "Tax deductions for gig haulers", "gig driver tax deductions truck", 3),
]:
    P(DR + "guides/" + slug + "/", h1, q, [], [DR, DR+"equipment/"], ["Article", "Person", "BreadcrumbList"],
      "Driver guide; answer-first; real photos; links only within /drive/.", "drive", "spoke", ph, "guide")

# ------------------------------------------------------------- PARTNERS
PR = "/partners/"
P(PR, "Offer BoxHauls delivery at your store", "offer delivery to customers without a truck",
  ["last mile delivery partner for furniture store", "delivery option for small retailers"],
  [PR+"for-furniture-stores/", PR+"for-appliance-dealers/", PR+"for-property-managers/", PR+"for-contractors-and-suppliers/", PR+"directory/", PR+"apply/", "/services/business-hauling/"],
  ORG + ["Service"],
  "How it works at checkout (QR / link / staff booking); what the customer pays; what the store gets (sales, no fleet); real partner logos only; apply. NO reciprocal-link language, no badges-for-links.",
  "partners", "hub", 2, "partners")
for s, h1, q in [
    ("for-furniture-stores", "For furniture and mattress stores", "furniture store delivery solution"),
    ("for-appliance-dealers", "For appliance dealers", "appliance store delivery partner"),
    ("for-property-managers", "For property managers", "property management hauling partner"),
    ("for-contractors-and-suppliers", "For contractors and supply houses", "supply house delivery partner"),
    ("for-thrift-stores", "For thrift stores and consignment shops", "thrift store delivery option"),
]:
    P(PR + s + "/", h1, q, [], [PR, PR+"apply/"], ORG + ["Service", "FAQPage"], "Vertical-specific pitch, checkout flow, pricing model, case example once available.", "partners", "spoke", 2, "partners")
P(PR + "directory/", "Stores that offer BoxHauls delivery", "stores with boxhauls delivery " + MN, [], [PR], ORG, "Real partner locations only, with address and hours. Empty state is fine. No links-for-links.", "partners", "utility", 2, "partners")
P(PR + "apply/", "Become a BoxHauls partner", "boxhauls partner application", [], [PR], ORG, "Form, what happens next.", "partners", "utility", 2, "partners")

# ------------------------------------------------------------- LEGAL / UTILITY
for u, h in [("/legal/terms/", "Terms of service"), ("/legal/privacy/", "Privacy policy"), ("/legal/driver-agreement/", "Driver agreement")]:
    P(u, h, "", [], [], ["BreadcrumbList"], "Legal. Indexable but no-follow in nav; plain text.", "legal", "utility", 1, "legal")

# =====================================================================
# REDIRECT MAP  (truck-n-go.com → boxhauls.com)
# =====================================================================
REDIRECTS = [
  ("/", "/"),
  ("/how-it-works", "/how-it-works/"),
  ("/pricing", "/pricing/"),
  ("/faq", "/faq/"),
  ("/contact", "/contact/"),
  ("/press", "/press/"),
  ("/drive", "/drive/"),
  ("/partners", "/partners/"),
  ("/link-to-us", "/press/"),
  ("/blog", "/guides/"),
  ("/blog/*", "/guides/  (map each post to its rewritten guide; else /guides/)"),
  ("/services/on-demand-moving-and-hauling", "/"),
  ("/services/furniture-delivery", "/services/furniture-delivery/"),
  ("/services/large-item-delivery", "/services/furniture-delivery/"),
  ("/services/move-furniture", "/services/furniture-delivery/"),
  ("/services/single-item-movers", "/services/furniture-delivery/single-item-delivery/"),
  ("/services/same-day-delivery", "/"),
  ("/services/local-hauling", "/"),
  ("/services/truck-and-driver-for-hire", "/"),
  ("/services/small-moves", "/services/small-moves/"),
  ("/services/junk-hauling", "/services/junk-removal/"),
  ("/cities", "/cities/"),
  (f"/cities/{M}", f"/cities/{M}/"),
  ("/cities/* (all other cities incl. Europe)", "/cities/  (301; do not recreate)"),
  ("/cost-to-move-a-couch", "/pricing/cost-to-move-a-couch/"),
  ("/cost-to-move-a-mattress", "/pricing/cost-to-move-a-mattress/"),
  ("/cost-to-move-a-refrigerator", "/pricing/cost-to-move-a-refrigerator/"),
  ("/cost-to-move-a-washer-and-dryer", "/pricing/cost-to-move-a-washer-and-dryer/"),
  ("/embed/moving-cost-calculator", "keep on new domain, noindex"),
  ("/auth, /account", "keep, noindex"),
]

# =====================================================================
# MARKDOWN EMITTERS
# =====================================================================
def esc(s): return s.replace("|", "\\|")

def table(headers, rows):
    out = ["| " + " | ".join(headers) + " |", "|" + "|".join("---" for _ in headers) + "|"]
    for r in rows: out.append("| " + " | ".join(esc(str(c)) for c in r) + " |")
    return "\n".join(out)

def pages_in(cluster, ptype=None, prefix=None):
    return [p for p in PAGES if p["cluster"] == cluster and (ptype is None or p["page_type"] == ptype) and (prefix is None or p["url"].startswith(prefix))]

def page_table(pages, cols=("url", "h1", "primary_query", "phase")):
    hdr = {"url": "URL", "h1": "H1", "primary_query": "Primary query", "secondary_queries": "Secondary queries", "phase": "Phase", "content_blocks": "Content blocks / attributes", "schema": "Schema", "links_to": "Links to"}
    rows = []
    for p in pages:
        r = []
        for c in cols:
            v = p[c]
            if isinstance(v, list): v = ", ".join(v)
            r.append(v)
        rows.append(r)
    return table([hdr[c] for c in cols], rows)

def tree():
    root = {}
    for p in PAGES:
        node = root
        for part in [x for x in p["url"].split("/") if x]:
            node = node.setdefault(part + "/", {})
    lines = ["/"]
    def walk(node, depth):
        for k in sorted(node):
            lines.append("  " * depth + k)
            walk(node[k], depth + 1)
    walk(root, 1)
    return "\n".join(lines)

# =====================================================================
# DOCUMENT
# =====================================================================
counts = {}
for p in PAGES: counts[p["cluster"]] = counts.get(p["cluster"], 0) + 1
by_phase = {}
for p in PAGES: by_phase[p["phase"]] = by_phase.get(p["phase"], 0) + 1

doc = []
w = doc.append

w(f"""# BoxHauls — Topical Map & Site Build Specification

**Brand:** BoxHauls  ·  **Domain:** boxhauls.com  ·  **Version:** 1.0  ·  **Prepared by:** Chris Szetela  ·  **Date:** August 25, 2026

This file is the single source of truth for the BoxHauls website. It defines what the business *is* to a search engine, every page the site will have, what each page must contain, how pages link, what structured data each carries, and the order to build them in. It is written to be dropped into a repository (`/docs/topical-map.md`) and read by Claude Code or any developer. A machine-readable version of the page inventory is in `sitemap.json`.

**Totals:** {len(PAGES)} pages across {len(counts)} sections — {', '.join(f'{k}: {v}' for k, v in sorted(counts.items()))}. By phase — Phase 1 (launch): {by_phase.get(1,0)} · Phase 2 (weeks 7–13): {by_phase.get(2,0)} · Phase 3 (month 4+): {by_phase.get(3,0)}.

---

## 0. How to use this file

1. Replace every `{{{{PLACEHOLDER}}}}` (Section 14) before generating any page. Do not build a page whose placeholders are unresolved.
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
| Legal entity | {{{{LEGAL_NAME}}}} |
| Domain | boxhauls.com (all lowercase in copy: boxhauls.com) |
| Central entity | An on-demand marketplace that dispatches a local pickup-truck owner to move one or a few large items between two addresses, priced per trip, with the price shown before booking. |
| Central search intent | "Get a truck and driver to move [large item] from A to B today, with the price up front." |
| Entity type (schema) | Organization (sitewide) + LocalBusiness/MovingCompany (real city pages only) + Service/Offer (service and pricing pages) |
| What BoxHauls is **not** | Not freight or LTL shipping. Not long-distance moving. Not dumpster rental. Not rideshare. Not a truck rental company. Not a labor-only mover. Say this on /about/ and never let content drift into those categories. |
| Positioning line | One truck. One trip. One price. |
| Secondary lines | "A truck, a driver, and a price — before you book." · "Doesn't fit in your car? It fits in ours." |
| Launch market | {{{{METRO}}}} only. Additional metros are added to this map when driver density is confirmed. |

### 1.1 Entity attributes (what Google must be able to read about BoxHauls)

| Attribute | Values | Where it lives |
|---|---|---|
| Services | furniture & large-item delivery · small moves · appliance delivery & haul-away · junk removal & dump runs · business & jobsite hauling | /services/ hubs, Service schema |
| Vehicle tiers | {{{{TIER_1}}}} (SUV / small bed) · {{{{TIER_2}}}} (standard half-ton, 5.5–6.5 ft bed) · {{{{TIER_3}}}} (3/4-ton, long bed, or trailer) | /pricing/truck-sizes/, tier picker, Offer schema |
| Pricing model | {{{{BASE_FARE}}}} base + {{{{PER_MILE}}}}/mile + item and helper fees; no hourly; no surge | /pricing/, /pricing/fees/, Offer.priceSpecification |
| Add-ons | helper ({{{{HELPER_FEE}}}}) · heavy item ({{{{HEAVY_FEE}}}}) · stairs · wait time · dump fee pass-through | /pricing/fees/ |
| Trust | cargo insurance ({{{{INSURANCE_CARRIER}}}}, {{{{COVERAGE_LIMIT}}}}) · background checks ({{{{BACKGROUND_PROVIDER}}}}) · vehicle inspection · damage-claim process · cancellation window | /trust/ cluster |
| Coverage | {{{{METRO}}}} metro; service radius {{{{RADIUS}}}} miles | /cities/{{{{metro-slug}}}}/, LocalBusiness.areaServed |
| Booking channels | iOS app · Android app · web | /app/, MobileApplication schema |
| Driver share | {{{{DRIVER_SHARE}}}}% of fare + 100% of tips | /drive/ only — never on rider pages |
| Founder | {{{{FOUNDER_NAME}}}} | /about/, Person schema |
| NAP | {{{{LEGAL_NAME}}}} · {{{{ADDRESS}}}} · {{{{PHONE}}}} — identical string on /contact/, footer, GBP, all citations | footer, /contact/, Organization schema |

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
{tree()}
```

Hierarchy rules: every URL has a trailing slash; every page has a BreadcrumbList that matches its path; no page is more than four levels deep; pricing pages live under /pricing/ (the current site has them at root — they move, with 301s).

---

## 4. Core section

The pages that capture booking intent or answer a trust question directly. All Phase 1.

{page_table(pages_in("core"), cols=("url", "h1", "primary_query", "content_blocks"))}

### 4.1 Title tag formulas

| Template | Title formula (≤ 60 chars where possible) |
|---|---|
| home | BoxHauls: Truck & Driver On Demand in {{{{METRO}}}} |
| core | {{H1}} \\| BoxHauls |
| pricing | How Much Does It Cost to Move a {{Item}}? ({{{{YEAR}}}}) \\| BoxHauls |
| service-hub | {{Service}} in {{{{METRO}}}}: Truck & Driver On Demand \\| BoxHauls |
| service-spoke | {{Spoke}} in {{{{METRO}}}} \\| BoxHauls |
| city | Truck & Driver On Demand in {{{{METRO}}}} \\| BoxHauls |
| compare | BoxHauls vs. {{Competitor}}: Price, Coverage, Insurance ({{{{YEAR}}}}) |
| guide | {{H1}} \\| BoxHauls Guides |
| driver | {{H1}} \\| Drive for BoxHauls |

Meta descriptions: 140–155 chars, state the answer or the price range, no "welcome to", no keyword lists.

---

## 5. Pricing cluster

The strongest content on the current site is the four "cost to move a ___" pages. This cluster scales that pattern. Every page follows the identical structure so the cluster reads as one authoritative source:

1. First sentence: the price range for the launch metro ("Most couch moves in {{{{METRO}}}} cost $X–$Y.").
2. The formula, restated.
3. Distance table: 3 mi / 10 mi / 25 mi with and without helper.
4. Item attributes table: dimensions, weight range, tier fit, helper required?, prep needed.
5. What drives the price up or down for this specific item.
6. 4–6 FAQs, question-first.
7. Book CTA with the item pre-selected.

{page_table(pages_in("pricing"), cols=("url", "primary_query", "content_blocks", "phase"))}

Cluster linking: every pricing page links up to /pricing/ and sideways to the two most related items (couch ↔ sectional ↔ mattress; refrigerator ↔ washer ↔ dishwasher; studio ↔ one-bedroom ↔ storage unit). /pricing/ links to every page in this cluster.

---

## 6. Service section

Five hubs. Each hub owns attributes the others do not. Each spoke targets one scenario. A spoke is only created when it has an attribute set the hub doesn't (a store's pickup lane, a platform's payment rule, an appliance's prep step). If two spokes could swap H1s, one is deleted.

### 6.1 Hub A — Furniture & Large-Item Delivery
Owns: store pickup, marketplace pickup, single-item / no-minimum, wrapping and protection, delivery windows, the "what we can't move" boundary.

{page_table(pages_in("services", prefix="/services/furniture-delivery/"), cols=("url", "h1", "primary_query", "phase"))}

### 6.2 Hub B — Small Moves
Owns: per-trip vs hourly, one-load capacity, helper add-on, multi-trip logic.

{page_table(pages_in("services", prefix="/services/small-moves/"), cols=("url", "h1", "primary_query", "phase"))}

### 6.3 Hub C — Appliance Delivery & Haul-Away
Owns: two-person handling, prep (defrost/disconnect/strap), doorways and stairs, old-unit removal, what drivers do not do (hookups).

{page_table(pages_in("services", prefix="/services/appliance-delivery/"), cols=("url", "h1", "primary_query", "phase"))}

### 6.4 Hub D — Junk Removal & Dump Runs
Owns: per-load pricing, accepted/not-accepted, dump-fee pass-through, donation-first, local transfer-station knowledge.

{page_table(pages_in("services", prefix="/services/junk-removal/"), cols=("url", "h1", "primary_query", "phase"))}

### 6.5 Hub E — Business & Jobsite Hauling
Owns: accounts, invoicing, recurring runs, pallets, turnovers, last-mile for retailers.

{page_table(pages_in("services", prefix="/services/business-hauling/"), cols=("url", "h1", "primary_query", "phase"))}

### 6.6 City pages — gated

A city page is created only when all of the following are true: (a) ≥ {{{{MIN_ACTIVE_DRIVERS}}}} active drivers in the metro, (b) a real, verifiable address or service-area anchor for Google Business Profile, (c) a human has written the local blocks listed below. It is never generated from a template and never quotes the global formula as "local pricing."

{page_table(pages_in("cities"), cols=("url", "h1", "primary_query", "content_blocks"))}

**City × service pages** (e.g. /cities/{{{{metro-slug}}}}/ikea-delivery/) are **not** in this map. If demand data later justifies them, they are added one at a time with the same local-content gate, capped at five per metro, and each must contain content that the service hub does not (local store address, local price table from real trips, local reviews). Absent that, the service hub already ranks for "{{service}} {{metro}}" because the hub states the metro and the city page links to it.

---

## 7. Compare cluster

Someone searching a competitor's name next to yours is one step from booking. Each page is an honest side-by-side. Where the competitor wins, say so — that credibility is what makes the verdict believable.

Criteria table on every page (same order): price model · minimum charge · coverage in {{{{METRO}}}} · cargo insurance · driver vetting · scheduling (on-demand vs window) · helpers · app quality. Facts are dated and sourced; refresh quarterly.

{page_table(pages_in("compare"), cols=("url", "h1", "primary_query", "phase"))}

---

## 8. Guides (outer section)

Guides exist to answer the question *around* a haul and to send authority into the core. Each guide has exactly one inward link with a descriptive anchor into the core page listed under "Links to." Guides never link to /drive/.

Clusters: **fit** (dimension tables — the information-gain cluster nobody else does well) · **howto** · **decision** · **marketplace** · **retail** · **local** · **scenario** · **trust** · **seasonal**.

{page_table(pages_in("guides"), cols=("url", "h1", "primary_query", "links_to", "phase"))}

---

## 9. Content standards (every page)

1. **Answer first.** The first sentence of the first paragraph answers the primary query with a number, a yes/no, or a definition. No throat-clearing.
2. **One page, one intent.** The primary query in this map is the only query the page is optimized for. Secondary queries are covered by sections, not by a second H1-style heading.
3. **Attributes, not adjectives.** State bed length in inches, weight in pounds, price in dollars, time in minutes. "Spacious" is not an attribute.
4. **Consistent tables.** Dimensions are always L × W × H in inches. Weight is always a range in lb. Prices are always for {{{{METRO}}}} unless labeled. Same column order on every page in a cluster.
5. **Entity vocabulary.** Use "truck and driver," "haul," "trip," "tier," "helper," "pickup," "drop-off." Never "logistics," "solution," "on-demand ecosystem," "cargo," "freight," "buddy with a truck" (Truxx), "friend with a truck" (GoShare trademark), or "too big for my car" (existing company).
6. **Real media only.** Photos are real hauls, real drivers, real trucks in {{{{METRO}}}}, with descriptive alt text ("driver strapping a grey sectional into a half-ton bed in {{{{NEIGHBORHOOD}}}}"). No stock, no AI imagery, no build-tool screenshots.
7. **FAQ format.** Question as an H3 in the user's words; answer in 2–4 sentences; first sentence is the answer. FAQPage schema mirrors the on-page text exactly.
8. **Authorship.** Guides carry a named author with a one-line bio and a Person entity. Service and pricing pages are authored by "BoxHauls" with a "Reviewed by {{{{FOUNDER_NAME}}}}" line.
9. **Dates.** Pricing, compare, and local pages show a "Prices/facts checked {{month year}}" line and are reviewed quarterly.
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
| In-body links | 3–8 per page, in sentences, with descriptive anchors that name the destination's topic ("what a couch move costs in {{{{METRO}}}}", "how the damage-claim process works"). Never "click here," "learn more," or a bare brand name as anchor. |
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

All JSON-LD is server-rendered in the initial HTML. One `@graph` per page containing the types below. IDs use `https://boxhauls.com/#organization`, `https://boxhauls.com{{url}}#webpage`, etc.

| Type | Where | Required properties |
|---|---|---|
| Organization | every page (@id #organization) | name "BoxHauls", legalName, url, logo, telephone, address (PostalAddress), founder (Person), sameAs [Instagram, TikTok, Facebook, X, LinkedIn, App Store, Google Play], contactPoint |
| WebSite | / | name, url, publisher → #organization |
| LocalBusiness (MovingCompany) | /cities/{{metro}}/ only | name, address, telephone, areaServed (City + radius), openingHours, priceRange, geo, hasOfferCatalog → services |
| Service | service hubs & spokes, pricing pages | name, serviceType, provider → #organization, areaServed, offers → Offer |
| Offer + PriceSpecification | pricing pages, /pricing/ | price or priceRange (minPrice/maxPrice), priceCurrency USD, eligibleRegion |
| FAQPage | any page with an FAQ block | mainEntity Question/Answer mirroring on-page text |
| HowTo | /how-it-works/, howto guides, /trust/damage-claims/ | name, step[] with name + text |
| Article | guides, driver guides | headline, author (Person), datePublished, dateModified, image, publisher → #organization |
| Person | /about/, guide authors | name, jobTitle, image, sameAs |
| BreadcrumbList | every page | itemListElement mirroring URL path |
| MobileApplication | /app/ | name, operatingSystem, applicationCategory, offers (free), aggregateRating only when real |
| JobPosting | /drive/, /drive/{{metro}}/ | title, description, hiringOrganization, jobLocation, employmentType CONTRACTOR, baseSalary (range, only if publishable) |
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

{table(["Old URL (truck-n-go.com)", "New URL (boxhauls.com)"], REDIRECTS)}

---

## 13. Build phases

| Phase | Timing | Scope | Gate to next phase |
|---|---|---|---|
| 0 | Weeks 1–2 | Placeholders resolved (Section 14); launch metro confirmed; old site: remove placeholder social proof, noindex all /cities/* and duplicate service pages; GBP address established; Search Console on both domains | All Section 14 values filled; GBP verification submitted |
| 1 | Weeks 3–7 | All Phase-1 pages ({by_phase.get(1,0)}): core, four migrated pricing pages + dump run, five hubs with Phase-1 spokes, launch city page, /drive/ Phase-1 pages, legal; schema; sitemap; redirects live; domain cutover | Every Phase-1 page passes Section 9 checklist; CWV green on mobile; zero orphans |
| 2 | Weeks 7–13 | Phase-2 pages ({by_phase.get(2,0)}): remaining pricing items, retailer and marketplace spokes, remaining service spokes, compare cluster, guides (2/week), /partners/, driver compare + guides, Spanish /es/ for /drive/ and core pages | 20+ real Google reviews; 5 real partners in directory; compare facts dated |
| 3 | Month 4+ | Phase-3 pages ({by_phase.get(3,0)}): real-trip pricing data page, neighborhood pages (gated, Clovis first), seasonal guides, second metro (copy of Section 6.6 gate) | Second metro meets Section 6.6 gate |

Publishing cadence in Phase 2: two guides per week, one compare page per week, retailer spokes in the order of local store proximity to the metro center.

---

## 14. Placeholders to resolve before building

| Placeholder | Meaning | Example |
|---|---|---|
| `{{{{LEGAL_NAME}}}}` | Registered entity name | BoxHauls, LLC |
| `{{{{FOUNDER_NAME}}}}` | Real name for /about/ and "Reviewed by" | John … |
| `{{{{METRO}}}}` / `{{{{metro-slug}}}}` | Launch metro display name / URL slug | Albuquerque / albuquerque |
| `{{{{NEIGHBORHOOD}}}}` / `{{{{neighborhood-slug}}}}` | Only when Section 6.6 gate is met | Nob Hill / nob-hill |
| `{{{{UNIVERSITY}}}}` | Largest campus in the metro for dorm content | University of New Mexico |
| `{{{{ADDRESS}}}}` | Real, GBP-verifiable address (may be hidden as SAB) | — |
| `{{{{PHONE}}}}` | One number, local to the metro | (505) … |
| `{{{{RADIUS}}}}` | Service radius in miles | 30 |
| `{{{{TIER_1}}}}` `{{{{TIER_2}}}}` `{{{{TIER_3}}}}` | Tier names (current site: Box Run / standard pickup / heavy hauler — confirm) | Box Run / Half-Ton / Heavy Hauler |
| `{{{{BASE_FARE}}}}` `{{{{PER_MILE}}}}` | Pricing formula constants | $39 / $2.10 |
| `{{{{HEAVY_FEE}}}}` `{{{{HELPER_FEE}}}}` | Current site shows $29 / $28 — confirm | — |
| `{{{{MAX_ITEM_WEIGHT}}}}` `{{{{MAX_SAFE_WEIGHT}}}}` | Hard limits for the "what we can't move" boundary | 400 lb / 600 lb |
| `{{{{INSURANCE_CARRIER}}}}` `{{{{COVERAGE_LIMIT}}}}` | Publishable insurance facts | — |
| `{{{{BACKGROUND_PROVIDER}}}}` | Vetting vendor | Checkr |
| `{{{{DRIVER_SHARE}}}}` | Driver payout percentage | 82 |
| `{{{{MIN_ACTIVE_DRIVERS}}}}` | Gate for creating a city page | 15 |
| `{{{{YEAR}}}}` | Current year for title tags | 2026 |

---

## 15. Query network summary (what the whole map is built to win)

| Query family | Example | Owned by |
|---|---|---|
| Brand | boxhauls, boxhauls app, boxhauls reviews, is boxhauls legit | /, /app/, /reviews/, /trust/ |
| Category + metro | truck delivery {{metro}}, furniture delivery {{metro}}, junk removal {{metro}} | /cities/{{metro}}/ + hubs |
| Item + cost | cost to move a couch, refrigerator delivery cost | /pricing/ cluster |
| Item + fit | will a sectional fit in a pickup | /guides/ fit cluster |
| Store + delivery | ikea pickup and delivery, costco delivery alternative | store-pickup spokes |
| Platform + pickup | facebook marketplace delivery, craigslist pickup service | marketplace spokes |
| Scenario | studio apartment movers, dump run near me, dorm movers | small-moves / junk spokes |
| Competitor | boxhauls vs lugg, lugg alternative, uhaul vs delivery service | /compare/ |
| Trust | is my furniture insured during delivery, what if furniture is damaged | /trust/ cluster |
| Driver | make money with my pickup truck, hauling gigs {{metro}} | /drive/ |
| Partner | delivery option for furniture store, last mile partner | /partners/ |

---

## 16. Launch market addendum — Fresno / Clovis

Resolved values: `{{{{METRO}}}}` = Fresno · `{{{{metro-slug}}}}` = fresno · `{{{{UNIVERSITY}}}}` = Fresno State · `{{{{RADIUS}}}}` = 25 · base address in Clovis, CA (Google Business Profile as a service-area business; hide the address if residential). "Fresno" is the head term; "Clovis" is the first neighborhood page under /cities/fresno/ once the trip-count gate is met.

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
""")

md = "\n".join(doc)
DOCS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "docs")
open(os.path.join(DOCS, "topical-map.md"), "w").write(md)
json.dump({"brand": "BoxHauls", "domain": "boxhauls.com", "version": "1.0", "pages": PAGES, "redirects": [{"from": a, "to": b} for a, b in REDIRECTS]},
          open(os.path.join(DOCS, "sitemap.json"), "w"), indent=2)
print(f"pages={len(PAGES)} md_chars={len(md)}")
print(json.dumps(counts, indent=1)); print(by_phase)
