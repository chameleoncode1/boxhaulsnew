/**
 * POST /api/account/update — edit the signed-in customer's profile. Any of: { firstName, lastName, email, phone,
 * home: { address, placeId } | null, work: … | null, smsOptIn, marketingEmail, marketingSms, language,
 * currentPassword + newPassword, removeCard }.
 */
import type { Env } from '../../_lib/env';
import { assertSameOrigin, handle, HttpError, json, readJson, str } from '../../_lib/http';
import { checkPasswordRules, hashPassword, normEmail, normPhone, requireUser, verifyPassword } from '../../_lib/auth';
import { getCustomer, publicCustomer } from '../../_lib/customers';

export const onRequestPost: PagesFunction<Env> = ({ request, env }) =>
  handle(async () => {
    assertSameOrigin(request);
    const id = await requireUser(env, request, 'customer');
    const c = await getCustomer(env, id);
    const b = await readJson<Record<string, unknown>>(request);
    const set: Record<string, unknown> = {};

    if ('firstName' in b) set.first_name = str(b.firstName, 60) || c.first_name;
    if ('lastName' in b) set.last_name = str(b.lastName, 60) || c.last_name;
    if ('email' in b) {
      const email = normEmail(b.email);
      if (email !== c.email) {
        const taken = await env.DB.prepare(`SELECT id FROM customers WHERE email = ? AND id != ?`).bind(email, id).first();
        if (taken) throw new HttpError(409, 'email_taken', 'Another account uses that email.');
        set.email = email;
        set.email_verified_at = null;
      }
    }
    if ('phone' in b) {
      const phone = normPhone(b.phone);
      if (phone !== c.phone) {
        const taken = await env.DB.prepare(`SELECT id FROM customers WHERE phone = ? AND id != ?`).bind(phone, id).first();
        if (taken) throw new HttpError(409, 'phone_taken', 'Another account uses that phone number.');
        set.phone = phone;
        set.phone_verified_at = null;
      }
    }
    for (const place of ['home', 'work'] as const) {
      if (place in b) {
        const v = b[place] as { address?: unknown; placeId?: unknown } | null;
        set[`${place}_address`] = v ? str(v.address, 300) || null : null;
        set[`${place}_place_id`] = v ? str(v.placeId, 300) || null : null;
      }
    }
    if ('smsOptIn' in b) set.sms_opt_in = b.smsOptIn === true ? 1 : 0;
    if ('marketingEmail' in b) set.marketing_email_opt_in = b.marketingEmail === true ? 1 : 0;
    if ('marketingSms' in b) set.marketing_sms_opt_in = b.marketingSms === true ? 1 : 0;
    if ('language' in b) set.preferred_language = b.language === 'es' ? 'es' : 'en';
    if ('newPassword' in b) {
      const next = str(b.newPassword, 200);
      checkPasswordRules(next);
      if (c.password_hash && !(await verifyPassword(str(b.currentPassword, 200), c.password_hash))) throw new HttpError(401, 'bad_password', 'Your current password is wrong.');
      set.password_hash = await hashPassword(next);
    }
    if (b.removeCard === true) Object.assign(set, { default_card_brand: null, default_card_last4: null, default_card_exp: null });

    const keys = Object.keys(set);
    if (keys.length) {
      set.updated_at = new Date().toISOString();
      const cols = Object.keys(set);
      await env.DB.prepare(`UPDATE customers SET ${cols.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`).bind(...cols.map((k) => set[k]), id).run();
    }
    return json({ ok: true, customer: publicCustomer(await getCustomer(env, id)) });
  });
