/** POST /api/cancel — customer cancels. Body: { token }. Applies the policy in functions/_lib/payments.ts. */
import type { Env } from '../_lib/env';
import { assertSameOrigin, handle, json, readJson, str } from '../_lib/http';
import { bookingByCustomerToken, cancelBooking } from '../_lib/payments';

export const onRequestPost: PagesFunction<Env> = ({ request, env }) =>
  handle(async () => {
    assertSameOrigin(request);
    const { token } = await readJson<{ token?: unknown }>(request);
    const b = await bookingByCustomerToken(env, str(token, 100));
    const { feeCents } = await cancelBooking(env, b);
    return json({ id: b.id, status: 'canceled', feeCents });
  });
