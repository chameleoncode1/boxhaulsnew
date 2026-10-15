/**
 * POST /api/book — step 1 of a booking: create it as pending_payment with a Stripe card authorization.
 * Body: { quote, name, phone, email, when: { type: 'asap' } | { type: 'scheduled', date, window }, notes }.
 * Returns the PaymentIntent client secret for the Payment Element and a customer token for the manage-trip link.
 * Dispatch starts only after the card is authorized (/api/confirm or the Stripe webhook).
 * Refuses up front if payments or texting aren't configured, or no driver with payouts set up qualifies.
 */
import type { Env } from '../_lib/env';
import { assertSameOrigin, handle, HttpError, json, readJson, str } from '../_lib/http';
import { hash, verifyQuote } from '../_lib/quote';
import { smsConfigured } from '../_lib/sms';
import { fresnoToday } from '../_lib/time';
import { eligibleDrivers, newToken } from '../_lib/dispatch';
import { stripe, stripeConfigured, type PaymentIntent } from '../_lib/stripe';
import { itemBySlug } from '../../src/lib/items';
import placeholders from '../../docs/placeholders.json';

const WINDOWS = placeholders.BOOKING_WINDOWS as string[];
const DAYS_AHEAD = Number(placeholders.BOOKING_DAYS_AHEAD);
const MAX_PER_HOUR = 5;

function newId(): string {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return `BH-${[...bytes].map((b) => alphabet[b % alphabet.length]).join('')}`;
}

export const onRequestPost: PagesFunction<Env> = ({ request, env }) =>
  handle(async () => {
    assertSameOrigin(request);
    if (!env.QUOTE_SECRET || !smsConfigured(env) || !stripeConfigured(env)) {
      throw new HttpError(503, 'not_configured', 'Online booking is temporarily unavailable.');
    }
    const body = await readJson<Record<string, unknown>>(request);
    const q = await verifyQuote(str(body.quote, 4000), env.QUOTE_SECRET);

    const name = str(body.name, 100);
    const phoneDigits = str(body.phone, 30).replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '');
    const email = str(body.email, 200).toLowerCase();
    const notes = str(body.notes, 1000);
    if (name.length < 2) throw new HttpError(422, 'bad_name', 'Enter your name.');
    if (phoneDigits.length !== 10) throw new HttpError(422, 'bad_phone', 'Enter a 10-digit US phone number.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw new HttpError(422, 'bad_email', 'Enter a valid email address.');
    const phone = `(${phoneDigits.slice(0, 3)}) ${phoneDigits.slice(3, 6)}-${phoneDigits.slice(6)}`;

    const when = (body.when ?? {}) as { type?: unknown; date?: unknown; window?: unknown };
    let whenType: 'asap' | 'scheduled';
    let date: string | null = null;
    let window: string | null = null;
    if (when.type === 'asap') whenType = 'asap';
    else if (when.type === 'scheduled') {
      whenType = 'scheduled';
      date = str(when.date, 10);
      window = str(when.window, 40);
      const today = fresnoToday();
      const last = new Date(`${today}T12:00:00Z`);
      last.setUTCDate(last.getUTCDate() + DAYS_AHEAD);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < today || date > last.toISOString().slice(0, 10)) {
        throw new HttpError(422, 'bad_date', `Choose a date within the next ${DAYS_AHEAD} days.`);
      }
      if (!WINDOWS.includes(window)) throw new HttpError(422, 'bad_window', 'Choose a time window.');
    } else throw new HttpError(422, 'bad_when', 'Choose ASAP or a scheduled time.');

    const ipHash = await hash(request.headers.get('CF-Connecting-IP') ?? 'unknown', env.QUOTE_SECRET);
    const since = new Date(Date.now() - 3600_000).toISOString();
    const recent = await env.DB.prepare('SELECT COUNT(*) AS n FROM bookings WHERE ip_hash = ? AND created_at > ?').bind(ipHash, since).first<{ n: number }>();
    if ((recent?.n ?? 0) >= MAX_PER_HOUR) throw new HttpError(429, 'rate_limited', 'Too many bookings from this connection. Please call us instead.');

    if (!(await eligibleDrivers(env, q.helper)).length) {
      throw new HttpError(409, 'no_drivers', q.helper ? 'No drivers with a helper are available for online booking right now.' : 'No drivers are available for online booking right now.');
    }

    const id = newId();
    const customerToken = newToken();
    const hold = q.totalCents + (q.dumpHoldCents ?? 0);
    const itemLabel = itemBySlug(q.item)?.label ?? q.item;
    const pi = await stripe<PaymentIntent>(
      env,
      'POST',
      '/payment_intents',
      {
        amount: hold,
        currency: 'usd',
        capture_method: 'manual',
        payment_method_types: ['card'],
        receipt_email: email,
        description: `BoxHauls ${id}: ${itemLabel}`,
        transfer_group: id,
        metadata: { booking_id: id },
      },
      `pi-${id}`,
    );

    await env.DB.prepare(
      `INSERT INTO bookings (id, created_at, status, name, phone, email, pickup_address, pickup_place_id, dropoff_address, dropoff_place_id,
        miles, item, tier, helper, heavy, price_cents, when_type, scheduled_date, scheduled_window, notes, ip_hash,
        payment_intent_id, authorized_cents, customer_token_hash, dump_material, dump_load, dump_hold_cents)
       VALUES (?, ?, 'pending_payment', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(id, new Date().toISOString(), name, phone, email, q.pickup.address, q.pickup.placeId, q.dropoff.address, q.dropoff.placeId,
        q.miles, q.item, q.tier, q.helper ? 1 : 0, q.heavy ? 1 : 0, q.totalCents, whenType, date, window, notes || null, ipHash,
        pi.id, hold, await hash(customerToken, env.QUOTE_SECRET), q.dumpMaterial ?? null, q.dumpLoad ?? null, q.dumpHoldCents ?? null)
      .run();

    return json({ id, clientSecret: pi.client_secret, customerToken, totalCents: q.totalCents, holdCents: hold });
  });
