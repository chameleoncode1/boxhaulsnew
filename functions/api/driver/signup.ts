/**
 * POST /api/driver/signup — create a BoxHauls Driver account (step 1 of enrollment).
 * Body: { firstName, lastName, email, phone, password, city, acceptTerms: true }. Signs in on success.
 */
import type { Env } from '../../_lib/env';
import { assertSameOrigin, handle, HttpError, json, readJson, str } from '../../_lib/http';
import { checkPasswordRules, hashPassword, ipHash, newId, normEmail, normPhone, startSession, withCookie } from '../../_lib/auth';

export const onRequestPost: PagesFunction<Env> = ({ request, env }) =>
  handle(async () => {
    assertSameOrigin(request);
    const b = await readJson<Record<string, unknown>>(request);
    const firstName = str(b.firstName, 60);
    const lastName = str(b.lastName, 60);
    if (!firstName || !lastName) throw new HttpError(422, 'bad_name', 'Enter your first and last name as they appear on your license.');
    const email = normEmail(b.email);
    const phone = normPhone(b.phone);
    const password = str(b.password, 200);
    checkPasswordRules(password);
    if (b.acceptTerms !== true) throw new HttpError(422, 'terms', 'Accept the Terms and Privacy Policy to continue.');
    const taken = await env.DB.prepare(`SELECT email, phone FROM drivers WHERE (email = ? OR phone = ?) AND application_status != 'deleted'`).bind(email, phone).first<{ email: string | null; phone: string }>();
    if (taken?.email === email) throw new HttpError(409, 'email_taken', 'A driver account already uses that email. Sign in instead.');
    if (taken) throw new HttpError(409, 'phone_taken', 'A driver account already uses that phone number. Sign in instead.');

    const id = newId('DRV');
    const now = new Date().toISOString();
    await env.DB.prepare(
      `INSERT INTO drivers (id, name, phone, active, created_at, application_status, app_user, first_name, last_name, email, password_hash, city, state,
         referral_code, signup_ip_hash, updated_at)
       VALUES (?, ?, ?, 1, ?, 'applying', 1, ?, ?, ?, ?, ?, 'CA', ?, ?, ?)`,
    )
      .bind(id, `${firstName} ${lastName}`, phone, now, firstName, lastName, email, await hashPassword(password), str(b.city, 60) || null, newId('R', 6).slice(2), await ipHash(request), now)
      .run();
    return withCookie(json({ ok: true, id }), await startSession(env, request, 'driver', id));
  });
