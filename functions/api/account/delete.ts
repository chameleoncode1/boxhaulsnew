/** POST /api/account/delete — delete the signed-in customer's account. Body: { confirm: 'DELETE', reason? }. */
import type { Env } from '../../_lib/env';
import { assertSameOrigin, handle, HttpError, json, readJson, str } from '../../_lib/http';
import { endSession, requireUser, withCookie } from '../../_lib/auth';
import { deleteCustomer, getCustomer } from '../../_lib/customers';

export const onRequestPost: PagesFunction<Env> = ({ request, env }) =>
  handle(async () => {
    assertSameOrigin(request);
    const id = await requireUser(env, request, 'customer');
    const b = await readJson<Record<string, unknown>>(request);
    if (b.confirm !== 'DELETE') throw new HttpError(422, 'confirm', 'Type DELETE to confirm.');
    await deleteCustomer(env, await getCustomer(env, id), str(b.reason, 300) || null);
    return withCookie(json({ ok: true }), await endSession(env, request, 'customer'));
  });
