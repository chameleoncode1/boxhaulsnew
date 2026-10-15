/*
 * BoxHauls Driver service worker. Scope is wherever it's served from (driver.boxhauls.com/ or /driver-app/ on previews).
 *  - /_astro/* and /brand/*: cache-first (fingerprinted or rarely changing)
 *  - app shell: network-first, cached copy when offline
 *  - /api/* and anything cross-origin or non-GET: never cached (jobs, money and location must be live)
 */
const VERSION = 'bhd-v1';
const STATIC = `${VERSION}-static`;
const SHELL = `${VERSION}-shell`;
const scope = new URL(self.registration.scope);
const shellUrl = new URL('./', scope).href;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL).then((c) => c.addAll([shellUrl, new URL('./manifest.webmanifest', scope).href, '/brand/driver-icon-192.png'])).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('bhd-') && !k.startsWith(VERSION)).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

const OFFLINE = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Offline | BoxHauls Driver</title>
<body style="font-family:system-ui,sans-serif;padding:2rem;max-width:32rem;margin:auto;background:#0d0d0d;color:#fff"><h1>You're offline</h1>
<p>BoxHauls Driver needs a connection to show jobs. You won't get new jobs until you're back online.</p><p><a style="color:#ff4d5a" href="./">Try again</a></p></body>`;

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  if (url.pathname.startsWith('/_astro/') || url.pathname.startsWith('/brand/')) {
    event.respondWith(caches.open(STATIC).then(async (c) => (await c.match(req)) || fetch(req).then((res) => (res.ok && c.put(req, res.clone()), res))));
    return;
  }
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) caches.open(SHELL).then((c) => c.put(shellUrl, res.clone()));
          return res;
        })
        .catch(async () => (await caches.match(shellUrl)) || new Response(OFFLINE, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })),
    );
  }
});
