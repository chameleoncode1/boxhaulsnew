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

The site's booking widget (`/` and `/book/`) talks to three Pages Functions in `functions/api/`:

| Endpoint | What it does |
|---|---|
| `POST /api/places` | Address suggestions from Google Places API (New), limited to the service area |
| `POST /api/quote` | Looks up both places, checks both are within `RADIUS` miles of `SERVICE_CENTER`, gets driving miles from the Google Routes API, prices the trip from `docs/placeholders.json`, and returns a signed quote that's valid for 30 minutes |
| `POST /api/book` | Verifies the signed quote, validates contact details and timing, rate-limits to 5 bookings per connection per hour, saves the booking to D1 (`boxhauls-bookings`), and emails BoxHauls plus a receipt to the customer when email is configured |

No payment is taken online. The Google key lives only on the server and is never sent to browsers.

### One-time setup

**1. Google Maps key.** In the [Google Cloud console](https://console.cloud.google.com/):

- Create a project and attach a billing account. Google gives a monthly free credit.
- Enable **Places API (New)** and **Routes API**.
- Go to **Credentials → Create credentials → API key**.
- Under **API restrictions**, restrict the key to *Places API (New)* and *Routes API*. Leave **Application restrictions** as *None*; the key is used from Cloudflare's servers, whose IPs vary.
- Set a budget alert, plus daily quotas on both APIs, so abuse can't run up a bill.

**2. Store the secrets.** Run this yourself in a terminal:

```bash
bash scripts/setup-secrets.sh
```

It stores `GOOGLE_MAPS_API_KEY`, generates `QUOTE_SECRET`, and optionally stores `CF_EMAIL_API_TOKEN`. Input is hidden and goes straight to Cloudflare.

**3. Deploy.** Pages applies secrets at the next deployment:

```bash
npm run deploy
```

Until the key and `QUOTE_SECRET` are set, the widget doesn't show a price. It shows "Online booking is unavailable right now. Call (559) 628-2794 to book."

### Booking alert emails (optional)

Bookings are always saved. Emails go out only when both of these are true:

1. boxhauls.com is onboarded to **Cloudflare Email Sending**: Dashboard → Email → Email Sending, or `npx wrangler email sending enable boxhauls.com`. The zone has to be on this Cloudflare account.
2. An API token with **Email Sending: Edit** permission is stored as `CF_EMAIL_API_TOKEN` (step 2 above).

The alert goes to `BOOKING_ALERT_TO` (support@boxhauls.com) from `BOOKING_EMAIL_FROM` (bookings@boxhauls.com). Both are set in `wrangler.toml`. Each booking's `alert_status` column records whether the alert was `sent`, `skipped` (email isn't configured) or `failed`.

### See bookings

```bash
npm run bookings
```

Prints the 25 most recent bookings from the live D1 database. To mark a booking's status (`new`, `confirmed`, `completed`, `canceled`):

```bash
npx wrangler d1 execute boxhauls-bookings --remote --command "UPDATE bookings SET status='confirmed' WHERE id='BH-XXXXXX'"
```

### Abuse protection

- The API only answers requests whose `Origin` is boxhauls.com or this Pages project.
- Bookings are capped at 5 per connection per hour. IPs are stored only as salted hashes.
- Quotes are HMAC-signed, so a booked price can't be edited in the browser.
- **Before launch:** add a Cloudflare **WAF rate-limiting rule** for `/api/places` and `/api/quote`, for example 60 requests per minute per IP. Consider adding **Turnstile** to the booking step.

### Local development

`.dev.vars` (gitignored) holds `DEV_MOCK_MAPS=1` and a local `QUOTE_SECRET`. That gives fake test addresses and straight-line distance × 1.3, so the whole flow runs without Google:

```bash
npx wrangler d1 migrations apply boxhauls-bookings --local
```

```bash
npm run build && npx wrangler pages dev dist
```
