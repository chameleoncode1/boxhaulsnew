/** POST /api/tip-confirm — after the bank's authentication step, record the tip. Body: { token } or { id }, plus { tipId }. */
import type { Env } from '../_lib/env';
import { assertSameOrigin, handle, json, readJson, str } from '../_lib/http';
import { confirmTip } from '../_lib/tips';
import { tripFor } from '../_lib/tripAccess';
import { getBooking } from '../_lib/payments';

export const onRequestPost: PagesFunction<Env> = ({ request, env }) =>
  handle(async () => {
    assertSameOrigin(request);
    const body = await readJson<Record<string, unknown>>(request);
    const b = await tripFor(env, request, body);
    await confirmTip(env, b.id, str(body.tipId, 30));
    const after = await getBooking(env, b.id);
    return json({ status: 'paid', tipCents: after?.tip_cents ?? 0 });
  });
