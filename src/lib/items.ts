/**
 * Items the booking widget offers, keyed by the slug the pricing CTAs use (/book/?item=<slug>).
 * `heavy` follows HEAVY_FEE_ITEMS in docs/placeholders.json: refrigerators, freezers, washers, dryers,
 * gun safes, sectionals and sleeper sofas. `tier` is the default job type (TIER_1/2/3).
 */
import { lookup } from './placeholders';

export type TierKey = 'TIER_1' | 'TIER_2' | 'TIER_3';

export interface Item {
  slug: string;
  label: string;
  heavy: boolean;
  tier: TierKey;
  /** Shown under the picker when this item is selected. */
  note?: string;
}

export const ITEMS: Item[] = [
  { slug: 'couch', label: 'Couch or loveseat', heavy: false, tier: 'TIER_3' },
  { slug: 'sleeper-sofa', label: 'Sleeper sofa', heavy: true, tier: 'TIER_3' },
  { slug: 'sectional', label: 'Sectional', heavy: true, tier: 'TIER_3' },
  { slug: 'mattress', label: 'Mattress and box spring', heavy: false, tier: 'TIER_3' },
  { slug: 'bed-frame', label: 'Bed frame', heavy: false, tier: 'TIER_3' },
  { slug: 'dresser', label: 'Dresser', heavy: false, tier: 'TIER_3' },
  { slug: 'dining-table', label: 'Dining table', heavy: false, tier: 'TIER_3' },
  { slug: 'desk', label: 'Desk', heavy: false, tier: 'TIER_3' },
  { slug: 'tv', label: 'TV', heavy: false, tier: 'TIER_3' },
  { slug: 'refrigerator', label: 'Refrigerator', heavy: true, tier: 'TIER_3', note: 'Two-person item. Moved upright only.' },
  { slug: 'freezer', label: 'Freezer', heavy: true, tier: 'TIER_3', note: 'Two-person item. Moved upright only.' },
  {
    slug: 'washer-and-dryer',
    label: 'Washer and dryer',
    heavy: true,
    tier: 'TIER_3',
    note: 'Two-person item. [TODO: whether the heavy-item fee applies to each machine or once per trip]',
  },
  { slug: 'dishwasher', label: 'Dishwasher', heavy: false, tier: 'TIER_3' },
  { slug: 'stove', label: 'Stove or range', heavy: false, tier: 'TIER_3', note: 'Gas lines must be disconnected by a licensed pro first.' },
  { slug: 'gun-safe', label: 'Gun safe', heavy: true, tier: 'TIER_3', note: 'Up to the safe weight limit only.' },
  { slug: 'treadmill', label: 'Treadmill', heavy: false, tier: 'TIER_3' },
  { slug: 'exercise-bike', label: 'Exercise bike', heavy: false, tier: 'TIER_3' },
  { slug: 'grill', label: 'Grill', heavy: false, tier: 'TIER_3', note: 'Propane tanks ride separately or not at all.' },
  { slug: 'patio-furniture', label: 'Patio furniture', heavy: false, tier: 'TIER_3' },
  { slug: 'boxes', label: 'Boxes or a small move', heavy: false, tier: 'TIER_1' },
  { slug: 'studio-apartment', label: 'Studio apartment', heavy: false, tier: 'TIER_1' },
  { slug: 'storage-unit', label: 'Storage unit', heavy: false, tier: 'TIER_1' },
  { slug: 'dump-run', label: 'Junk / dump run', heavy: false, tier: 'TIER_2', note: 'Plus the dump fee, passed through at cost.' },
  { slug: 'other', label: 'Something else', heavy: false, tier: 'TIER_3' },
];

export const TIERS: { key: TierKey; slug: string; name: string }[] = (['TIER_1', 'TIER_2', 'TIER_3'] as const).map((key) => {
  const name = String(lookup(key) ?? key);
  return { key, name, slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') };
});

export const itemBySlug = (slug: string | null | undefined) => ITEMS.find((i) => i.slug === slug);
export const tierBySlug = (slug: string | null | undefined) => TIERS.find((t) => t.slug === slug);
