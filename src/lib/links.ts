/** Internal-link selection (map Section 10). */
import { getPage, pages, type Page } from './sitemap';

/** CLAUDE.md rule 7: rider pages never link to /drive/ in body; driver pages never link to /services/. */
export function isForbiddenBodyLink(from: Page, href: string): boolean {
  if (from.audience === 'rider' && href.startsWith('/drive/')) return true;
  if (from.audience === 'driver' && href.startsWith('/services/')) return true;
  return false;
}

export interface BodyLink {
  href: string;
  anchor: string;
  /** Sentence around the anchor: [before, after]. */
  frame: [string, string];
}

function frameFor(target: Page): [string, string] {
  if (target.url.startsWith('/trust/')) return ['For the details, see ', '.'];
  switch (target.template) {
    case 'pricing':
      return ['For the numbers, see ', '.'];
    case 'service-hub':
    case 'service-spoke':
      return ['What the haul includes and how it works: ', '.'];
    case 'guide':
      return ['For a step-by-step answer, read ', '.'];
    case 'compare':
      return ['For a side-by-side, see ', '.'];
    case 'city':
      return ['For local details, see ', '.'];
    default:
      return ['See ', '.'];
  }
}

/**
 * The page's links_to targets as sentences with descriptive anchors (the target's H1).
 * Targets that break audience isolation are returned separately so the page can flag them instead of linking.
 */
export function bodyLinks(page: Page): { links: BodyLink[]; forbidden: string[] } {
  const links: BodyLink[] = [];
  const forbidden: string[] = [];
  for (const href of page.linksTo) {
    if (isForbiddenBodyLink(page, href)) {
      forbidden.push(href);
      continue;
    }
    const target = getPage(href);
    if (!target) throw new Error(`links_to target ${href} on ${page.url} is not in sitemap.json`);
    links.push({ href, anchor: target.h1, frame: frameFor(target) });
  }
  return { links, forbidden };
}

const parentOf = (url: string) => url.replace(/[^/]+\/$/, '');

/**
 * 3–5 related pages from the same cluster, chosen per page: siblings first, then parent/child, then same template.
 * Never the homepage, never the page itself, never a links_to target (those are already in the body),
 * never a link that breaks audience isolation. Indexable pages only link to indexable pages.
 */
export function relatedLinks(page: Page, max = 5): Page[] {
  const exclude = new Set([page.url, '/', ...page.linksTo]);
  const score = (p: Page) =>
    (parentOf(p.url) === parentOf(page.url) ? 4 : 0) +
    (parentOf(p.url) === page.url || parentOf(page.url) === p.url ? 3 : 0) +
    (p.template === page.template ? 1 : 0);

  return pages
    .filter(
      (p) =>
        p.cluster === page.cluster &&
        !exclude.has(p.url) &&
        p.audience === page.audience &&
        !isForbiddenBodyLink(page, p.url) &&
        (!page.indexable || p.indexable),
    )
    .map((p, i) => ({ p, s: score(p), i }))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .slice(0, max)
    .map(({ p }) => p);
}
