/**
 * POST /api/auth/forgot — send a password-reset code. Body: { app, email }.
 * The code goes by text to the phone on the account (when Twilio is live), otherwise by email (when email is set up).
 * Always answers the same way, so it can't be used to find out who has an account.
 */
import type { Env } from '../../_lib/env';
import { assertSameOrigin, handle, HttpError, json, readJson } from '../../_lib/http';
import { issueCode, normEmail, phoneLoginAvailable } from '../../_lib/auth';
import { appOf, findByEmail } from '../../_lib/accounts';
import { emailConfigured, sendNotice } from '../../_lib/email';
import { sendSms } from '../../_lib/sms';

export const onRequestPost: PagesFunction<Env> = ({ request, env }) =>
  handle(async () => {
    assertSameOrigin(request);
    if (!phoneLoginAvailable(env) && !emailConfigured(env)) throw new HttpError(503, 'reset_unavailable', 'Password reset isn’t available yet. Contact support and we’ll help you get back in.');
    const body = await readJson<Record<string, unknown>>(request);
    const app = appOf(body.app);
    const email = normEmail(body.email);
    const user = await findByEmail(env, app, email);
    if (user) {
      const code = await issueCode(env, app, 'password_reset', email);
      const name = app === 'driver' ? 'BoxHauls Driver' : 'BoxHauls';
      const msg = `${code} is your ${name} password reset code. It expires in 10 minutes. If you didn't ask for this, ignore it.`;
      if (!(phoneLoginAvailable(env) && user.phone && (await sendSms(env, user.phone, msg)))) await sendNotice(env, email, `${name} password reset`, msg);
    }
    return json({ sent: true });
  });
