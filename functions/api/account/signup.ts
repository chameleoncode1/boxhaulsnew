/**
 * POST /api/account/signup — create a customer account. Body: { firstName, lastName, email, phone, password,
 * marketingEmail?, acceptTerms: true }. Signs in on success.
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
    if (!firstName) throw new HttpError(422, 'bad_name', 'Enter your first name.');
    if (!lastName) throw new HttpError(422, 'bad_name', 'Enter your last name.');
    const email = normEmail(b.email);
    const phone = normPhone(b.phone);
    const password = str(b.password, 200);
    checkPasswordRules(password);
    if (b.acceptTerms !== true) throw new HttpError(422, 'terms', 'Accept the Terms of Service and Privacy Policy to create an account.');

    const taken = await env.DB.prepare(`SELECT email, phone FROM customers WHERE (email = ? OR phone = ?) AND status != 'deleted'`).bind(email, phone).first<{ email: string; phone: string }>();
    if (taken?.email === email) throw new HttpError(409, 'email_taken', 'An account already uses that email. Sign in instead.');
    if (taken) throw new HttpError(409, 'phone_taken', 'An account already uses that phone number. Sign in instead.');

    const id = newId('CUS');
    const now = new Date().toISOString();
    await env.DB.prepare(
      `INSERT INTO customers (id, first_name, last_name, email, phone, password_hash, marketing_email_opt_in, terms_accepted_at, terms_version,
         privacy_accepted_at, referral_code, signup_source, signup_ip_hash, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, '2026-10-15', ?, ?, ?, ?, ?, ?)`,
    )
      .bind(id, firstName, lastName, email, phone, await hashPassword(password), b.marketingEmail === true ? 1 : 0, now, now, newId('R', 6).slice(2), str(b.source, 20) || 'web', await ipHash(request), now, now)
      .run();
    return withCookie(json({ ok: true, id }), await startSession(env, request, 'customer', id));
  });
