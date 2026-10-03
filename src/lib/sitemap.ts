import raw from '../../docs/sitemap.json';
import { resolve, resolveStrict } from './placeholders';

export const TEMPLATES = [
  'home',
  'core',
  'pricing',
  'service-hub',
  'service-spoke',
  'city',
  'compare',
  'guide',
  'driver',
  'partners',
  'legal',
] as const;
export type Template = (typeof TEMPLATES)[number];

/** Which header/footer a page gets. Driver guides use the `guide` template but must keep driver chrome (map Section 2). */
export type Audience = 'rider' | 'driver' | 'partner';

interface RawPage {
  url: string;
  h1: string;
  primary_query: string;
  secondary_queries: string[];
  links_to: string[];
  schema: string[];
  content_blocks: string;
  cluster: string;
  page_type: string;
  phase: number;
  template: string;
}

export interface Page {
  url: string;
  /** Route param for [...slug].astro; undefined for "/". */
  slug: string | undefined;
  h1: string;
  primaryQuery: string;
  secondaryQueries: string[];
  linksTo: string[];
  schema: string[];
  contentBlocks: string[];
  cluster: string;
  pageType: string;
  phase: number;
  template: Template;
  audience: Audience;
  /** Phase-1 pages are indexable; later phases build but stay noindex and out of sitemap.xml until they ship. */
  indexable: boolean;
  /** Placeholder keys rendered as TODO markers anywhere in this entry. */
  todos: string[];
}

function audienceFor(url: string): Audience {
  if (url.startsWith('/drive/')) return 'driver';
  if (url.startsWith('/partners/')) return 'partner';
  return 'rider';
}

function toPage(p: RawPage): Page {
  if (!(TEMPLATES as readonly string[]).includes(p.template)) {
    throw new Error(`Unknown template "${p.template}" for ${p.url}`);
  }
  const url = resolveStrict(p.url);
  if (url !== url.toLowerCase() || !url.endsWith('/')) {
    throw new Error(`URL must be lowercase with a trailing slash: ${url}`);
  }
  const todos = new Set<string>();
  const text = (s: string) => {
    const r = resolve(s);
    r.todos.forEach((t) => todos.add(t));
    return r.text;
  };
  return {
    url,
    slug: url === '/' ? undefined : url.slice(1, -1),
    h1: text(p.h1),
    primaryQuery: text(p.primary_query),
    secondaryQueries: p.secondary_queries.map(text),
    linksTo: p.links_to.map(resolveStrict),
    schema: p.schema,
    contentBlocks: text(p.content_blocks)
      .split(/;\s+/)
      .map((s) => s.trim())
      .filter(Boolean),
    cluster: p.cluster,
    pageType: p.page_type,
    phase: p.phase,
    template: p.template as Template,
    audience: audienceFor(url),
    indexable: p.phase === 1,
    todos: [...todos],
  };
}

export const pages: Page[] = (raw.pages as RawPage[]).map(toPage);

const byUrl = new Map(pages.map((p) => [p.url, p]));
if (byUrl.size !== pages.length) throw new Error('Duplicate URL in docs/sitemap.json');

export function getPage(url: string): Page | undefined {
  return byUrl.get(url);
}

export const redirects: { from: string; to: string }[] = raw.redirects.map((r) => ({
  from: resolveStrict(r.from),
  to: resolveStrict(r.to),
}));
