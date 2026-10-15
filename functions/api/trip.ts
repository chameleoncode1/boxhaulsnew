/** POST /api/trip — the customer's manage-trip view. Body: { token } (from the confirmation screen and texts). */
import type { Env } from '../_lib/env';
import { assertSameOrigin, handle, json, readJson, str } from '../_lib/http';
import { whenText } from '../_lib/dispatch';
import { bookingByCustomerToken, cancelTerms, CANCEL_FREE_MS, noShowAvailableAt } from '../_lib/payments';
import { itemBySlug } from '../../src/lib/items';

export const onRequestPost: PagesFunction<Env> = ({ request, env }) =>
  handle(async () => {
    assertSameOrigin(request);
    const { token } = await readJson<{ token?: unknown }>(request);
    const b = await bookingByCustomerToken(env, str(token, 100));
    const driver = b.driver_id ? await env.DB.prepare('SELECT name, phone FROM drivers WHERE id = ?').bind(b.driver_id).first<{ name: string; phone: string }>() : null;
    const terms = cancelTerms(b);
    return json({
      id: b.id,
      status: b.status,
      item: itemBySlug(b.item)?.label ?? b.item,
      when: whenText(b),
      pickup: b.pickup_address,
      dropoff: b.dropoff_address,
      priceCents: b.price_cents,
      capturedCents: b.captured_cents,
      cancelFeeCents: b.cancel_fee_cents,
      decideBy: b.dispatch_expires_at,
      freeCancelUntil: b.confirmed_at && b.status === 'dispatching' ? new Date(Date.parse(b.confirmed_at) + CANCEL_FREE_MS).toISOString() : null,
      driver: driver ? { firstName: driver.name.split(/\s+/)[0], phone: driver.phone } : null,
      cancel: terms,
      cancelReason: b.cancel_reason,
      noShowAt: noShowAvailableAt(b)?.toISOString() ?? null,
      dumpHoldCents: b.dump_hold_cents,
    });
  });
