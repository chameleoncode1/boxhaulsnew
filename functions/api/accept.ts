/**
 * POST /api/accept — a driver accepts a job from their link. Body: { token }.
 * First accept wins: the assignment is a single conditional UPDATE, so two drivers can't both get the job.
 */
import type { Env } from '../_lib/env';
import { assertSameOrigin, handle, HttpError, json, readJson, str } from '../_lib/http';
import { notifyAssigned, type Driver } from '../_lib/dispatch';
import { itemBySlug } from '../../src/lib/items';
import { findOffer, offerState } from '../_lib/offers';

export const onRequestPost: PagesFunction<Env> = ({ request, env, waitUntil }) =>
  handle(async () => {
    assertSameOrigin(request);
    const { token } = await readJson<{ token?: unknown }>(request);
    const row = await findOffer(env, str(token, 100));
    const state = offerState(row);
    if (state === 'yours') return json({ result: 'yours' });
    if (state === 'taken') throw new HttpError(409, 'taken', 'Another driver already accepted this job.');
    if (state === 'expired') throw new HttpError(410, 'expired', 'This job is no longer available.');

    const driver = await env.DB.prepare('SELECT id, name, phone, has_helper FROM drivers WHERE id = ? AND active = 1').bind(row.offer_driver_id).first<Driver>();
    if (!driver) throw new HttpError(403, 'inactive', 'Your driver account is not active.');
    if (row.helper === 1 && driver.has_helper !== 1) throw new HttpError(403, 'needs_helper', 'This job needs a driver with a helper.');

    const res = await env.DB.prepare(
      `UPDATE bookings SET status = 'assigned', driver_id = ?, assigned_at = ? WHERE id = ? AND status = 'dispatching' AND dispatch_expires_at > ?`,
    )
      .bind(driver.id, new Date().toISOString(), row.id, new Date().toISOString())
      .run();
    if (res.meta.changes !== 1) throw new HttpError(409, 'taken', 'Another driver already accepted this job.');

    waitUntil(notifyAssigned(env, { ...row, item_label: itemBySlug(row.item)?.label ?? row.item }, driver).catch((e) => console.error('assign notify error', e)));
    return json({ result: 'yours' });
  });
