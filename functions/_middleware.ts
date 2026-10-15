/**
 * Hosts.
 * - boxhauls.com is the customer site and app. www.boxhauls.com and the production preview host
 *   (boxhaulsnew.pages.dev) 301 to the same path on boxhauls.com.
 * - driver.boxhauls.com is BoxHauls Driver: every page request is served from /driver-app/ (its own manifest,
 *   service worker and icons, so phones install it as a separate app). /api/*, /_astro/* and /brand/* are shared.
 *   Never indexed. boxhauls.com/driver-app/* redirects there.
 * Exceptions: /api/* is never redirected (Stripe webhooks don't follow redirects, and texted links must keep working),
 * and per-deployment preview hosts (<hash>.boxhaulsnew.pages.dev) stay reachable for testing, including /driver-app/.
 */
import type { Env } from './_lib/env';

const CANONICAL = 'boxhauls.com';
const DRIVER_HOST = 'driver.boxhauls.com';
const REDIRECT_HOSTS = new Set(['www.boxhauls.com', 'boxhaulsnew.pages.dev']);
const SHARED = /^\/(api|_astro|brand)\//;

export const onRequest: PagesFunction<Env> = async ({ request, next, env }) => {
  const url = new URL(request.url);

  if (url.hostname === DRIVER_HOST) {
    if (SHARED.test(url.pathname)) return next();
    // App screens have no file extension: they all load the app shell.
    const path = /\.[a-z0-9]+$/i.test(url.pathname) ? url.pathname : '/';
    const target = new URL(`/driver-app${path}`, url);
    target.search = url.search;
    const res = await env.ASSETS.fetch(new Request(target, request));
    const out = new Response(res.body, res);
    out.headers.set('X-Robots-Tag', 'noindex, nofollow');
    return out;
  }

  if (url.pathname.startsWith('/api/')) return next();

  if (REDIRECT_HOSTS.has(url.hostname)) {
    url.hostname = CANONICAL;
    url.protocol = 'https:';
    url.port = '';
    return Response.redirect(url.toString(), 301);
  }
  if (url.hostname === CANONICAL && (url.pathname === '/driver-app' || url.pathname.startsWith('/driver-app/'))) {
    return Response.redirect(`https://${DRIVER_HOST}${url.pathname.replace(/^\/driver-app/, '') || '/'}${url.search}`, 301);
  }
  return next();
};
