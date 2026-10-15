/**
 * The booking money rules (docs/placeholders.json):
 * - Request: card authorized for the trip price (+ the estimated dump fee for the material and load on dump runs).
 *   Nothing is charged.
 * - Cancel within CANCEL_FREE_MINUTES of the authorization, before any driver accepts: hold released, nothing charged.
 * - Cancel after that, or any time after a driver accepts: CANCEL_FEE of the trip price is charged; if a driver
 *   had accepted, they get DRIVER_SHARE of that fee.
 * - Driver marks complete: trip price (+ the dump fee they enter, up to the dump part of the hold) is charged. The driver gets
 *   DRIVER_SHARE of the trip price plus 100% of the dump fee; the rest stays with BoxHauls, LLC.
 * - No driver accepts in time, the driver cancels (any reason, including weather), or the driver doesn't show:
 *   hold released immediately, nothing charged.
 */
import type { Env } from './env';
import { HttpError } from './http';
import { capture, chargeId, releaseHold, transferToDriver, stripe, type PaymentIntent } from './stripe';
import { dispatchBooking, dispatchDeadline, eligibleDrivers, type BookingRow } from './dispatch';
import { sendSms, toE164 } from './sms';
import { hash } from './quote';
import { fresnoInstant } from './time';
import { itemBySlug } from '../../src/lib/items';
import placeholders from '../../docs/placeholders.json';

const ph = placeholders as Record<string, unknown>;
const pct = (v: unknown) => Number(String(v).replace('%', '')) / 100;
export const DRIVER_SHARE = pct(ph.DRIVER_SHARE);
export const CANCEL_FEE = pct(ph.CANCEL_FEE);
export const CANCEL_FREE_MS = Number(ph.CANCEL_FREE_MINUTES) * 60_000;
export const NO_SHOW_ASAP_MS = Number(ph.NO_SHOW_ASAP_MINUTES) * 60_000;
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
  assigned_at: string | null;
  dump_material: string | null;
  dump_load: string | null;
  dump_hold_cents: number | null;
  cancel_reason: string | null;
}

export const isDumpRun = (b: { item: string }) => b.item === 'dump-run';

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
  const claim = await env.DB.prepare(`UPDATE bookings SET status = 'canceled', canceled_at = ?, cancel_reason = 'customer' WHERE id = ? AND status = ?`).bind(new Date().toISOString(), b.id, prevStatus).run();
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
  const cap = b.dump_hold_cents ?? 0;
  if (isDumpRun(b) && dumpFeeCents > cap) throw new HttpError(422, 'dump_fee_too_high', `The dump fee can't be more than ${usd(cap)} (the amount held for this load). Call support.`);
  const dump = isDumpRun(b) ? Math.max(0, Math.round(dumpFeeCents)) : 0;

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

/** When the customer may report a no-show: ASAP → NO_SHOW_ASAP_MINUTES after acceptance; scheduled → end of the window. */
export function noShowAvailableAt(b: FullBooking): Date | null {
  if (b.status !== 'assigned') return null;
  if (b.when_type === 'scheduled' && b.scheduled_date && b.scheduled_window) {
    const windows = ph.BOOKING_WINDOWS as string[];
    const starts = ph.BOOKING_WINDOW_STARTS as string[];
    const i = windows.indexOf(b.scheduled_window);
    const end = starts[i + 1] ?? `${String(Number((starts[i] ?? '16:00').slice(0, 2)) + 2).padStart(2, '0')}:00`;
    return fresnoInstant(b.scheduled_date, end);
  }
  return b.assigned_at ? new Date(Date.parse(b.assigned_at) + NO_SHOW_ASAP_MS) : null;
}

/**
 * The driver cancels (any reason, including weather), or the customer reports a no-show:
 * the hold is released immediately and the customer pays nothing.
 */
export async function releaseForDriver(env: Env, b: FullBooking, reason: 'driver' | 'no_show'): Promise<void> {
  if (b.status !== 'assigned') throw new HttpError(409, 'changed', 'This trip is no longer active.');
  if (reason === 'no_show') {
    const at = noShowAvailableAt(b);
    if (!at || Date.now() < at.getTime()) throw new HttpError(409, 'too_early', 'You can report a no-show once the pickup time has passed.');
  }
  const claim = await env.DB.prepare(`UPDATE bookings SET status = 'canceled', canceled_at = ?, cancel_reason = ?, cancel_fee_cents = 0, captured_cents = 0 WHERE id = ? AND status = 'assigned'`)
    .bind(new Date().toISOString(), reason, b.id)
    .run();
  if (claim.meta.changes !== 1) throw new HttpError(409, 'changed', 'This trip just changed. Refresh and try again.');
  if (b.payment_intent_id) await releaseHold(env, b.payment_intent_id, reason === 'driver' ? 'requested_by_customer' : 'abandoned');

  const driver = b.driver_id ? await env.DB.prepare('SELECT phone FROM drivers WHERE id = ?').bind(b.driver_id).first<{ phone: string }>() : null;
  const customerMsg =
    reason === 'driver'
      ? `BoxHauls: your driver canceled ${b.id}. Your card hold has been released; you won't be charged. Book again any time, or call ${ph.PHONE}.`
      : `BoxHauls: we're sorry your driver didn't show for ${b.id}. Your card hold has been released; you won't be charged. Call ${ph.PHONE} if you need help.`;
  await sendSms(env, toE164(b.phone), customerMsg);
  if (driver && reason === 'no_show') await sendSms(env, driver.phone, `BoxHauls: the customer reported a no-show for ${b.id}. The trip is canceled and the customer's hold was released.`);
}
