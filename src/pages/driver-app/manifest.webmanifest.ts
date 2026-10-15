/**
 * BoxHauls Driver web app manifest. Served at driver.boxhauls.com/manifest.webmanifest (and /driver-app/ on previews).
 * URLs are relative to this file, so the same manifest works on both. A separate origin and name make phones
 * install it as its own app next to the customer app.
 */
import type { APIRoute } from 'astro';
import { tokenColor } from '../../lib/theme';

export const GET: APIRoute = () =>
  new Response(
    JSON.stringify({
      id: './',
      name: 'BoxHauls Driver',
      short_name: 'BH Driver',
      description: 'Drive with BoxHauls: go online, see hauling jobs near you in Fresno and Clovis, and get paid.',
      start_url: './?source=app',
      scope: './',
      display: 'standalone',
      orientation: 'portrait',
      background_color: tokenColor('night'),
      theme_color: tokenColor('night'),
      categories: ['business', 'productivity', 'travel'],
      icons: [
        { src: '/brand/driver-apple-touch-icon.png?v=3', sizes: '180x180', type: 'image/png', purpose: 'any' },
        { src: '/brand/driver-icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: '/brand/driver-icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: '/brand/driver-icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
        { src: '/brand/driver-icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    }),
    { headers: { 'Content-Type': 'application/manifest+json' } },
  );
