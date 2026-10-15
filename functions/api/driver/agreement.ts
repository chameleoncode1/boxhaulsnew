/** POST /api/driver/agreement — accept the driver agreement. Body: { accept: true }. */
import type { Env } from '../../_lib/env';
import { assertSameOrigin, handle, HttpError, json, readJson } from '../../_lib/http';
import { requireUser } from '../../_lib/auth';
import { getDriver, publicDriver } from '../../_lib/drivers';

export const onRequestPost: PagesFunction<Env> = ({ request, env }) =>
  handle(async () => {
    assertSameOrigin(request);
    const id = await requireUser(env, request, 'driver');
    const b = await readJson<{ accept?: unknown }>(request);
    if (b.accept !== true) throw new HttpError(422, 'accept', 'Accept the driver agreement to continue.');
    await env.DB.prepare(`UPDATE drivers SET agreement_accepted_at = ?, agreement_version = '2026-10-15', updated_at = ? WHERE id = ?`).bind(new Date().toISOString(), new Date().toISOString(), id).run();
    return json({ ok: true, driver: await publicDriver(env, await getDriver(env, id)) });
  });
