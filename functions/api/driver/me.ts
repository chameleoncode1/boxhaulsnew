/** POST /api/driver/me — the signed-in driver's full profile and enrollment checklist, or { signedIn: false }. */
import type { Env } from '../../_lib/env';
import { assertSameOrigin, handle, json } from '../../_lib/http';
import { sessionUser } from '../../_lib/auth';
import { publicDriver, type DriverRow } from '../../_lib/drivers';

export const onRequestPost: PagesFunction<Env> = ({ request, env }) =>
  handle(async () => {
    assertSameOrigin(request);
    const id = await sessionUser(env, request, 'driver');
    if (!id) return json({ signedIn: false });
    const d = await env.DB.prepare(`SELECT * FROM drivers WHERE id = ? AND app_user = 1 AND application_status != 'deleted'`).bind(id).first<DriverRow>();
    if (!d) return json({ signedIn: false });
    return json({ signedIn: true, driver: await publicDriver(env, d) });
  });
