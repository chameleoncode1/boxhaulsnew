# Cloudflare setup

`scripts/cloudflare.mjs` writes three files from `docs/sitemap.json` after every build. Never edit them by hand.

| File | What it does | How it goes live |
|---|---|---|
| `dist/_redirects` | Old truck-n-go paths that might be linked on boxhauls.com (for example `/cost-to-move-a-couch`) → new URLs | Deployed automatically with the site |
| `dist/_headers` | `noindex` on app routes (`/book/`, `/embed/`, `/auth`, `/account`, `/api/`), plus cache and security headers | Deployed automatically with the site |
| `deploy/cloudflare/bulk-redirects-1-exact.csv`, `-2-sections.csv`, `-3-catchall.csv` | truck-n-go.com → boxhauls.com map (map Section 12.1), www.boxhauls.com → boxhauls.com, and every other truck-n-go.com path → the homepage | Uploaded once in the dashboard (below) |

## Why two redirect mechanisms

Cloudflare `_redirects` matches **paths only**; it can't see the hostname. So a rule like `truck-n-go.com/pricing → boxhauls.com/pricing/` or `www → apex` can't go in `_redirects`. Those need **Bulk Redirects**, which work at the account level on any proxied domain.

`_redirects` also leaves out the `/cities/*` catch-all, because it would intercept the real `/cities/fresno/` page. That rule exists only in the CSV, scoped to truck-n-go.com.

## Upload the bulk redirects (one-time, and again whenever a CSV changes)

The rules are split into three lists because Bulk Redirect **rules** run in order and stop at the first match, while matching *inside* one list is not guaranteed to prefer the most specific URL. Splitting makes the precedence explicit: an exact path beats its section, and a section beats the catch-all.

| Order | List name | File | What it holds |
|---|---|---|---|
| 1 | `boxhauls-1-exact` | `bulk-redirects-1-exact.csv` | Every mapped old path, with and without a trailing slash; www → apex |
| 2 | `boxhauls-2-sections` | `bulk-redirects-2-sections.csv` | `/blog/*` → `/guides/`, `/cities/*` → `/cities/` |
| 3 | `boxhauls-3-catchall` | `bulk-redirects-3-catchall.csv` | Any other truck-n-go.com path → `https://boxhauls.com/` |

1. Cloudflare dashboard → **Bulk Redirects** → **Create Bulk Redirect List**. Create the three lists above, importing one CSV into each. The CSVs have no header row. Columns, in order: `source_url, target_url, status_code, preserve_query_string, include_subdomains, subpath_matching, preserve_path_suffix`.
2. Create three **Bulk Redirect Rules**, one per list, and order them 1 → 2 → 3. Enable all three.
3. `truck-n-go.com` and `www.boxhauls.com` must both have proxied (orange-cloud) DNS records, or Cloudflare never sees the requests.
4. Keep truck-n-go.com live and redirecting for at least 12 months (map Section 12).

## Verify after cutover

These `curl` checks are repeated in `docs/LAUNCH.md` (Prompt 5).

```bash
curl -sI https://www.boxhauls.com/pricing/ | grep -i '^location'          # → https://boxhauls.com/pricing/
curl -sI https://truck-n-go.com/cost-to-move-a-couch | grep -i '^location'  # → /pricing/cost-to-move-a-couch/
curl -sI https://truck-n-go.com/cities/fresno | grep -i '^location'         # → /cities/fresno/ (exact beats section)
curl -sI https://truck-n-go.com/cities/london | grep -i '^location'         # → /cities/
curl -sI https://truck-n-go.com/blog/some-post | grep -i '^location'        # → /guides/
curl -sI https://truck-n-go.com/anything-else | grep -i '^location'         # → https://boxhauls.com/ (catch-all)
```

## Booking backend

The booking widget (`/` and `/book/`) and the driver job page (`/drive/accept/`) use Pages Functions in `functions/api/`, plus one scheduled Worker:

| Piece | What it does |
|---|---|
| `POST /api/places` | Address suggestions from Google Places API (New), limited to the service area |
| `POST /api/quote` | Looks up both places, checks both are within `RADIUS` miles of `SERVICE_CENTER`, gets driving miles from the Google Routes API, prices the trip from `docs/placeholders.json`, and returns a signed quote that's valid for 30 minutes |
| `POST /api/book` | Verifies the quote and validates details. Refuses the booking if texting isn't set up or no driver qualifies. Otherwise it saves the booking to D1 and **auto-dispatches** |
| `POST /api/offer`, `/api/accept` | What a driver sees from their link, and accepting it. The first accept wins (an atomic update) |
| `workers/dispatch-cron` | Runs every 5 minutes. Bookings nobody accepted by their deadline become `unfilled`, and the customer gets a text |

