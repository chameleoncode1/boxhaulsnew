/** Customer records: the public view of an account, and account deletion (anonymizes; keeps trip and payment records). */
import type { Env } from './env';
import { HttpError } from './http';
import { displayPhone } from './auth';
import { stripe } from './stripe';
import { cityOf } from './dispatch';

export interface CustomerRow {
  id: string;
  status: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  email_verified_at: string | null;
  phone: string | null;
  phone_verified_at: string | null;
  password_hash: string | null;
  home_address: string | null;
  home_place_id: string | null;
  work_address: string | null;
  work_place_id: string | null;
  stripe_customer_id: string | null;
  default_card_brand: string | null;
  default_card_last4: string | null;
  default_card_exp: string | null;
  sms_opt_in: number;
  marketing_email_opt_in: number;
  marketing_sms_opt_in: number;
  preferred_language: string;
  created_at: string;
}

export async function getCustomer(env: Env, id: string): Promise<CustomerRow> {
  const c = await env.DB.prepare(`SELECT * FROM customers WHERE id = ? AND status = 'active'`).bind(id).first<CustomerRow>();
  if (!c) throw new HttpError(401, 'signed_out', 'Please sign in.');
  return c;
}

export function publicCustomer(c: CustomerRow) {
  return {
    id: c.id,
    firstName: c.first_name ?? '',
    lastName: c.last_name ?? '',
    email: c.email ?? '',
    emailVerified: Boolean(c.email_verified_at),
    phone: displayPhone(c.phone),
    phoneVerified: Boolean(c.phone_verified_at),
    hasPassword: Boolean(c.password_hash),
    home: c.home_address ? { address: c.home_address, placeId: c.home_place_id } : null,
    work: c.work_address ? { address: c.work_address, placeId: c.work_place_id } : null,
    card: c.default_card_last4 ? { brand: c.default_card_brand, last4: c.default_card_last4, exp: c.default_card_exp } : null,
    smsOptIn: Boolean(c.sms_opt_in),
    marketingEmail: Boolean(c.marketing_email_opt_in),
    marketingSms: Boolean(c.marketing_sms_opt_in),
    language: c.preferred_language,
    memberSince: c.created_at,
  };
}

const ACTIVE = `('pending_payment','dispatching','assigned')`;

/**
 * Delete a customer account. Refused while a trip is in progress. Personal data is removed from the account and
 * from past bookings (name, phone, email, notes; addresses reduced to the city); the trip and payment amounts are
 * kept for accounting. The saved card is deleted from Stripe.
 */
export async function deleteCustomer(env: Env, c: CustomerRow, reason: string | null): Promise<void> {
  const active = await env.DB.prepare(`SELECT id FROM bookings WHERE customer_id = ? AND status IN ${ACTIVE} LIMIT 1`).bind(c.id).first<{ id: string }>();
  if (active) throw new HttpError(409, 'active_trip', `You have a trip in progress (${active.id}). Cancel it or wait until it's done, then delete your account.`);

  if (c.stripe_customer_id) {
    try {
      await stripe(env, 'DELETE', `/customers/${c.stripe_customer_id}`);
    } catch (e) {
      console.error('stripe customer delete failed', c.id, e);
    }
  }
  const trips = await env.DB.prepare('SELECT id, pickup_address, dropoff_address FROM bookings WHERE customer_id = ?').bind(c.id).all<{ id: string; pickup_address: string; dropoff_address: string }>();
  for (const t of trips.results) {
    await env.DB.prepare(`UPDATE bookings SET name = 'Deleted customer', phone = '', email = '', notes = NULL, pickup_address = ?, dropoff_address = ?, stripe_customer_id = NULL, payment_method_id = NULL WHERE id = ?`)
      .bind(cityOf(t.pickup_address), cityOf(t.dropoff_address), t.id)
      .run();
  }
  const now = new Date().toISOString();
  await env.DB.prepare(
    `UPDATE customers SET status = 'deleted', first_name = NULL, last_name = NULL, email = NULL, email_verified_at = NULL, phone = NULL, phone_verified_at = NULL,
       password_hash = NULL, home_address = NULL, home_place_id = NULL, work_address = NULL, work_place_id = NULL, stripe_customer_id = NULL,
       default_card_brand = NULL, default_card_last4 = NULL, default_card_exp = NULL, referral_code = NULL, signup_ip_hash = NULL,
       last_login_ip_hash = NULL, last_user_agent = NULL, updated_at = ?, deleted_at = ? WHERE id = ?`,
  )
    .bind(now, now, c.id)
    .run();
  await env.DB.prepare('DELETE FROM sessions WHERE user_type = ? AND user_id = ?').bind('customer', c.id).run();
  await env.DB.prepare('INSERT INTO account_deletions (user_type, user_id, deleted_at, reason) VALUES (?, ?, ?, ?)').bind('customer', c.id, now, reason).run();
}
