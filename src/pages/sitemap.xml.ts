/**
 * /sitemap.xml from docs/sitemap.json (map Section 12): indexable pages only.
 * lastmod is the last git commit date of the page's content file (src/content/pages/<path>.mdx). Pages without
 * written content have no real modification date yet, so they carry no lastmod rather than a made-up one.
 */
import type { APIRoute } from 'astro';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { pages } from '../lib/sitemap';
import { SITE_URL } from '../lib/site';
import { contentFile } from '../lib/content';

function lastmod(url: string): string | undefined {
  const file = contentFile(url);
  if (!existsSync(file)) return undefined;
  try {
    const date = execFileSync('git', ['log', '-1', '--format=%cI', '--', file], { encoding: 'utf8' }).trim();
    return date || undefined;
  } catch {
    return undefined;
  }
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export const GET: APIRoute = () => {
  const entries = pages
    .filter((p) => p.indexable)
    .map((p) => {
      const mod = lastmod(p.url);
      return `  <url>\n    <loc>${esc(new URL(p.url, SITE_URL).href)}</loc>${mod ? `\n    <lastmod>${mod}</lastmod>` : ''}\n  </url>`;
    });
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join('\n')}\n</urlset>\n`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
