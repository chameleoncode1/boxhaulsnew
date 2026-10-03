# Cloudflare setup

`scripts/cloudflare.mjs` writes three files from `docs/sitemap.json` after every build. Never edit them by hand.

| File | What it does | How it goes live |
|---|---|---|
| `dist/_redirects` | Old truck-n-go paths that might be linked on boxhauls.com (for example `/cost-to-move-a-couch`) → new URLs | Deployed automatically with the site |
| `dist/_headers` | `noindex` on app routes (`/book/`, `/embed/`, `/auth`, `/account`, `/api/`), plus cache and security headers | Deployed automatically with the site |
| `deploy/cloudflare/bulk-redirects.csv` | truck-n-go.com → boxhauls.com map (map Section 12.1) and www.boxhauls.com → boxhauls.com | Uploaded once in the dashboard (below) |

## Why two redirect mechanisms

Cloudflare `_redirects` matches **paths only**; it can't see the hostname. So a rule like `truck-n-go.com/pricing → boxhauls.com/pricing/` or `www → apex` can't go in `_redirects`. Those need **Bulk Redirects**, which work at the account level on any proxied domain.

`_redirects` also leaves out the `/cities/*` catch-all, because it would intercept the real `/cities/fresno/` page. That rule exists only in the CSV, scoped to truck-n-go.com.

## Upload the bulk redirects (one-time, and again whenever the CSV changes)

1. Cloudflare dashboard → **Bulk Redirects** → **Create Bulk Redirect List** → name it `boxhauls-redirects`.
2. Import `deploy/cloudflare/bulk-redirects.csv`. It has no header row. Columns, in order: `source_url, target_url, status_code, preserve_query_string, include_subdomains, subpath_matching, preserve_path_suffix`.
3. Create a **Bulk Redirect Rule** that uses the list, then enable it.
4. Both `truck-n-go.com` and `www.boxhauls.com` must have proxied (orange-cloud) DNS records, or Cloudflare never sees the requests.
5. Keep truck-n-go.com live and redirecting for at least 12 months (map Section 12).

## Verify after cutover

These `curl` checks are repeated in `docs/LAUNCH.md` (Prompt 5).

```bash
curl -sI https://www.boxhauls.com/pricing/ | grep -i '^location'
curl -sI https://truck-n-go.com/cost-to-move-a-couch | grep -i '^location'
curl -sI https://truck-n-go.com/cities/fresno | grep -i '^location'
curl -sI https://truck-n-go.com/cities/london | grep -i '^location'
curl -sI https://truck-n-go.com/blog/some-post | grep -i '^location'
```

**Check the third and fourth lines specifically.** `/cities/fresno` has its own exact rule, and `/cities/*` is a subpath rule. Confirm the exact rule wins, so `/cities/fresno` lands on `/cities/fresno/` and not `/cities/`. If it doesn't, move the subpath rule into a separate, lower-priority list.

## Not covered by the map

Any truck-n-go.com path that isn't in the map has no rule, so it will hit whatever the old domain serves (probably a 404). If you want everything else to go to the homepage, add `truck-n-go.com/` with subpath matching as a catch-all, but only after confirming the precedence behavior above.
