/** Web app manifest: makes boxhauls.com installable as an app (PWA) on phones, tablets and desktops. */
import type { APIRoute } from 'astro';
import { tokenColor } from '../lib/theme';

export const GET: APIRoute = () =>
  new Response(
    JSON.stringify({
      id: '/',
      name: 'BoxHauls: Truck & Driver On Demand',
      short_name: 'BoxHauls',
      description: 'Book a local pickup truck and driver in Fresno and Clovis. See the price before you book.',
      start_url: '/book/?source=app',
      scope: '/',
      display: 'standalone',
      orientation: 'portrait',
      background_color: tokenColor('night'),
      theme_color: tokenColor('night'),
      categories: ['lifestyle', 'travel', 'business'],
      icons: [
        { src: '/brand/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: '/brand/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: '/brand/icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
        { src: '/brand/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
      shortcuts: [
        { name: 'Get a price', short_name: 'Price', url: '/book/?source=app-shortcut', icons: [{ src: '/brand/icon-192.png', sizes: '192x192' }] },
        { name: 'Pricing', url: '/pricing/', icons: [{ src: '/brand/icon-192.png', sizes: '192x192' }] },
      ],
    }),
    { headers: { 'Content-Type': 'application/manifest+json' } },
  );
