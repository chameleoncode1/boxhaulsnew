/** Trip price from the formula in placeholders (map Section 1.1). Every price on the site comes from here. */
import { money } from './site';

export interface PriceOptions {
  heavy?: boolean;
  helper?: boolean;
}

export function tripPrice(miles: number, { heavy = false, helper = false }: PriceOptions = {}): number {
  const base = money('BASE_FARE');
  const perMile = money('PER_MILE');
  const heavyFee = money('HEAVY_FEE');
  const helperFee = money('HELPER_FEE');
  if (base === undefined || perMile === undefined || heavyFee === undefined || helperFee === undefined) {
    throw new Error('Pricing needs BASE_FARE, PER_MILE, HEAVY_FEE and HELPER_FEE as dollar amounts in placeholders.json');
  }
  return base + perMile * miles + (heavy ? heavyFee : 0) + (helper ? helperFee : 0);
}

export const usd = (n: number) => `$${n.toFixed(2)}`;

/** Resolve {{price:MILES[:heavy][:helper]}} tokens, e.g. "{{price:10:heavy}}" → "$77.00". */
export function resolvePriceTokens(text: string): string {
  return text.replace(/\{\{price:(\d+(?:\.\d+)?)((?::(?:heavy|helper))*)\}\}/g, (_, mi: string, flags: string) =>
    usd(tripPrice(Number(mi), { heavy: flags.includes(':heavy'), helper: flags.includes(':helper') })),
  );
}
