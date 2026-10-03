/** GA4 events (map Section 12). The only event names the site may send. */
import { isTodo, lookup } from './placeholders';

export const EVENTS = [
  'price_shown',
  'booking_started',
  'booking_completed',
  'driver_apply_started',
  'driver_apply_completed',
  'partner_apply',
] as const;
export type AnalyticsEvent = (typeof EVENTS)[number];

/** GA4 measurement ID from placeholders; undefined until it is set, and then no Google script loads at all. */
export function ga4Id(): string | undefined {
  const id = lookup('GA4_MEASUREMENT_ID');
  return typeof id === 'string' && !isTodo(id) && /^G-[A-Z0-9]+$/.test(id) ? id : undefined;
}
