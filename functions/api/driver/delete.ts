/** POST /api/driver/delete — delete the signed-in driver's account. Body: { confirm: 'DELETE', reason? }. */
import type { Env } from '../../_lib/env';
import { assertSameOrigin, handle, HttpError, json, readJson, str } from '../../_lib/http';
import { endSession, requireUser, withCookie } from '../../_lib/auth';
import { deleteDriver, getDriver } from '../../_lib/drivers';

export const onRequestPost: PagesFunction<Env> = ({ request, env }) =>
  handle(async () => {
    assertSameOrigin(request);
    const id = await requireUser(env, request, 'driver');
    const b = await readJson<{ confirm?: unknown; reason?: unknown }>(request);
    if (b.confirm !== 'DELETE') throw new HttpError(422, 'confirm', 'Type DELETE to confirm.');
    await deleteDriver(env, await getDriver(env, id), str(b.reason, 300) || null);
    return withCookie(json({ ok: true }), await endSession(env, request, 'driver'));
  });
