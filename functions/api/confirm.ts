/**
 * POST /api/confirm — step 2: the browser reports the card was authorized. Body: { id, customerToken }.
 * The server checks the PaymentIntent with Stripe itself (never trusts the browser), then starts dispatch.
 * The Stripe webhook does the same thing, so a closed tab or a 3-D Secure redirect can't strand a booking.
 */
import type { Env } from '../_lib/env';
import { assertSameOrigin, handle, HttpError, json, readJson, str } from '../_lib/http';
import { hash } from '../_lib/quote';
import { activateBooking, getBooking } from '../_lib/payments';

export const onRequestPost: PagesFunction<Env> = ({ request, env, waitUntil }) =>
  handle(async () => {
    assertSameOrigin(request);
    if (!env.QUOTE_SECRET) throw new HttpError(503, 'not_configured', 'Unavailable.');
    const body = await readJson<{ id?: unknown; customerToken?: unknown }>(request);
    const b = await getBooking(env, str(body.id, 20));
    if (!b || b.customer_token_hash !== (await hash(str(body.customerToken, 100), env.QUOTE_SECRET))) {
      throw new HttpError(404, 'not_found', 'Booking not found.');
    }
    const result = activateBooking(env, b.id, env.QUOTE_SECRET, str(body.customerToken, 100));
    waitUntil(result.catch((e) => console.error('activate error', e)));
    const status = await result;
    if (status === 'not_authorized') throw new HttpError(402, 'not_authorized', 'Your card was not authorized. Please try again.');
    const fresh = await getBooking(env, b.id);
    return json({ id: b.id, status: fresh?.status, decideBy: fresh?.dispatch_expires_at });
  });
