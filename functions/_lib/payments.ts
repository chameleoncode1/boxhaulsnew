/**
 * The booking money rules (docs/placeholders.json):
 * - Request: card authorized for the trip price (+ DUMP_FEE_HOLD_BUFFER on dump runs). Nothing is charged.
 * - Cancel within CANCEL_FREE_MINUTES of the authorization, before any driver accepts: hold released, nothing charged.
 * - Cancel after that, or any time after a driver accepts: CANCEL_FEE of the trip price is charged; if a driver
 *   had accepted, they get DRIVER_SHARE of that fee.
 * - Driver marks complete: trip price (+ the dump fee they enter, up to the buffer) is charged. The driver gets
 *   DRIVER_SHARE of the trip price plus 100% of the dump fee; the rest stays with BoxHauls, LLC.
 * - No driver accepts in time: hold released.
 */
import type { Env } from './env';
import { HttpError } from './http';
import { capture, chargeId, releaseHold, transferToDriver, stripe, type PaymentIntent } from './stripe';
import { dispatchBooking, dispatchDeadline, eligibleDrivers, type BookingRow } from './dispatch';
import { sendSms, toE164 } from './sms';
import { hash } from './quote';
import { itemBySlug } from '../../src/lib/items';
import placeholders from '../../docs/placeholders.json';

const ph = placeholders as Record<string, unknown>;
const pct = (v: unknown) => Number(String(v).replace('%', '')) / 100;
export const DRIVER_SHARE = pct(ph.DRIVER_SHARE);
export const CANCEL_FEE = pct(ph.CANCEL_FEE);
export const CANCEL_FREE_MS = Number(ph.CANCEL_FREE_MINUTES) * 60_000;
export const DUMP_BUFFER_CENTS = Math.round(Number(String(ph.DUMP_FEE_HOLD_BUFFER).replace(/[$,]/g, '')) * 100);
const usd = (c: number) => `$${(c / 100).toFixed(2)}`;

export interface FullBooking extends BookingRow {
  status: string;
  email: string;
  driver_id: string | null;
  payment_intent_id: string | null;
  authorized_cents: number | null;
  confirmed_at: string | null;
  dispatch_expires_at: string | null;
  customer_token_hash: string | null;
  captured_cents: number | null;
  dump_fee_cents: number | null;
  cancel_fee_cents: number | null;
}

export const isDumpRun = (b: { item: string }) => b.item === 'dump-run';
export const holdCents = (tripCents: number, item: string) => tripCents + (item === 'dump-run' ? DUMP_BUFFER_CENTS : 0);

export async function getBooking(env: Env, id: string): Promise<FullBooking | null> {
  return env.DB.prepare('SELECT * FROM bookings WHERE id = ?').bind(id).first<FullBooking>();
}

/**
 * Card authorized → start dispatch. Idempotent (called by the browser after confirmation and by the webhook).
 * If no eligible driver exists any more, the hold is released and the booking is marked unfilled.
 */
export async function activateBooking(env: Env, bookingId: string, salt: string, customerToken?: string): Promise<'dispatching' | 'already' | 'unfilled' | 'not_authorized'> {
  const b = await getBooking(env, bookingId);
  if (!b || !b.payment_intent_id) throw new HttpError(404, 'not_found', 'Booking not found.');
  if (b.status !== 'pending_payment') return 'already';
  const pi = await stripe<PaymentIntent>(env, 'GET', `/payment_intents/${b.payment_intent_id}`);
  if (pi.status !== 'requires_capture' || pi.metadata.booking_id !== b.id) return 'not_authorized';

  const now = new Date();
  const deadline = dispatchDeadline(b, now);
  const res = await env.DB.prepare(
    `UPDATE bookings SET status = 'dispatching', confirmed_at = ?, dispatch_expires_at = ? WHERE id = ? AND status = 'pending_payment'`,
  )
    .bind(now.toISOString(), deadline.toISOString(), b.id)
    .run();
  if (res.meta.changes !== 1) return 'already';

  const drivers = await eligibleDrivers(env, b.helper === 1);
  if (!drivers.length) {
    await releaseHold(env, b.payment_intent_id, 'abandoned');
    await env.DB.prepare(`UPDATE bookings SET status = 'unfilled' WHERE id = ?`).bind(b.id).run();
    await sendSms(env, toE164(b.phone), `BoxHauls: sorry, no driver is available for ${b.id} right now. Your card was not charged. Call ${ph.PHONE} to book.`);
    return 'unfilled';
  }
  await dispatchBooking(env, { ...b, item_label: itemBySlug(b.item)?.label ?? b.item }, drivers, salt, customerToken);
  return 'dispatching';
}

/** What cancelling right now would cost. */
export function cancelTerms(b: FullBooking, now = Date.now()): { allowed: boolean; feeCents: number; reason: string } {
  if (['completed', 'canceled', 'unfilled', 'abandoned'].includes(b.status)) return { allowed: false, feeCents: 0, reason: `This trip is already ${b.status}.` };
  if (b.status === 'pending_payment') return { allowed: true, feeCents: 0, reason: 'Your card has not been authorized yet.' };
  const fee = Math.round(b.price_cents * CANCEL_FEE);
  if (b.status === 'assigned') return { allowed: true, feeCents: fee, reason: 'A driver has accepted this trip.' };
  const within = b.confirmed_at && now - Date.parse(b.confirmed_at) <= CANCEL_FREE_MS;
  return within ? { allowed: true, feeCents: 0, reason: 'Within the free-cancellation window.' } : { allowed: true, feeCents: fee, reason: 'The free-cancellation window has passed.' };
}

