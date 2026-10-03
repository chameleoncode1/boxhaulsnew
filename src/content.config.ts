/**
 * Page copy (Prompt 4): src/content/pages/<url-as-path>.mdx, "/" at index.mdx.
 * Frontmatter carries what the layout and JSON-LD need; the body is the page's prose.
 */
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const pages = defineCollection({
  loader: glob({
    pattern: '**/*.mdx',
    base: './src/content/pages',
    // id = the file path without ".mdx" ("pricing/cost-to-move-a-couch", "index"), so it maps 1:1 to the URL.
    generateId: ({ entry }) => entry.replace(/\.mdx$/, ''),
  }),
  schema: z.object({
    /** Meta description: 140–155 chars after placeholders resolve (checked in [...slug].astro), states the answer. */
    description: z.string(),
    /** "Prices checked October 2026" line for pricing, compare and local pages (map Section 9.9). */
    checked: z.string().optional(),
    /** Visible FAQ (H3 question + answer), mirrored exactly in FAQPage schema. Plain text only. */
    faq: z.array(z.object({ question: z.string(), answer: z.string() })).optional(),
    /** Visible numbered steps, mirrored in HowTo schema. */
    steps: z.array(z.object({ name: z.string(), text: z.string() })).optional(),
    /** Guides and driver guides (Article schema). ISO dates. */
    datePublished: z.string().optional(),
    dateModified: z.string().optional(),
    /** JobPosting on /drive/ and /drive/fresno/. */
    job: z.object({ title: z.string(), description: z.string(), datePosted: z.string() }).optional(),
    /** Legal pages: last-updated date. */
    updated: z.string().optional(),
  }),
});

export const collections = { pages };
