/*
 * BoxHauls service worker (PWA). Keeps the installed app fast and usable on a weak signal:
 *  - /_astro/* (fingerprinted), /brand/*, fonts: cache-first (they never change under the same URL)
 *  - pages: network-first, falling back to the cached copy, then to a small offline notice
 *  - /api/*, Stripe, anything cross-origin or non-GET: never cached (prices and bookings must be live)
 */
const VERSION = 'bh-v2';
const STATIC = `${VERSION}-static`;
const PAGES = `${VERSION}-pages`;
const PRECACHE = ['/', '/book/', '/pricing/', '/manifest.webmanifest', '/brand/icon-192.png', '/brand/wordmark.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(PAGES).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

const OFFLINE = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Offline | BoxHauls</title>
<body style="font-family:system-ui,sans-serif;padding:2rem;max-width:32rem;margin:auto"><h1>You're offline</h1>
<p>BoxHauls needs a connection to show prices and book trips. Check your signal and try again.</p><p><a href="/">Try again</a></p></body>`;

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  if (url.pathname.startsWith('/_astro/') || url.pathname.startsWith('/brand/') || url.pathname.startsWith('/og/')) {
    event.respondWith(
      caches.open(STATIC).then(async (c) => (await c.match(req)) || fetch(req).then((res) => (res.ok && c.put(req, res.clone()), res))),
    );
    return;
  }

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) caches.open(PAGES).then((c) => c.put(req, res.clone()));
          return res;
        })
        .catch(async () => (await caches.match(req)) || (await caches.match(url.pathname)) || new Response(OFFLINE, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })),
    );
  }
});
