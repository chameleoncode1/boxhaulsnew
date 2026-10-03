/** POST /api/places — address suggestions inside the service area. Body: { input, sessionToken }. */
import type { Env } from '../_lib/env';
import { assertSameOrigin, handle, HttpError, json, readJson, str } from '../_lib/http';
import { autocomplete } from '../_lib/maps';

export const onRequestPost: PagesFunction<Env> = ({ request, env }) =>
  handle(async () => {
    assertSameOrigin(request);
    const body = await readJson<{ input?: unknown; sessionToken?: unknown }>(request);
    const input = str(body.input, 200);
    const sessionToken = str(body.sessionToken, 64);
    if (input.length < 3) return json({ suggestions: [] });
    if (!sessionToken) throw new HttpError(400, 'bad_request', 'Missing session.');
    return json({ suggestions: await autocomplete(env, input, sessionToken) });
  });
