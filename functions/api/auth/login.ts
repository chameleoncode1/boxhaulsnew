/** POST /api/auth/login — email + password sign-in. Body: { app: 'customer' | 'driver', email, password }. */
import type { Env } from '../../_lib/env';
import { assertSameOrigin, handle, HttpError, json, readJson, str } from '../../_lib/http';
import { assertNotLocked, failureKeys, normEmail, recordFailure, startSession, verifyPassword, withCookie } from '../../_lib/auth';
import { appOf, findByEmail } from '../../_lib/accounts';

export const onRequestPost: PagesFunction<Env> = ({ request, env }) =>
  handle(async () => {
    assertSameOrigin(request);
    const body = await readJson<Record<string, unknown>>(request);
    const app = appOf(body.app);
    const email = normEmail(body.email);
    const keys = await failureKeys(request, `${app}:${email}`);
    await assertNotLocked(env, keys);
    const user = await findByEmail(env, app, email);
    if (!user || !(await verifyPassword(str(body.password, 200), user.password_hash))) {
      await recordFailure(env, keys);
      throw new HttpError(401, 'bad_login', 'That email and password don’t match.');
    }
    return withCookie(json({ ok: true, id: user.id }), await startSession(env, request, app, user.id));
  });
