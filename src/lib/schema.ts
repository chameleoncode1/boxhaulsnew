/**
 * JSON-LD builder (map Section 11). One @graph per page, assembled from the sitemap entry's `schema`
 * array plus placeholders. Types that describe page copy (FAQPage, HowTo, Article, JobPosting) are only
 * emitted when that copy exists — a FAQPage whose questions are not on the page is never emitted.
 * Review and AggregateRating are never emitted.
 */
import type { Page } from './sitemap';
import { breadcrumbs, metaTitle, shortLabel } from './labels';
import {
  ORG_ID,
  SITE_URL,
  WEBSITE_ID,
  FOUNDER_ID,
  LOGO_URL,
  appStore,
  brand,
  email,
  founderName,
  googlePlay,
  legalName,
  metro,
  money,
  phoneE164,
  postalAddress,
  socialProfiles,
  supportLanguages,
} from './site';

/** Copy that comes from the page's MDX (Prompt 4). Every field is optional until the page is written. */
export interface PageContent {
  description?: string;
  faq?: { question: string; answer: string }[];
  steps?: { name: string; text: string }[];
  datePublished?: string;
  dateModified?: string;
  author?: { name: string; jobTitle?: string; url?: string };
  image?: string;
  job?: { title: string; description: string; datePosted: string };
}

type Node = Record<string, unknown>;

const abs = (url: string) => new URL(url, SITE_URL).href;
const compact = <T extends Node>(node: T): T =>
  Object.fromEntries(Object.entries(node).filter(([, v]) => v !== undefined && !(Array.isArray(v) && v.length === 0))) as T;

const areaServed = () =>
  compact({
    '@type': 'City',
    name: metro.value,
    containedInPlace: { '@type': 'State', name: 'California' },
  });

function founder(): Node | undefined {
  if (!founderName.value) return undefined;
  return { '@type': 'Person', '@id': FOUNDER_ID, name: founderName.value, jobTitle: 'Founder', worksFor: { '@id': ORG_ID } };
}

function contactPoint(): Node {
  return compact({
    '@type': 'ContactPoint',
    contactType: 'customer support',
    telephone: phoneE164(),
    email: email.value,
    areaServed: areaServed(),
    availableLanguage: supportLanguages,
  });
}

function organization(): Node {
  const sameAs = [...socialProfiles.map((s) => s.url), appStore.value, googlePlay.value].filter(Boolean);
  return compact({
    '@type': 'Organization',
    '@id': ORG_ID,
    name: brand,
    legalName: legalName.value,
    url: `${SITE_URL}/`,
    logo: { '@type': 'ImageObject', url: LOGO_URL, width: 512, height: 381 },
    telephone: phoneE164(),
    email: email.value,
    address: postalAddress() && { '@type': 'PostalAddress', ...postalAddress() },
    founder: founderName.value ? { '@id': FOUNDER_ID } : undefined,
    sameAs,
    contactPoint: contactPoint(),
  });
}

function offer(page: Page): Node {
  const base = money('BASE_FARE');
  const perMile = money('PER_MILE');
  const specs = [
    base !== undefined && { '@type': 'UnitPriceSpecification', name: 'Base fare', price: base.toFixed(2), priceCurrency: 'USD' },
    perMile !== undefined && {
      '@type': 'UnitPriceSpecification',
      name: 'Per mile',
      price: perMile.toFixed(2),
      priceCurrency: 'USD',
      unitCode: 'SMI',
      referenceQuantity: { '@type': 'QuantitativeValue', value: 1, unitCode: 'SMI' },
    },
  ].filter(Boolean);
  return compact({
    '@type': 'Offer',
    '@id': `${abs(page.url)}#offer`,
    priceCurrency: 'USD',
    priceSpecification: specs,
    eligibleRegion: areaServed(),
  });
}

