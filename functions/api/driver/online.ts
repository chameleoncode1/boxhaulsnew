/** POST /api/driver/online — go online or offline. Body: { online: boolean }. Only approved drivers with payouts set up can go online. */
import type { Env } from '../../_lib/env';
import { assertSameOrigin, handle, HttpError, json, readJson } from '../../_lib/http';
import { requireUser } from '../../_lib/auth';
import { canDrive, getDriver, setOnline } from '../../_lib/drivers';

export const onRequestPost: PagesFunction<Env> = ({ request, env }) =>
  handle(async () => {
    assertSameOrigin(request);
    const id = await requireUser(env, request, 'driver');
    const d = await getDriver(env, id);
    const b = await readJson<{ online?: unknown }>(request);
    const online = b.online === true;
    if (online && !canDrive(d)) {
      throw new HttpError(403, 'cannot_drive', d.application_status !== 'approved' ? 'You can go online once your account is approved.' : 'Set up payouts before going online.');
    }
    await setOnline(env, d, online);
    return json({ ok: true, online });
  });
