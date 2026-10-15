/**
 * Dump-fee estimates for sizing the card hold on dump runs (docs/placeholders.json → DUMP_FEES).
 * For the customer's material and load size, takes the estimated maximum weight and computes the gate fee at
 * every site that accepts that material; the hold covers the most expensive one (the driver picks the site),
 * rounded up to the next $5. The customer is charged only the actual fee from the receipt.
 */
import placeholders from '../../docs/placeholders.json';

interface Site {
  name: string;
  where: string;
  per_load_cents: number;
  uncovered_load_fee_cents?: number;
  rates_cents_per_ton: Record<string, number>;
  minimums?: Record<string, { cents: number; up_to_lb?: number }>;
  notes?: Record<string, string>;
}
interface DumpData {
  checked: string;
  sites: Record<string, Site>;
  materials: { key: string; label: string; weight: 'light' | 'heavy' }[];
  loads: { key: string; label: string }[];
  max_weight_lb: Record<'light' | 'heavy', Record<string, number>>;
}

export const DUMP = (placeholders as unknown as { DUMP_FEES: DumpData }).DUMP_FEES;
export const DUMP_MATERIALS = DUMP.materials;
export const DUMP_LOADS = DUMP.loads;

/** Gate fee at one site for a load of `lb` pounds of `material`, or null if the site doesn't list that material. */
export function siteFeeCents(site: Site, material: string, lb: number): number | null {
  const rate = site.rates_cents_per_ton[material];
  if (rate === undefined) return null;
  let fee = Math.round((rate * lb) / 2000);
  const min = site.minimums?.[material];
  if (min) fee = min.up_to_lb !== undefined ? (lb <= min.up_to_lb ? min.cents : Math.max(fee, min.cents)) : Math.max(fee, min.cents);
  return fee + site.per_load_cents;
}

export interface DumpEstimate {
  material: string;
  load: string;
  maxLb: number;
  /** Per-site fee at the estimated maximum weight. */
  sites: { key: string; name: string; cents: number }[];
  /** Hold amount for the dump fee: the highest site fee, rounded up to $5. */
  holdCents: number;
}

export function estimateDump(material: string, load: string): DumpEstimate | null {
  const m = DUMP_MATERIALS.find((x) => x.key === material);
  const maxLb = m && DUMP.max_weight_lb[m.weight]?.[load];
  if (!m || !maxLb) return null;
  const sites = Object.entries(DUMP.sites).flatMap(([key, site]) => {
    const cents = siteFeeCents(site, material, maxLb);
    return cents === null ? [] : [{ key, name: site.name, cents }];
  });
  if (!sites.length) return null;
  const highest = Math.max(...sites.map((s) => s.cents));
  return { material, load, maxLb, sites, holdCents: Math.ceil(highest / 500) * 500 };
}