/** Build the page's @graph and report schema types that are listed in the sitemap but waiting on copy. */
export function buildGraph(page: Page, content: PageContent = {}): { graph: Node; missing: string[] } {
  const url = abs(page.url);
  const want = new Set(page.schema);
  const nodes: Node[] = [];
  const missing: string[] = [];
  const crumbs = breadcrumbs(page);

  // Always: Organization (+ founder) and the WebPage node that ties the graph together.
  nodes.push(organization());
  const person = founder();
  if (person) nodes.push(person);
  nodes.push(
    compact({
      '@type': 'WebPage',
      '@id': `${url}#webpage`,
      url,
      name: metaTitle(page),
      description: content.description,
      isPartOf: { '@id': WEBSITE_ID },
      about: { '@id': ORG_ID },
      breadcrumb: crumbs.length ? { '@id': `${url}#breadcrumb` } : undefined,
      inLanguage: 'en-US',
    }),
  );

  if (want.has('WebSite')) {
    nodes.push({ '@type': 'WebSite', '@id': WEBSITE_ID, name: brand, url: `${SITE_URL}/`, publisher: { '@id': ORG_ID } });
  }

  if (want.has('BreadcrumbList') && crumbs.length) {
    nodes.push({
      '@type': 'BreadcrumbList',
      '@id': `${url}#breadcrumb`,
      itemListElement: crumbs.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.label, item: abs(c.url) })),
    });
  }

  if (want.has('Service')) {
    nodes.push(
      compact({
        '@type': 'Service',
        '@id': `${url}#service`,
        name: page.h1,
        serviceType: shortLabel(page),
        provider: { '@id': ORG_ID },
        areaServed: areaServed(),
        offers: { '@id': `${url}#offer` },
      }),
    );
  }
  if (want.has('Service') || want.has('Offer')) nodes.push(offer(page));

  if (want.has('LocalBusiness')) {
    nodes.push(
      compact({
        '@type': 'MovingCompany',
        '@id': `${url}#localbusiness`,
        name: brand,
        parentOrganization: { '@id': ORG_ID },
        url,
        telephone: phoneE164(),
        address: postalAddress() && { '@type': 'PostalAddress', ...postalAddress() },
        areaServed: areaServed(),
        // A GeoCircle for the {{RADIUS}}-mile radius needs real coordinates for its midpoint.
        // geo, openingHours and priceRange stay out until they are real (see docs/TODO.md).
      }),
    );
  }

  if (want.has('ContactPoint')) nodes.push({ ...contactPoint(), '@id': `${url}#contactpoint` });

  if (want.has('MobileApplication')) {
    nodes.push(
      compact({
        '@type': 'MobileApplication',
        '@id': `${url}#app`,
        name: brand,
        operatingSystem: 'iOS, Android',
        applicationCategory: 'LifestyleApplication',
        publisher: { '@id': ORG_ID },
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        sameAs: [appStore.value, googlePlay.value].filter(Boolean),
      }),
    );
  }

  if (want.has('Person') && !person) missing.push('Person');

  if (want.has('FAQPage')) {
    if (content.faq?.length) {
      nodes.push({
        '@type': 'FAQPage',
        '@id': `${url}#faq`,
        mainEntity: content.faq.map((f) => ({
          '@type': 'Question',
          name: f.question,
          acceptedAnswer: { '@type': 'Answer', text: f.answer },
        })),
      });
    } else missing.push('FAQPage');
  }

  if (want.has('HowTo')) {
    if (content.steps?.length) {
      nodes.push({
        '@type': 'HowTo',
        '@id': `${url}#howto`,
        name: page.h1,
        step: content.steps.map((s, i) => ({ '@type': 'HowToStep', position: i + 1, name: s.name, text: s.text })),
      });
    } else missing.push('HowTo');
  }

  if (want.has('Article')) {
    if (content.datePublished) {
      nodes.push(
        compact({
          '@type': 'Article',
          '@id': `${url}#article`,
          headline: page.h1,
          author: content.author ? { '@type': 'Person', ...content.author } : person ? { '@id': FOUNDER_ID } : undefined,
          datePublished: content.datePublished,
          dateModified: content.dateModified ?? content.datePublished,
          image: content.image && abs(content.image),
          publisher: { '@id': ORG_ID },
          mainEntityOfPage: { '@id': `${url}#webpage` },
        }),
      );
    } else missing.push('Article');
  }

  if (want.has('JobPosting')) {
    if (content.job) {
      nodes.push(
        compact({
          '@type': 'JobPosting',
          '@id': `${url}#job`,
          title: content.job.title,
          description: content.job.description,
          datePosted: content.job.datePosted,
          employmentType: 'CONTRACTOR',
          hiringOrganization: { '@id': ORG_ID },
          jobLocation: { '@type': 'Place', address: compact({ '@type': 'PostalAddress', addressLocality: metro.value, addressRegion: 'CA', addressCountry: 'US' }) },
        }),
      );
    } else missing.push('JobPosting');
  }

  if (/"@type":"(Review|AggregateRating)"/.test(JSON.stringify(nodes))) {
    throw new Error(`${page.url}: Review/AggregateRating must never be emitted`);
  }

  return { graph: { '@context': 'https://schema.org', '@graph': nodes }, missing };
}
