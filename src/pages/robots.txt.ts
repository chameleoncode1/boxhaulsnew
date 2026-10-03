/**
 * /robots.txt (map Section 12): allow all; keep crawlers out of app UI.
 * Phase-2/3 stubs are NOT disallowed here — crawlers must be able to read their noindex tag.
 */
import type { APIRoute } from 'astro';
import { SITE_URL } from '../lib/site';

const DISALLOW = ['/auth', '/account', '/embed/', '/api/', '/book/', '/drive/accept/'];

export const GET: APIRoute = () => {
  const body = ['User-agent: *', 'Allow: /', ...DISALLOW.map((p) => `Disallow: ${p}`), '', `Sitemap: ${SITE_URL}/sitemap.xml`, ''].join('\n');
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
