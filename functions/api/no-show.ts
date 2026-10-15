/** POST /api/no-show — the customer reports the driver didn't show. Body: { token } or { id } (signed in). Releases the hold once the pickup time has passed. */
import type { Env } from '../_lib/env';
import { tripFor } from '../_lib/tripAccess';
import { assertSameOrigin, handle, json, readJson } from '../_lib/http';
import { releaseForDriver } from '../_lib/payments';

export const onRequestPost: PagesFunction<Env> = ({ request, env }) =>
  handle(async () => {
    assertSameOrigin(request);
    const b = await tripFor(env, request, await readJson(request));
    await releaseForDriver(env, b, 'no_show');
    return json({ id: b.id, status: 'canceled' });
  });
