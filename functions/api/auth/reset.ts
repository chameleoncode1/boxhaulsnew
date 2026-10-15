/** POST /api/auth/reset — set a new password with the reset code, and sign in. Body: { app, email, code, password }. Signs out other devices. */
import type { Env } from '../../_lib/env';
import { assertSameOrigin, handle, HttpError, json, readJson, str } from '../../_lib/http';
import { checkPasswordRules, consumeCode, hashPassword, normEmail, startSession, withCookie } from '../../_lib/auth';
import { appOf, findByEmail, tableOf } from '../../_lib/accounts';

export const onRequestPost: PagesFunction<Env> = ({ request, env }) =>
  handle(async () => {
    assertSameOrigin(request);
    const body = await readJson<Record<string, unknown>>(request);
    const app = appOf(body.app);
    const email = normEmail(body.email);
    const password = str(body.password, 200);
    checkPasswordRules(password);
    const user = await findByEmail(env, app, email);
    if (!user) throw new HttpError(422, 'bad_code', 'That code is wrong or has expired. Request a new one.');
    await consumeCode(env, app, 'password_reset', email, str(body.code, 10));
    await env.DB.prepare(`UPDATE ${tableOf(app)} SET password_hash = ?, updated_at = ? WHERE id = ?`).bind(await hashPassword(password), new Date().toISOString(), user.id).run();
    await env.DB.prepare('DELETE FROM sessions WHERE user_type = ? AND user_id = ?').bind(app, user.id).run();
    return withCookie(json({ ok: true }), await startSession(env, request, app, user.id));
  });
