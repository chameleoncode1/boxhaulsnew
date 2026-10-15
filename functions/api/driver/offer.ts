/**
 * POST /api/driver/offer — accept or decline a job. Body: { id, action: 'accept' | 'decline' }.
 * Accepting is first-come: the booking is claimed atomically, then the driver and customer are texted.
 */
import type { Env } from '../../_lib/env';
import { assertSameOrigin, handle, HttpError, json, readJson, str } from '../../_lib/http';
import { requireUser } from '../../_lib/auth';
import { canDrive, getDriver } from '../../_lib/drivers';
import { notifyAssigned } from '../../_lib/dispatch';
import { getBooking } from '../../_lib/payments';
import { tripView } from '../../_lib/driverJobs';
import { sha256 } from '../../_lib/quote';
import { itemBySlug } from '../../../src/lib/items';

export const onRequestPost: PagesFunction<Env> = ({ request, env }) =>
  handle(async () => {
    assertSameOrigin(request);
    const driverId = await requireUser(env, request, 'driver');
    const d = await getDriver(env, driverId);
    const body = await readJson<{ id?: unknown; action?: unknown }>(request);
    const id = str(body.id, 20);
    const now = new Date().toISOString();

    if (body.action === 'decline') {
      await env.DB.prepare('INSERT OR IGNORE INTO offer_declines (booking_id, driver_id, declined_at) VALUES (?, ?, ?)').bind(id, driverId, now).run();
      return json({ ok: true });
    }
    if (body.action !== 'accept') throw new HttpError(400, 'bad_action', 'Unknown action.');
    if (!canDrive(d)) throw new HttpError(403, 'cannot_drive', 'Your account can’t accept jobs right now.');
    const b = await getBooking(env, id);
    if (!b) throw new HttpError(404, 'not_found', 'Job not found.');
    if (b.when_type === 'asap') {
      const busy = await env.DB.prepare(`SELECT id FROM bookings WHERE driver_id = ? AND status = 'assigned' AND when_type = 'asap' LIMIT 1`).bind(driverId).first();
      if (busy) throw new HttpError(409, 'busy', 'Finish your current trip before accepting another ASAP job.');
    }
    const res = await env.DB.prepare(`UPDATE bookings SET status = 'assigned', driver_id = ?, assigned_at = ? WHERE id = ? AND status = 'dispatching' AND dispatch_expires_at > ?`)
      .bind(driverId, now, id, now)
      .run();
    if (res.meta.changes !== 1) throw new HttpError(409, 'taken', 'Another driver already accepted this job.');
    // Keep the offers table complete for records (app accepts have no text link).
    await env.DB.prepare(`INSERT OR IGNORE INTO offers (booking_id, driver_id, token_hash, sent_at, sms_status) VALUES (?, ?, ?, ?, 'app')`).bind(id, driverId, await sha256(`app:${id}:${driverId}`), now).run();
    const fresh = (await getBooking(env, id))!;
    await notifyAssigned(env, { ...fresh, item_label: itemBySlug(fresh.item)?.label ?? fresh.item }, { id: d.id, name: d.preferred_name || d.first_name || d.name, phone: d.phone });
    return json({ ok: true, trip: tripView(fresh) });
  });
