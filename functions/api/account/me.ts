/** POST /api/account/me — the signed-in customer's profile, or { signedIn: false }. */
import type { Env } from '../../_lib/env';
import { assertSameOrigin, handle, json } from '../../_lib/http';
import { sessionUser } from '../../_lib/auth';
import { getCustomer, publicCustomer } from '../../_lib/customers';

export const onRequestPost: PagesFunction<Env> = ({ request, env }) =>
  handle(async () => {
    assertSameOrigin(request);
    const id = await sessionUser(env, request, 'customer');
    if (!id) return json({ signedIn: false });
    const c = await env.DB.prepare(`SELECT id FROM customers WHERE id = ? AND status = 'active'`).bind(id).first();
    if (!c) return json({ signedIn: false });
    return json({ signedIn: true, customer: publicCustomer(await getCustomer(env, id)) });
  });
