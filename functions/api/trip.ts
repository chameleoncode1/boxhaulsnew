/** POST /api/trip — the customer's trip view. Body: { token } (link or text) or { id } (signed in). */
import type { Env } from '../_lib/env';
import { assertSameOrigin, handle, json, readJson } from '../_lib/http';
import { whenText } from '../_lib/dispatch';
import { cancelTerms, CANCEL_FREE_MS, noShowAvailableAt } from '../_lib/payments';
import { canTip, DEFAULT_TIP_PERCENT, tipBaseCents, tipSuggestions } from '../_lib/tips';
import { tripFor } from '../_lib/tripAccess';
import { itemBySlug } from '../../src/lib/items';

export const onRequestPost: PagesFunction<Env> = ({ request, env }) =>
  handle(async () => {
    assertSameOrigin(request);
    const b = await tripFor(env, request, await readJson(request));
    const driver = b.driver_id
      ? await env.DB.prepare('SELECT name, first_name, preferred_name, phone, vehicle_year, vehicle_make, vehicle_model, vehicle_color, vehicle_plate FROM drivers WHERE id = ?')
          .bind(b.driver_id)
          .first<{ name: string; first_name: string | null; preferred_name: string | null; phone: string; vehicle_year: number | null; vehicle_make: string | null; vehicle_model: string | null; vehicle_color: string | null; vehicle_plate: string | null }>()
      : null;
    const vehicle = driver?.vehicle_make ? [driver.vehicle_color, driver.vehicle_year, driver.vehicle_make, driver.vehicle_model].filter(Boolean).join(' ') : null;
    const base = tipBaseCents(b);
    return json({
      id: b.id,
      status: b.status,
      stage: b.status === 'assigned' ? (b.picked_up_at ? 'to_dropoff' : b.arrived_at ? 'at_pickup' : 'to_pickup') : b.status,
      item: itemBySlug(b.item)?.label ?? b.item,
      when: whenText(b),
      pickup: b.pickup_address,
      dropoff: b.dropoff_address,
      priceCents: b.price_cents,
      capturedCents: b.captured_cents,
      cancelFeeCents: b.cancel_fee_cents,
      decideBy: b.dispatch_expires_at,
      freeCancelUntil: b.confirmed_at && b.status === 'dispatching' ? new Date(Date.parse(b.confirmed_at) + CANCEL_FREE_MS).toISOString() : null,
      driver: driver ? { firstName: driver.preferred_name || driver.first_name || driver.name.split(/\s+/)[0], phone: driver.phone, vehicle, plate: driver.vehicle_plate } : null,
      cancel: cancelTerms(b),
      cancelReason: b.cancel_reason,
      noShowAt: noShowAvailableAt(b)?.toISOString() ?? null,
      dumpHoldCents: b.dump_hold_cents,
      completedAt: b.completed_at,
      tip: { allowed: canTip(b), paidCents: b.tip_cents, baseCents: base, suggestions: tipSuggestions(base), defaultPercent: DEFAULT_TIP_PERCENT },
    });
  });
