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
