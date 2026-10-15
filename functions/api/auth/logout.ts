/** POST /api/auth/logout — end this session. Body: { app }. */
import type { Env } from '../../_lib/env';
import { assertSameOrigin, handle, json, readJson } from '../../_lib/http';
import { endSession, withCookie } from '../../_lib/auth';
import { appOf } from '../../_lib/accounts';

export const onRequestPost: PagesFunction<Env> = ({ request, env }) =>
  handle(async () => {
    assertSameOrigin(request);
    const body = await readJson<Record<string, unknown>>(request);
    return withCookie(json({ ok: true }), await endSession(env, request, appOf(body.app)));
  });
