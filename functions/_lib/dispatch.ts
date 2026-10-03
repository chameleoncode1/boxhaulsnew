/**
 * Auto-dispatch. A new booking is offered by text to every active driver who qualifies (helper jobs only go to
 * drivers with a helper). Each driver gets their own accept link. The first driver to accept is assigned
 * atomically; the customer is texted at each step. Unaccepted bookings expire (see workers/dispatch-cron).
 */
import type { Env } from './env';
import { hash } from './quote';
import { sendSms, toE164 } from './sms';
import { fresnoInstant, shortDate } from './time';
import placeholders from '../../docs/placeholders.json';

const ph = placeholders as Record<string, unknown>;
const WINDOWS = ph.BOOKING_WINDOWS as string[];
const STARTS = ph.BOOKING_WINDOW_STARTS as string[];
const ASAP_MIN = Number(ph.DISPATCH_ASAP_MINUTES);
const LEAD_H = Number(ph.DISPATCH_SCHEDULED_LEAD_HOURS);
const SHARE = Number(String(ph.DRIVER_SHARE).replace('%', '')) / 100;
const OFFICE_PHONE = String(ph.PHONE);

export interface BookingRow {
  id: string;
  name: string;
  phone: string;
  pickup_address: string;
  dropoff_address: string;
  miles: number;
  item: string;
  item_label?: string;
  helper: number;
  price_cents: number;
  when_type: 'asap' | 'scheduled';
  scheduled_date: string | null;
  scheduled_window: string | null;
  notes: string | null;
}

export interface Driver {
  id: string;
  name: string;
  phone: string;
  has_helper: number;
}

/** When dispatch gives up: ASAP → N minutes; scheduled → LEAD hours before the window (at least N minutes from now). */
export function dispatchDeadline(b: Pick<BookingRow, 'when_type' | 'scheduled_date' | 'scheduled_window'>, now = new Date()): Date {
  const minimum = new Date(now.getTime() + ASAP_MIN * 60_000);
  if (b.when_type !== 'scheduled' || !b.scheduled_date || !b.scheduled_window) return minimum;
  const start = STARTS[WINDOWS.indexOf(b.scheduled_window)] ?? '08:00';
  const lead = new Date(fresnoInstant(b.scheduled_date, start).getTime() - LEAD_H * 3600_000);
  return lead > minimum ? lead : minimum;
}

export const whenText = (b: Pick<BookingRow, 'when_type' | 'scheduled_date' | 'scheduled_window'>) =>
  b.when_type === 'asap' ? 'ASAP' : `${shortDate(b.scheduled_date!)}, ${b.scheduled_window}`;

/** City from a formatted address: "123 Main St, Fresno, CA 93721, USA" → "Fresno". */
export function cityOf(address: string): string {
  const parts = address.split(',').map((s) => s.trim());
  const stateIdx = parts.findIndex((p) => /^CA\b/.test(p));
  return (stateIdx > 0 ? parts[stateIdx - 1] : parts[1] ?? parts[0]).replace(/\s*\(.*\)$/, '');
}

const usd = (cents: number) => `$${(cents / 100).toFixed(2)}`;
export const payoutCents = (priceCents: number) => Math.round(priceCents * SHARE);
const firstName = (name: string) => name.split(/\s+/)[0];

function newToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function eligibleDrivers(env: Env, helper: boolean): Promise<Driver[]> {
  const sql = `SELECT id, name, phone, has_helper FROM drivers WHERE active = 1${helper ? ' AND has_helper = 1' : ''}`;
  return (await env.DB.prepare(sql).all<Driver>()).results;
}

/** Offer a booking to every eligible driver and text the customer. Run in the background after the booking is saved. */
export async function dispatchBooking(env: Env, b: BookingRow, drivers: Driver[], salt: string): Promise<void> {
  const base = env.PUBLIC_SITE_URL ?? 'https://boxhauls.com';
  const job = `${b.item_label ?? b.item}, ${cityOf(b.pickup_address)} to ${cityOf(b.dropoff_address)}, ${b.miles.toFixed(1)} mi, ${whenText(b)}`;
  const now = new Date().toISOString();

  await Promise.all(
    drivers.map(async (d) => {
      const token = newToken();
      await env.DB.prepare('INSERT INTO offers (booking_id, driver_id, token_hash, sent_at) VALUES (?, ?, ?, ?)')
        .bind(b.id, d.id, await hash(token, salt), now)
        .run();
      const ok = await sendSms(
        env,
        d.phone,
        `BoxHauls job ${b.id}: ${job}. You earn ${usd(payoutCents(b.price_cents))}.${b.helper ? ' Helper job: bring your helper.' : ''} First to accept gets it: ${base}/drive/accept/?t=${token}`,
      );
      await env.DB.prepare('UPDATE offers SET sms_status = ? WHERE booking_id = ? AND driver_id = ?').bind(ok ? 'sent' : 'failed', b.id, d.id).run();
    }),
  );

  const ok = await sendSms(
    env,
    toE164(b.phone),
    `BoxHauls: request ${b.id} received (${b.item_label ?? b.item}, ${whenText(b)}, ${usd(b.price_cents)}). We're texting BoxHauls drivers now and will text you when one accepts. Reply STOP to opt out.`,
  );
  await env.DB.prepare('UPDATE bookings SET customer_sms_status = ? WHERE id = ?').bind(ok ? 'sent' : 'failed', b.id).run();
}

/** Texts after a driver wins the job: full details to the driver, driver contact to the customer. */
export async function notifyAssigned(env: Env, b: BookingRow, d: Driver): Promise<void> {
  await sendSms(
    env,
    d.phone,
    `BoxHauls ${b.id} is yours. ${whenText(b)}. Pickup: ${b.pickup_address}. Drop-off: ${b.dropoff_address}. Item: ${b.item_label ?? b.item}${b.helper ? ' (helper requested)' : ''}. Customer: ${b.name}, ${b.phone}.${b.notes ? ` Notes: ${b.notes}` : ''} Customer price ${usd(b.price_cents)}, you earn ${usd(payoutCents(b.price_cents))}.`,
  );
  await sendSms(
    env,
    toE164(b.phone),
    `BoxHauls: driver ${firstName(d.name)} accepted ${b.id} (${whenText(b)}). They'll contact you from ${d.phone.replace(/^\+1(\d{3})(\d{3})(\d{4})$/, '($1) $2-$3')}. Price ${usd(b.price_cents)}.`,
  );
}

/** Text when nobody accepted in time. */
export async function notifyUnfilled(env: Env, b: Pick<BookingRow, 'id' | 'phone'>): Promise<void> {
  await sendSms(env, toE164(b.phone), `BoxHauls: sorry, no driver accepted ${b.id} in time. Call ${OFFICE_PHONE} or book again for another time.`);
}
