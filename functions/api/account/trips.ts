/** POST /api/account/trips — the signed-in customer's trips, newest first (50). */
import type { Env } from '../../_lib/env';
import { assertSameOrigin, handle, json } from '../../_lib/http';
import { requireUser } from '../../_lib/auth';
import { whenText } from '../../_lib/dispatch';
import { itemBySlug } from '../../../src/lib/items';

export const onRequestPost: PagesFunction<Env> = ({ request, env }) =>
  handle(async () => {
    assertSameOrigin(request);
    const id = await requireUser(env, request, 'customer');
    const rows = await env.DB.prepare(
      `SELECT id, status, item, when_type, scheduled_date, scheduled_window, pickup_address, dropoff_address, price_cents, captured_cents, tip_cents, created_at, completed_at
         FROM bookings WHERE customer_id = ? AND status != 'pending_payment' ORDER BY created_at DESC LIMIT 50`,
    )
      .bind(id)
      .all<Record<string, string | number | null>>();
    return json({
      trips: rows.results.map((r) => ({
        id: r.id,
        status: r.status,
        item: itemBySlug(String(r.item))?.label ?? r.item,
        when: whenText(r as never),
        pickup: r.pickup_address,
        dropoff: r.dropoff_address,
        totalCents: (r.captured_cents as number | null) ?? r.price_cents,
        tipCents: r.tip_cents,
        createdAt: r.created_at,
      })),
    });
  });
