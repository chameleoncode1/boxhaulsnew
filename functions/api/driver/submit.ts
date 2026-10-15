/** POST /api/driver/submit — send the finished application to BoxHauls for review. Emails the booking-alert address when email is set up. */
import type { Env } from '../../_lib/env';
import { assertSameOrigin, handle, HttpError, json } from '../../_lib/http';
import { requireUser } from '../../_lib/auth';
import { checklist, getDriver, publicDriver, readyToSubmit } from '../../_lib/drivers';
import { sendNotice } from '../../_lib/email';

export const onRequestPost: PagesFunction<Env> = ({ request, env }) =>
  handle(async () => {
    assertSameOrigin(request);
    const id = await requireUser(env, request, 'driver');
    const d = await getDriver(env, id);
    if (!['applying', 'rejected'].includes(d.application_status)) throw new HttpError(409, 'already', 'Your application is already submitted.');
    const steps = await checklist(env, d);
    if (!readyToSubmit(steps)) throw new HttpError(422, 'incomplete', `Finish these first: ${steps.filter((s) => s.state === 'todo').map((s) => s.label).join(', ')}.`);
    await env.DB.prepare(`UPDATE drivers SET application_status = 'submitted', submitted_at = ?, rejection_reason = NULL, updated_at = ? WHERE id = ?`).bind(new Date().toISOString(), new Date().toISOString(), id).run();
    if (env.BOOKING_ALERT_TO) {
      await sendNotice(env, env.BOOKING_ALERT_TO, `New driver application: ${d.first_name} ${d.last_name} (${d.id})`, `${d.first_name} ${d.last_name} submitted a BoxHauls Driver application.\n\nReview it with: npm run drivers -- show ${d.id}\nApprove with: npm run drivers -- approve ${d.id}`);
    }
    return json({ ok: true, driver: await publicDriver(env, await getDriver(env, id)) });
  });
