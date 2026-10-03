/** Short labels, meta titles and display names derived from sitemap entries (map Section 4.1). */
import { getPage, type Page } from './sitemap';
import { metro, year } from './site';

const WORDS: Record<string, string> = {
  boxhauls: 'BoxHauls',
  faq: 'FAQ',
  tv: 'TV',
  ikea: 'IKEA',
  uhaul: 'U-Haul',
  goshare: 'GoShare',
  offerup: 'OfferUp',
  taskrabbit: 'TaskRabbit',
  lowes: "Lowe's",
  vs: 'vs.',
  e: 'E',
};
const PROPER = new Set([
  'fresno', 'clovis', 'costco', 'walmart', 'target', 'ashley', 'craigslist', 'facebook', 'nextdoor',
  'lugg', 'dolly', 'bungii', 'curri', 'home', 'depot', 'living', 'spaces', 'mattress', 'firm', 'big', 'lots',
]);
const SMALL = new Set(['a', 'an', 'and', 'the', 'of', 'to', 'in', 'for', 'or', 'vs.']);

/** "cost-to-move-a-couch" → "Cost to move a couch" (sentence case, brand words fixed). */
export function humanize(segment: string): string {
  return segment
    .split('-')
    .map((w, i) => {
      if (WORDS[w]) return WORDS[w];
      if (i === 0) return w.charAt(0).toUpperCase() + w.slice(1);
      return w;
    })
    .join(' ');
}

/** "washer and dryer" → "Washer and Dryer" (title case for title tags). */
export function titleCase(text: string): string {
  return text
    .split(' ')
    .map((w, i) => (i > 0 && SMALL.has(w.toLowerCase()) ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');
}

const stripMetro = (s: string) => (metro.value ? s.replace(new RegExp(`\\s+in\\s+${metro.value}$`), '') : s);

/** Short name for breadcrumbs and service names: the H1 if it is short, else the humanized last URL segment. */
export function shortLabel(page: Page): string {
  if (page.url === '/') return 'Home';
  const h1 = stripMetro(page.h1);
  if (h1.length <= 32 && !h1.includes('[TODO')) return h1;
  const segment = page.url.slice(1, -1).split('/').pop()!;
  return humanize(segment);
}

/** Title-case short name of a URL segment, used where the formula wants {Service} or {Item}. */
const segmentTitle = (page: Page) => {
  const segment = page.url.slice(1, -1).split('/').pop()!;
  return titleCase(
    segment
      .split('-')
      .map((w) => WORDS[w] ?? (PROPER.has(w) ? w.charAt(0).toUpperCase() + w.slice(1) : w))
      .join(' '),
  );
};

const PRICING_SLUG = /^cost-to-(move|deliver|haul)-(a|an)-(.+)$/;

/** Meta title by the Section 4.1 formula for the page's template (driver audience uses the driver formula). */
export function metaTitle(page: Page): string {
  const m = metro.value ?? 'Fresno';
  const y = year.value ?? '';
  const segment = page.url.slice(1, -1).split('/').pop() ?? '';

  if (page.audience === 'driver') return `${page.h1} | Drive for BoxHauls`;
  switch (page.template) {
    case 'home':
      return `BoxHauls: Truck & Driver On Demand in ${m}`;
    case 'pricing': {
      const match = segment.match(PRICING_SLUG);
      if (match) {
        const [, verb, article, item] = match;
        const itemName = titleCase(item.split('-').map((w) => WORDS[w] ?? w).join(' '));
        return `How Much Does It Cost to ${titleCase(verb)} ${article === 'an' ? 'an' : 'a'} ${itemName}? (${y}) | BoxHauls`;
      }
      if (segment === 'cost-of-a-dump-run') return `How Much Does a Dump Run Cost? (${y}) | BoxHauls`;
      return `${page.h1} | BoxHauls`;
    }
    case 'service-hub':
      return `${segmentTitle(page)} in ${m}: Truck & Driver On Demand | BoxHauls`;
    case 'service-spoke':
      return `${stripMetro(page.h1)} in ${m} | BoxHauls`;
    case 'city':
      return page.url.split('/').length === 4 ? `Truck & Driver On Demand in ${m} | BoxHauls` : `${page.h1} | BoxHauls`;
    case 'compare': {
      const competitor = page.h1.replace(/^BoxHauls vs\.\s*/, '');
      return `BoxHauls vs. ${competitor}: Price, Coverage, Insurance (${y})`;
    }
    case 'guide':
      return `${page.h1} | BoxHauls Guides`;
    default:
      return `${page.h1} | BoxHauls`;
  }
}

/** Label for the template shown on OG images. */
export function templateEyebrow(page: Page): string {
  if (page.audience === 'driver') return 'Drive for BoxHauls';
  const map: Record<Page['template'], string> = {
    home: `Truck & driver on demand · ${metro.value ?? ''}`,
    core: 'BoxHauls',
    pricing: 'Pricing',
    'service-hub': 'Services',
    'service-spoke': 'Services',
    city: 'Service area',
    compare: 'Compare',
    guide: 'Guide',
    driver: 'Drive for BoxHauls',
    partners: 'Partners',
    legal: 'Legal',
  };
  return map[page.template];
}

/** Breadcrumb trail: Home, then every ancestor URL that is a real page, then the page itself. */
export function breadcrumbs(page: Page): { url: string; label: string }[] {
  if (page.url === '/') return [];
  const parts = page.url.slice(1, -1).split('/');
  const trail = [{ url: '/', label: 'Home' }];
  for (let i = 1; i <= parts.length; i++) {
    const url = `/${parts.slice(0, i).join('/')}/`;
    const ancestor = getPage(url);
    // Path segments without a page (/services/, /legal/, /drive/guides/, /drive/compare/) are skipped.
    if (ancestor) trail.push({ url, label: shortLabel(ancestor) });
  }
  return trail;
}

/** Item slug for the book CTA deep link (/book/?item=…), from the pricing URL. */
export function bookingItem(page: Page): string | undefined {
  const segment = page.url.slice(1, -1).split('/').pop() ?? '';
  const match = segment.match(PRICING_SLUG);
  if (match) return match[3];
  if (segment === 'cost-of-a-dump-run') return 'dump-run';
  return undefined;
}
