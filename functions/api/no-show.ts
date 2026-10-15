/** POST /api/no-show — the customer reports the driver didn't show. Body: { token }. Releases the hold once the pickup time has passed. */
import type { Env } from '../_lib/env';
import { assertSameOrigin, handle, json, readJson, str } from '../_lib/http';
import { bookingByCustomerToken, releaseForDriver } from '../_lib/payments';

export const onRequestPost: PagesFunction<Env> = ({ request, env }) =>
  handle(async () => {
    assertSameOrigin(request);
    const { token } = await readJson<{ token?: unknown }>(request);
    const b = await bookingByCustomerToken(env, str(token, 100));
    await releaseForDriver(env, b, 'no_show');
    return json({ id: b.id, status: 'canceled' });
  });
