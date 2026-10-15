/**
 * POST /api/driver/trip — move an assigned trip along. Body: { id, step: 'arrived' | 'picked_up' | 'complete' | 'cancel', dumpFeeCents? }.
 * arrived / picked_up text the customer. complete charges the customer and pays the driver (and tips). cancel releases the hold.
 */
import type { Env } from '../../_lib/env';
import { assertSameOrigin, handle, HttpError, json, readJson, str } from '../../_lib/http';
import { requireUser } from '../../_lib/auth';
import { getDriver } from '../../_lib/drivers';
import { completeBooking, getBooking, releaseForDriver } from '../../_lib/payments';
import { sendSms, toE164 } from '../../_lib/sms';
import { tripView } from '../../_lib/driverJobs';

export const onRequestPost: PagesFunction<Env> = ({ request, env }) =>
  handle(async () => {
    assertSameOrigin(request);
    const driverId = await requireUser(env, request, 'driver');
    const d = await getDriver(env, driverId);
    const body = await readJson<{ id?: unknown; step?: unknown; dumpFeeCents?: unknown }>(request);
    const b = await getBooking(env, str(body.id, 20));
    if (!b || b.driver_id !== driverId) throw new HttpError(404, 'not_found', 'Trip not found.');
    if (b.status !== 'assigned') throw new HttpError(409, 'changed', `This trip is ${b.status}.`);
    const first = d.preferred_name || d.first_name || d.name.split(/\s+/)[0];
    const now = new Date().toISOString();

    switch (body.step) {
      case 'arrived':
        await env.DB.prepare('UPDATE bookings SET arrived_at = COALESCE(arrived_at, ?) WHERE id = ?').bind(now, b.id).run();
        if (!b.arrived_at) await sendSms(env, toE164(b.phone), `BoxHauls: ${first} has arrived at pickup for ${b.id}.`);
        break;
      case 'picked_up':
        await env.DB.prepare('UPDATE bookings SET arrived_at = COALESCE(arrived_at, ?), picked_up_at = COALESCE(picked_up_at, ?) WHERE id = ?').bind(now, now, b.id).run();
        if (!b.picked_up_at) await sendSms(env, toE164(b.phone), `BoxHauls: your items are loaded. ${first} is heading to the drop-off for ${b.id}.`);
        break;
      case 'complete': {
        const dump = typeof body.dumpFeeCents === 'number' && Number.isFinite(body.dumpFeeCents) ? body.dumpFeeCents : 0;
        const r = await completeBooking(env, b, { id: d.id, stripe_account_id: d.stripe_account_id }, dump);
        return json({ ok: true, completed: r });
      }
      case 'cancel':
        await releaseForDriver(env, b, 'driver');
        return json({ ok: true, canceled: true });
      default:
        throw new HttpError(400, 'bad_step', 'Unknown step.');
    }
    return json({ ok: true, trip: tripView((await getBooking(env, b.id))!) });
  });
