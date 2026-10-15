/** POST /api/driver-cancel — the assigned driver cancels (any reason, including weather). Body: { token }. Releases the hold. */
import type { Env } from '../_lib/env';
import { assertSameOrigin, handle, HttpError, json, readJson, str } from '../_lib/http';
import { findOffer, offerState } from '../_lib/offers';
import { getBooking, releaseForDriver } from '../_lib/payments';

export const onRequestPost: PagesFunction<Env> = ({ request, env }) =>
  handle(async () => {
    assertSameOrigin(request);
    const { token } = await readJson<{ token?: unknown }>(request);
    const offer = await findOffer(env, str(token, 100));
    if (offerState(offer) !== 'yours') throw new HttpError(403, 'not_yours', 'This trip is not assigned to you.');
    const b = await getBooking(env, offer.id);
    if (!b) throw new HttpError(404, 'not_found', 'Trip not found.');
    await releaseForDriver(env, b, 'driver');
    return json({ id: b.id, status: 'canceled' });
  });
