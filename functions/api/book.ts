/**
 * POST /api/book — save a booking request.
 * Body: { quote, name, phone, email, when: { type: 'asap' } | { type: 'scheduled', date, window }, notes }.
 * Accepts only a quote this server signed. No payment is taken online. Saves to D1, then emails BoxHauls
 * (and a receipt to the customer) in the background when email sending is configured.
 */
import type { Env } from '../_lib/env';
import { assertSameOrigin, handle, HttpError, json, readJson, str } from '../_lib/http';
import { hash, verifyQuote } from '../_lib/quote';
import { sendBookingEmails } from '../_lib/email';
import { itemBySlug, TIERS } from '../../src/lib/items';
import placeholders from '../../docs/placeholders.json';

const WINDOWS = placeholders.BOOKING_WINDOWS as string[];
const DAYS_AHEAD = Number(placeholders.BOOKING_DAYS_AHEAD);
const MAX_PER_HOUR = 5;

function newId(): string {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return `BH-${[...bytes].map((b) => alphabet[b % alphabet.length]).join('')}`;
}

/** Today's date in Fresno (America/Los_Angeles) as YYYY-MM-DD. */
function fresnoToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' }).format(new Date());
}

export const onRequestPost: PagesFunction<Env> = ({ request, env, waitUntil }) =>
  handle(async () => {
    assertSameOrigin(request);
    if (!env.QUOTE_SECRET) throw new HttpError(503, 'not_configured', 'Online booking is temporarily unavailable.');
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

    // Rate limit: a handful of bookings per client per hour.
    const ipHash = await hash(request.headers.get('CF-Connecting-IP') ?? 'unknown', env.QUOTE_SECRET);
    const since = new Date(Date.now() - 3600_000).toISOString();
    const recent = await env.DB.prepare('SELECT COUNT(*) AS n FROM bookings WHERE ip_hash = ? AND created_at > ?').bind(ipHash, since).first<{ n: number }>();
    if ((recent?.n ?? 0) >= MAX_PER_HOUR) throw new HttpError(429, 'rate_limited', 'Too many bookings from this connection. Please call us instead.');

    const id = newId();
    await env.DB.prepare(
      `INSERT INTO bookings (id, created_at, name, phone, email, pickup_address, pickup_place_id, dropoff_address, dropoff_place_id,
        miles, item, tier, helper, heavy, price_cents, when_type, scheduled_date, scheduled_window, notes, ip_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(id, new Date().toISOString(), name, phone, email, q.pickup.address, q.pickup.placeId, q.dropoff.address, q.dropoff.placeId,
        q.miles, q.item, q.tier, q.helper ? 1 : 0, q.heavy ? 1 : 0, q.totalCents, whenType, date, window, notes || null, ipHash)
      .run();

    const total = `$${(q.totalCents / 100).toFixed(2)}`;
    const whenText = whenType === 'asap' ? 'As soon as possible' : `${date}, ${window}`;
    waitUntil(
      sendBookingEmails(env, {
        id, name, phone, email, notes, total, when: whenText, miles: q.miles, helper: q.helper,
        pickup: q.pickup.address, dropoff: q.dropoff.address,
        item: itemBySlug(q.item)?.label ?? q.item,
        tier: TIERS.find((t) => t.key === q.tier)?.name ?? q.tier,
      })
        .then((status) => env.DB.prepare('UPDATE bookings SET alert_status = ? WHERE id = ?').bind(status, id).run())
        .catch((e) => console.error('booking alert error', e)),
    );

    return json({ id, total, when: whenText, phone });
  });