/** Customer cancels. Returns the fee charged (0 for a full refund). */
export async function cancelBooking(env: Env, b: FullBooking): Promise<{ feeCents: number }> {
  const terms = cancelTerms(b);
  if (!terms.allowed) throw new HttpError(409, 'not_cancelable', terms.reason);
  const prevStatus = b.status;
  // Claim the booking first, so a driver can't accept (or complete) while we cancel.
  const claim = await env.DB.prepare(`UPDATE bookings SET status = 'canceled', canceled_at = ? WHERE id = ? AND status = ?`).bind(new Date().toISOString(), b.id, prevStatus).run();
  if (claim.meta.changes !== 1) throw new HttpError(409, 'changed', 'This trip just changed. Refresh and try again.');

  if (!b.payment_intent_id) return { feeCents: 0 };
  if (terms.feeCents === 0) {
    await releaseHold(env, b.payment_intent_id);
    await env.DB.prepare('UPDATE bookings SET cancel_fee_cents = 0, captured_cents = 0 WHERE id = ?').bind(b.id).run();
    return { feeCents: 0 };
  }

  const pi = await capture(env, b.payment_intent_id, terms.feeCents);
  let driverCents = 0;
  let transferId: string | null = null;
  if (prevStatus === 'assigned' && b.driver_id) {
    const driver = await env.DB.prepare('SELECT stripe_account_id, phone FROM drivers WHERE id = ?').bind(b.driver_id).first<{ stripe_account_id: string | null; phone: string }>();
    driverCents = Math.round(terms.feeCents * DRIVER_SHARE);
    const ch = chargeId(pi);
    if (driver?.stripe_account_id && ch) {
      transferId = (await transferToDriver(env, { bookingId: b.id, accountId: driver.stripe_account_id, amountCents: driverCents, chargeId: ch, kind: 'cancel_fee' }))?.id ?? null;
    }
    if (driver) await sendSms(env, driver.phone, `BoxHauls: the customer canceled ${b.id}. You'll receive ${usd(driverCents)} from the cancellation fee.`);
  }
  await env.DB.prepare('UPDATE bookings SET cancel_fee_cents = ?, captured_cents = ?, driver_transfer_cents = ?, transfer_id = ? WHERE id = ?')
    .bind(terms.feeCents, terms.feeCents, driverCents, transferId, b.id)
    .run();
  return { feeCents: terms.feeCents };
}

/** Driver marks the trip complete: charge the customer and pay the driver. */
export async function completeBooking(env: Env, b: FullBooking, driver: { id: string; stripe_account_id: string | null }, dumpFeeCents: number) {
  if (b.status !== 'assigned' || b.driver_id !== driver.id) throw new HttpError(409, 'not_yours', 'This trip is not assigned to you.');
  if (!b.payment_intent_id) throw new HttpError(409, 'no_payment', 'This trip has no payment on file.');
  if (!driver.stripe_account_id) throw new HttpError(409, 'no_payouts', 'Set up payouts before completing trips.');
  const dump = isDumpRun(b) ? Math.max(0, Math.min(Math.round(dumpFeeCents), DUMP_BUFFER_CENTS)) : 0;
  if (isDumpRun(b) && dumpFeeCents > DUMP_BUFFER_CENTS) throw new HttpError(422, 'dump_fee_too_high', `The dump fee can't be more than ${usd(DUMP_BUFFER_CENTS)}. Call support.`);

  const claim = await env.DB.prepare(`UPDATE bookings SET status = 'completed', completed_at = ?, dump_fee_cents = ? WHERE id = ? AND status = 'assigned' AND driver_id = ?`)
    .bind(new Date().toISOString(), dump, b.id, driver.id)
    .run();
  if (claim.meta.changes !== 1) throw new HttpError(409, 'changed', 'This trip just changed. Refresh and try again.');

  const total = b.price_cents + dump;
  const pi = await capture(env, b.payment_intent_id, total);
  const driverCents = Math.round(b.price_cents * DRIVER_SHARE) + dump;
  const ch = chargeId(pi);
  const transfer = ch ? await transferToDriver(env, { bookingId: b.id, accountId: driver.stripe_account_id, amountCents: driverCents, chargeId: ch, kind: 'trip' }) : null;
  await env.DB.prepare('UPDATE bookings SET captured_cents = ?, driver_transfer_cents = ?, transfer_id = ? WHERE id = ?').bind(total, driverCents, transfer?.id ?? null, b.id).run();

  await sendSms(env, toE164(b.phone), `BoxHauls: trip ${b.id} is complete. Your card was charged ${usd(total)}${dump ? ` (${usd(b.price_cents)} trip + ${usd(dump)} dump fee)` : ''}. Thanks for using BoxHauls.`);
  return { chargedCents: total, driverCents };
}

/** The booking behind a customer's manage-trip link. */
export async function bookingByCustomerToken(env: Env, token: string): Promise<FullBooking> {
  if (!env.QUOTE_SECRET || token.length < 20) throw new HttpError(404, 'not_found', 'This trip link is not valid.');
  const b = await env.DB.prepare('SELECT * FROM bookings WHERE customer_token_hash = ?').bind(await hash(token, env.QUOTE_SECRET)).first<FullBooking>();
  if (!b) throw new HttpError(404, 'not_found', 'This trip link is not valid.');
  return b;
}
