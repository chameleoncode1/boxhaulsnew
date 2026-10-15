/**
 * Canonical host. boxhauls.com is the only public address: requests to www.boxhauls.com and to the
 * production preview host (boxhaulsnew.pages.dev) get a 301 to the same path on boxhauls.com.
 * Exceptions: /api/* (Stripe webhooks and texted links must never be redirected; Stripe doesn't follow
 * redirects) and per-deployment preview hosts (<hash>.boxhaulsnew.pages.dev), which stay reachable for testing.
 */
const CANONICAL = 'boxhauls.com';
const REDIRECT_HOSTS = new Set(['www.boxhauls.com', 'boxhaulsnew.pages.dev']);

export const onRequest: PagesFunction = async ({ request, next }) => {
  const url = new URL(request.url);
  if (REDIRECT_HOSTS.has(url.hostname) && !url.pathname.startsWith('/api/')) {
    url.hostname = CANONICAL;
    url.protocol = 'https:';
    url.port = '';
    return Response.redirect(url.toString(), 301);
  }
  return next();
};
