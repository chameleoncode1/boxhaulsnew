/** Trip price from the formula in placeholders (map Section 1.1). Every price on the site comes from here. */
import { money } from './site';

export interface PriceOptions {
  heavy?: boolean;
}

export function tripPrice(miles: number, { heavy = false }: PriceOptions = {}): number {
  const base = money('BASE_FARE');
  const perMile = money('PER_MILE');
  const heavyFee = money('HEAVY_FEE');
  if (base === undefined || perMile === undefined || heavyFee === undefined) {
    throw new Error('Pricing needs BASE_FARE, PER_MILE and HEAVY_FEE as dollar amounts in placeholders.json');
  }
  return base + perMile * miles + (heavy ? heavyFee : 0);
}

export const usd = (n: number) => `$${n.toFixed(2)}`;

/** Resolve {{price:MILES[:heavy]}} tokens, e.g. "{{price:10:heavy}}" → "$77.00". */
export function resolvePriceTokens(text: string): string {
  return text.replace(/\{\{price:(\d+(?:\.\d+)?)((?::heavy)?)\}\}/g, (_, mi: string, flags: string) =>
    usd(tripPrice(Number(mi), { heavy: flags.includes(':heavy') })),
  );
}
