/** POST /api/complete — the assigned driver marks the trip complete. Body: { token, dumpFeeCents? }. Charges and pays out. */
import type { Env } from '../_lib/env';
import { assertSameOrigin, handle, HttpError, json, readJson, str } from '../_lib/http';
import { findOffer, offerState } from '../_lib/offers';
import { completeBooking, getBooking } from '../_lib/payments';

export const onRequestPost: PagesFunction<Env> = ({ request, env }) =>
  handle(async () => {
    assertSameOrigin(request);
    const body = await readJson<{ token?: unknown; dumpFeeCents?: unknown }>(request);
    const offer = await findOffer(env, str(body.token, 100));
    if (offerState(offer) !== 'yours') throw new HttpError(403, 'not_yours', 'This trip is not assigned to you.');
    const driver = await env.DB.prepare('SELECT id, stripe_account_id FROM drivers WHERE id = ?').bind(offer.offer_driver_id).first<{ id: string; stripe_account_id: string | null }>();
    const b = await getBooking(env, offer.id);
    if (!driver || !b) throw new HttpError(404, 'not_found', 'Trip not found.');
    const dump = typeof body.dumpFeeCents === 'number' && Number.isFinite(body.dumpFeeCents) ? body.dumpFeeCents : 0;
    return json(await completeBooking(env, b, driver, dump));
  });
