/** POST /api/cancel — customer cancels. Body: { token } or { id } (signed in). Applies the policy in functions/_lib/payments.ts. */
import type { Env } from '../_lib/env';
import { tripFor } from '../_lib/tripAccess';
import { assertSameOrigin, handle, json, readJson } from '../_lib/http';
import { cancelBooking } from '../_lib/payments';

export const onRequestPost: PagesFunction<Env> = ({ request, env }) =>
  handle(async () => {
    assertSameOrigin(request);
    const b = await tripFor(env, request, await readJson(request));
    const { feeCents } = await cancelBooking(env, b);
    return json({ id: b.id, status: 'canceled', feeCents });
  });
