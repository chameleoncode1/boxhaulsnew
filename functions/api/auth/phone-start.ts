/**
 * POST /api/auth/phone-start — text a 6-digit sign-in code. Body: { app, phone }.
 * Customers can sign up this way; drivers must already have an account (sign-up collects more details).
 * Switched off (503) until Twilio is configured.
 */
import type { Env } from '../../_lib/env';
import { assertSameOrigin, handle, HttpError, json, readJson } from '../../_lib/http';
import { issueCode, normPhone, phoneLoginAvailable } from '../../_lib/auth';
import { appOf, findByPhone } from '../../_lib/accounts';
import { sendSms } from '../../_lib/sms';

export const onRequestPost: PagesFunction<Env> = ({ request, env }) =>
  handle(async () => {
    assertSameOrigin(request);
    if (!phoneLoginAvailable(env)) throw new HttpError(503, 'phone_unavailable', 'Phone sign-in isn’t available yet. Use your email and password.');
    const body = await readJson<Record<string, unknown>>(request);
    const app = appOf(body.app);
    const phone = normPhone(body.phone);
    const existing = await findByPhone(env, app, phone);
    if (app === 'driver' && !existing) throw new HttpError(404, 'no_account', 'No driver account uses that number. Sign up first.');
    const code = await issueCode(env, app, 'phone_login', phone);
    const ok = await sendSms(env, phone, `${code} is your ${app === 'driver' ? 'BoxHauls Driver' : 'BoxHauls'} code. It expires in 10 minutes. Don't share it.`);
    if (!ok) throw new HttpError(502, 'sms_failed', 'We couldn’t text that number. Check it and try again.');
    return json({ sent: true, newAccount: !existing });
  });
