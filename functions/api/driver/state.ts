/**
 * POST /api/driver/state — the app's live poll (every few seconds while online). Body: { lat?, lng? }.
 * Records the check-in (keeps the driver online) and returns open offers, assigned trips and today's earnings.
 */
import type { Env } from '../../_lib/env';
import { assertSameOrigin, handle, json, readJson } from '../../_lib/http';
import { requireUser } from '../../_lib/auth';
import { canDrive, getDriver } from '../../_lib/drivers';
import { earnings, isOnline, offerView, openOffers, tripView } from '../../_lib/driverJobs';
import { fresnoInstant, fresnoToday } from '../../_lib/time';
import type { FullBooking } from '../../_lib/payments';

export const onRequestPost: PagesFunction<Env> = ({ request, env }) =>
  handle(async () => {
    assertSameOrigin(request);
    const id = await requireUser(env, request, 'driver');
    const d = await getDriver(env, id);
    const b = await readJson<{ lat?: unknown; lng?: unknown }>(request);
    const lat = typeof b.lat === 'number' && Math.abs(b.lat) <= 90 ? b.lat : null;
    const lng = typeof b.lng === 'number' && Math.abs(b.lng) <= 180 ? b.lng : null;
    if (d.online) {
      await env.DB.prepare('UPDATE drivers SET last_seen_at = ?, last_lat = COALESCE(?, last_lat), last_lng = COALESCE(?, last_lng) WHERE id = ?').bind(new Date().toISOString(), lat, lng, id).run();
    }
    const online = Boolean(d.online) && (isOnline({ ...d, last_seen_at: new Date().toISOString() }));
    const assigned = await env.DB.prepare(`SELECT * FROM bookings WHERE driver_id = ? AND status = 'assigned' ORDER BY when_type = 'asap' DESC, scheduled_date, assigned_at`).bind(id).all<FullBooking>();
    const offers = canDrive(d) && !assigned.results.some((t) => t.when_type === 'asap') ? await openOffers(env, id, online) : [];
    const today = await earnings(env, id, fresnoInstant(fresnoToday(), '00:00').toISOString());
    return json({
      online,
      canDrive: canDrive(d),
      status: d.application_status,
      offers: offers.map(offerView),
      trips: assigned.results.map(tripView),
      today: { cents: today.trips.reduce((s, t) => s + t.fareCents + t.tipCents, 0), trips: today.trips.filter((t) => !t.canceled).length, onlineMinutes: today.onlineMinutes },
    });
  });
