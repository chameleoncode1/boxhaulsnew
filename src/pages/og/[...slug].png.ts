/** One OG image per sitemap page, written to /og/<slug>.png at build. */
import type { APIRoute, GetStaticPaths } from 'astro';
import { pages, type Page } from '../../lib/sitemap';
import { renderOgImage } from '../../lib/og';

export const getStaticPaths = (() =>
  pages.map((page) => ({ params: { slug: page.slug ?? 'index' }, props: { page } }))) satisfies GetStaticPaths;

export const GET: APIRoute = async ({ props }) => {
  const png = await renderOgImage((props as { page: Page }).page);
  return new Response(new Uint8Array(png), { headers: { 'Content-Type': 'image/png' } });
};