### How dispatch works (no one needs to follow up)

1. **The booking is saved.** Every **active** driver gets a text with their own accept link. Helper-requested jobs only go to drivers marked `--helper`. The text shows the item, the cities, miles, time and the driver's pay (`DRIVER_SHARE` of the fare), but no customer details.
2. **The customer is texted** that the request was received and drivers are being contacted.
3. **The first driver to accept is assigned.** That driver gets the full addresses, customer name, phone and notes. The customer gets the driver's first name and phone number. Anyone who taps later sees "already accepted".
4. **If nobody accepts by the deadline,** the booking becomes `unfilled` and the customer gets a text with the office number. The deadline is 30 minutes for ASAP (`DISPATCH_ASAP_MINUTES`); for scheduled trips it's 2 hours before the window starts (`DISPATCH_SCHEDULED_LEAD_HOURS`).
5. **If no active driver qualifies,** the site doesn't take the booking at all. It shows the office number.

No payment is taken online. The Google key and Twilio credentials live only on Cloudflare's servers.

### One-time setup

**1. Google Maps key.** In the [Google Cloud console](https://console.cloud.google.com/):

- Create a project and attach billing (Google gives a monthly free credit).
- Enable **Places API (New)** and **Routes API**.
- Create an API key, and restrict it to those two APIs. Leave **Application restrictions** as *None*; the calls come from Cloudflare's servers.
- Add a budget alert and daily quotas.

**2. Twilio, for texts.** In [Twilio](https://www.twilio.com/):

- Create an account, then buy a number, or set up a Messaging Service.
- **US carriers require registration before an app can text people.** Either register for **A2P 10DLC** (a brand plus a "customer care / delivery notifications" campaign) for a local 10-digit number, or **verify a toll-free number**. Messages can be blocked until this is approved, which can take several days. Start early.
- Note your **Account SID** (AC…), **Auth Token**, and the number (+1…) or Messaging Service SID (MG…).
- Twilio handles STOP/HELP replies on its numbers. The booking form tells customers they'll get texts, and that they can reply STOP.

**3. Store the secrets.** Run this yourself:

```bash
bash scripts/setup-secrets.sh
```

It stores the Google key, generates `QUOTE_SECRET`, and stores the Twilio credentials. Those go on both the Pages project and the dispatch Worker. It can also store the optional email token. Input is hidden.

**4. Add your drivers.** Only add approved drivers who have agreed to receive job texts:

```bash
npm run drivers -- add "Maria Lopez" 559-555-0123 --helper
```

```bash
npm run drivers -- list
```

Other commands: `helper DRV-ABCD on|off`, `deactivate DRV-ABCD` and `activate DRV-ABCD`.

**5. Deploy both pieces:**

```bash
npm run deploy
```

```bash
npm run deploy:cron
```

Until steps 1–4 are done, the widget doesn't take bookings. It shows "Online booking is unavailable right now. Call (559) 628-2794 to book."

### At cutover to boxhauls.com

Change `PUBLIC_SITE_URL` to `https://boxhauls.com` in **both** `wrangler.toml` and `workers/dispatch-cron/wrangler.toml`, so driver links point at the real domain. Then redeploy both.

### Booking emails (optional)

Texts handle dispatch. Email is an extra copy for the office, plus a receipt for the customer. To turn it on:

1. Onboard boxhauls.com to **Cloudflare Email Sending** (`npx wrangler email sending enable boxhauls.com`, or use the Dashboard).
2. Store an API token with **Email Sending: Edit** permission as `CF_EMAIL_API_TOKEN`.

### See bookings

```bash
npm run bookings
```

This shows the 25 most recent bookings: status (`dispatching`, `assigned`, `unfilled`, `canceled`, `completed`), the assigned driver, and whether the customer was texted.

### Abuse protection

- The API only answers requests from boxhauls.com or this Pages project.
- Bookings are capped at 5 per connection per hour. IPs are stored only as salted hashes.
- Quotes are HMAC-signed. Accept links are random 24-byte tokens, and only their hashes are stored.
- **Before launch:** add a Cloudflare **WAF rate-limiting rule** for `/api/*`, for example 60 requests per minute per IP, and consider **Turnstile** on the booking step.

### Local development

`.dev.vars` (gitignored) sets `DEV_MOCK_MAPS=1`, `DEV_MOCK_SMS=1`, a local `QUOTE_SECRET` and `PUBLIC_SITE_URL=http://127.0.0.1:8788`. That gives fake addresses and logs texts to the console instead of sending them:

```bash
npx wrangler d1 migrations apply boxhauls-bookings --local
```

```bash
npm run drivers -- add "Test Driver" 559-555-0101 --local
```

```bash
npm run build && npx wrangler pages dev dist
```
