/**
 * What a driver earns on a trip, in dollars (server-side only: used at build time on /drive/ pages).
 * Pages show earnings as dollar amounts, never the share percentage or the customer fare (owner decision
 * 2026-10-15). DRIVER_SHARE is stripped from browser bundles (astro.config.mjs), so never import this in an island.
 */
import { lookup, isTodo } from './placeholders';
import { tripPrice, usd } from './pricing';

export function driverEarn(miles: number, heavy = false): number | undefined {
  const share = lookup('DRIVER_SHARE');
  if (typeof share !== 'string' || isTodo(share)) return undefined;
  return (tripPrice(miles, { heavy }) * Number(share.replace('%', ''))) / 100;
}

/** Resolve {{earn:MILES[:heavy]}} tokens, e.g. "{{earn:10}}" → "$34.08". */
export function resolveEarnTokens(text: string): string {
  return text.replace(/\{\{earn:(\d+(?:\.\d+)?)((?::heavy)?)\}\}/g, (_, mi: string, flags: string) => {
    const v = driverEarn(Number(mi), flags.includes(':heavy'));
    return v === undefined ? '[TODO: DRIVER_SHARE]' : usd(v);
  });
}
