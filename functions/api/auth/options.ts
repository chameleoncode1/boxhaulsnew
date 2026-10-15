/** POST /api/auth/options — which sign-in methods are switched on (phone codes need Twilio; resets need texts or email). */
import type { Env } from '../../_lib/env';
import { assertSameOrigin, handle, json } from '../../_lib/http';
import { phoneLoginAvailable } from '../../_lib/auth';
import { emailConfigured } from '../../_lib/email';

export const onRequestPost: PagesFunction<Env> = ({ request, env }) =>
  handle(async () => {
    assertSameOrigin(request);
    return json({ phone: phoneLoginAvailable(env), passwordReset: phoneLoginAvailable(env) || emailConfigured(env) });
  });
