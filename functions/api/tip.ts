/**
 * POST /api/tip — tip the driver, during or after the trip. Body: { token } or { id }, plus { amountCents, percent? }.
 * Returns { status: 'paid', tipCents } or { status: 'requires_action', clientSecret, tipId } (finish with /api/tip-confirm).
 */
import type { Env } from '../_lib/env';
import { assertSameOrigin, handle, HttpError, json, readJson } from '../_lib/http';
import { stripeConfigured } from '../_lib/stripe';
import { chargeTip, TIP_PERCENTS } from '../_lib/tips';
import { tripFor } from '../_lib/tripAccess';
import { getBooking } from '../_lib/payments';

export const onRequestPost: PagesFunction<Env> = ({ request, env }) =>
  handle(async () => {
    assertSameOrigin(request);
    if (!stripeConfigured(env)) throw new HttpError(503, 'not_configured', 'Tipping is temporarily unavailable.');
    const body = await readJson<Record<string, unknown>>(request);
    const b = await tripFor(env, request, body);
    const amount = typeof body.amountCents === 'number' ? Math.round(body.amountCents) : NaN;
    const percent = TIP_PERCENTS.includes(body.percent as never) ? (body.percent as number) : null;
    const r = await chargeTip(env, b as never, amount, percent);
    const after = await getBooking(env, b.id);
    return json({ ...r, tipCents: after?.tip_cents ?? 0 });
  });
