/**
 * POST /api/auth/phone-verify — check the texted code and sign in. Body: { app, phone, code, firstName?, lastName?, acceptTerms? }.
 * A new customer number creates an account (first name and terms acceptance required).
 */
import type { Env } from '../../_lib/env';
import { assertSameOrigin, handle, HttpError, json, readJson, str } from '../../_lib/http';
import { consumeCode, ipHash, newId, normPhone, phoneLoginAvailable, startSession, withCookie } from '../../_lib/auth';
import { appOf, findByPhone, tableOf } from '../../_lib/accounts';

export const onRequestPost: PagesFunction<Env> = ({ request, env }) =>
  handle(async () => {
    assertSameOrigin(request);
    if (!phoneLoginAvailable(env)) throw new HttpError(503, 'phone_unavailable', 'Phone sign-in isn’t available yet.');
    const body = await readJson<Record<string, unknown>>(request);
    const app = appOf(body.app);
    const phone = normPhone(body.phone);
    const existing = await findByPhone(env, app, phone);
    const firstName = str(body.firstName, 60);
    if (!existing && app === 'customer' && (firstName.length < 1 || body.acceptTerms !== true)) {
      throw new HttpError(422, 'needs_profile', 'Enter your first name and accept the terms to create your account.');
    }
    await consumeCode(env, app, 'phone_login', phone, str(body.code, 10));
    const now = new Date().toISOString();
    let id = existing?.id;
    if (!id) {
      if (app === 'driver') throw new HttpError(404, 'no_account', 'No driver account uses that number.');
      id = newId('CUS');
      await env.DB.prepare(
        `INSERT INTO customers (id, first_name, last_name, phone, phone_verified_at, terms_accepted_at, terms_version, privacy_accepted_at, signup_source, signup_ip_hash, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, '2026-10-15', ?, 'phone', ?, ?, ?)`,
      )
        .bind(id, firstName, str(body.lastName, 60) || null, phone, now, now, now, await ipHash(request), now, now)
        .run();
    } else {
      await env.DB.prepare(`UPDATE ${tableOf(app)} SET phone_verified_at = COALESCE(phone_verified_at, ?) WHERE id = ?`).bind(now, id).run();
    }
    return withCookie(json({ ok: true, id, created: !existing }), await startSession(env, request, app, id));
  });
