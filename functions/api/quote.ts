/**
 * POST /api/quote — the real price for a trip. Body: { pickupPlaceId, dropoffPlaceId, sessionToken, item, tier, helper }.
 * Looks up both places, checks the service area, gets driving miles, prices it from docs/placeholders.json,
 * and returns a signed quote that /api/book will accept for 30 minutes.
 */
import type { Env } from '../_lib/env';
import { assertSameOrigin, handle, HttpError, json, readJson, str } from '../_lib/http';
import { assertInServiceArea, drivingMiles, lookupPlace } from '../_lib/maps';
import { QUOTE_TTL_MS, signQuote, type QuotePayload } from '../_lib/quote';
import { itemBySlug, TIERS } from '../../src/lib/items';
import { tripPrice } from '../../src/lib/pricing';
import { money } from '../../src/lib/site';

export const onRequestPost: PagesFunction<Env> = ({ request, env }) =>
  handle(async () => {
    assertSameOrigin(request);
    if (!env.QUOTE_SECRET) throw new HttpError(503, 'not_configured', 'Online quotes are temporarily unavailable.');
    const body = await readJson<Record<string, unknown>>(request);
    const sessionToken = str(body.sessionToken, 64) || crypto.randomUUID();
    const item = itemBySlug(str(body.item, 40));
    const tier = TIERS.find((t) => t.key === str(body.tier, 10));
    if (!item || !tier) throw new HttpError(400, 'bad_request', 'Choose an item and a job type.');
    const pickupId = str(body.pickupPlaceId, 300);
    const dropoffId = str(body.dropoffPlaceId, 300);
    if (!pickupId || !dropoffId) throw new HttpError(400, 'bad_request', 'Choose both addresses from the list.');

    const [pickup, dropoff] = await Promise.all([lookupPlace(env, pickupId, sessionToken), lookupPlace(env, dropoffId, sessionToken)]);
    assertInServiceArea(pickup, 'pickup');
    assertInServiceArea(dropoff, 'drop-off');

    const miles = Math.round((await drivingMiles(env, pickup, dropoff)) * 10) / 10;
    const helper = body.helper === true;
    const total = tripPrice(miles, { heavy: item.heavy, helper });
    const payload: QuotePayload = {
      pickup,
      dropoff,
      miles,
      item: item.slug,
      tier: tier.key,
      helper,
      heavy: item.heavy,
      totalCents: Math.round(total * 100),
      exp: Date.now() + QUOTE_TTL_MS,
    };
    const perMile = money('PER_MILE') ?? 0;
    return json({
      quote: await signQuote(payload, env.QUOTE_SECRET),
      pickup: pickup.address,
      dropoff: dropoff.address,
      miles,
      lines: [
        { label: 'Base fare', cents: Math.round((money('BASE_FARE') ?? 0) * 100) },
        { label: `${miles} miles × $${perMile.toFixed(2)}`, cents: Math.round(perMile * miles * 100) },
        ...(item.heavy ? [{ label: 'Heavy-item fee', cents: Math.round((money('HEAVY_FEE') ?? 0) * 100) }] : []),
        ...(helper ? [{ label: 'Helper (when available)', cents: Math.round((money('HELPER_FEE') ?? 0) * 100) }] : []),
      ],
      totalCents: payload.totalCents,
      expiresAt: payload.exp,
    });
  });
