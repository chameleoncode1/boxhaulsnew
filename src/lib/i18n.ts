/**
 * Spanish (/es/) scaffolding — map Section 12: Phase 2, driver-recruitment pages first, never empty stubs.
 * hreflang alternates are emitted only when BOTH versions are pages in docs/sitemap.json. To add a Spanish page,
 * add it to build_map.py as /es/drive/<same-path>/ (template "driver", phase 2), run `npm run map`, and write
 * src/content/pages/es/drive/<same-path>.mdx. The English page gains its alternate automatically.
 */
import { getPage, type Page } from './sitemap';
import { SITE_URL } from './site';

export const ES_PREFIX = '/es';
/** Only driver pages get Spanish versions for now (map Section 12 / Prompt 5). */
const ES_SECTIONS = ['/drive/'];

export const isSpanish = (url: string) => url.startsWith(`${ES_PREFIX}/`);
export const langOf = (url: string) => (isSpanish(url) ? 'es' : 'en');

export interface Alternate {
  hreflang: 'en' | 'es' | 'x-default';
  href: string;
}

/** hreflang alternates for a page, or [] when it has no published counterpart. */
export function alternates(page: Page): Alternate[] {
  const en = isSpanish(page.url) ? page.url.slice(ES_PREFIX.length) : page.url;
  if (!ES_SECTIONS.some((s) => en.startsWith(s))) return [];
  const es = `${ES_PREFIX}${en}`;
  if (!getPage(en) || !getPage(es)) return [];
  const abs = (u: string) => new URL(u, SITE_URL).href;
  return [
    { hreflang: 'en', href: abs(en) },
    { hreflang: 'es', href: abs(es) },
    { hreflang: 'x-default', href: abs(en) },
  ];
}
