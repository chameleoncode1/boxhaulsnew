/**
 * Tips: 100% to the driver.
 * - Suggestions are 15%, 18% and 20% of the trip total (what was charged once complete; the quoted price before).
 * - Charged right away to the card used for the booking (saved with Stripe for this purpose), as its own payment.
 *   If the bank asks for authentication, the customer confirms in the browser (requires_action).
 * - Paid out to the driver when the trip is complete (immediately if it already is). Refunded if the trip is canceled.
 */
import type { Env } from './env';
import { HttpError } from './http';
import { newId } from './auth';
import { chargeId, stripe, StripeError, transferToDriver, type PaymentIntent } from './stripe';
import type { FullBooking } from './payments';

export const TIP_PERCENTS = [15, 18, 20] as const;
export const DEFAULT_TIP_PERCENT = 15;
const MAX_TIP_CENTS = 50_000;

export const tipBaseCents = (b: Pick<FullBooking, 'captured_cents' | 'price_cents' | 'status'>) =>
  b.status === 'completed' && b.captured_cents ? b.captured_cents : b.price_cents;

export const tipSuggestions = (baseCents: number) => TIP_PERCENTS.map((p) => ({ percent: p, cents: Math.round((baseCents * p) / 100) }));

export const canTip = (b: Pick<FullBooking, 'status' | 'driver_id'>) => Boolean(b.driver_id) && (b.status === 'assigned' || b.status === 'completed');

interface BookingForTip extends FullBooking {
  stripe_customer_id: string | null;
  payment_method_id: string | null;
}

/** Charge a tip. Returns paid, or requires_action with a client secret for the browser to finish authentication. */
export async function chargeTip(env: Env, b: BookingForTip, amountCents: number, percent: number | null): Promise<{ status: 'paid' | 'requires_action'; tipId: string; clientSecret?: string }> {
  if (!canTip(b)) throw new HttpError(409, 'cannot_tip', 'You can tip once a driver has accepted your trip.');
  if (!Number.isInteger(amountCents) || amountCents < 100) throw new HttpError(422, 'bad_tip', 'Enter a tip of at least $1.00.');
  if (amountCents > MAX_TIP_CENTS) throw new HttpError(422, 'bad_tip', 'For a tip over $500, contact support.');
  if (!b.stripe_customer_id || !b.payment_method_id) throw new HttpError(409, 'no_card', 'The card for this trip isn’t available for tips. Contact support to tip your driver.');

  const tipId = newId('TIP', 8);
  const now = new Date().toISOString();
  try {
    const pi = await stripe<PaymentIntent>(
      env,
      'POST',
      '/payment_intents',
      {
        amount: amountCents,
        currency: 'usd',
        customer: b.stripe_customer_id,
        payment_method: b.payment_method_id,
        off_session: true,
        confirm: true,
        description: `BoxHauls ${b.id}: tip for your driver`,
        transfer_group: b.id,
        metadata: { booking_id: b.id, kind: 'tip', tip_id: tipId },
        expand: ['latest_charge'],
      },
      `tip-${tipId}`,
    );
    await env.DB.prepare('INSERT INTO tips (id, booking_id, amount_cents, percent, payment_intent_id, charge_id, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(tipId, b.id, amountCents, percent, pi.id, chargeId(pi) ?? null, pi.status === 'succeeded' ? 'paid' : 'failed', now)
      .run();
    if (pi.status !== 'succeeded') throw new HttpError(402, 'tip_failed', 'Your card was declined for the tip.');
    await tipPaid(env, b.id, tipId, amountCents);
    return { status: 'paid', tipId };
  } catch (e) {
    const pi = e instanceof StripeError ? e.stripeError.payment_intent : undefined;
    if (e instanceof StripeError && e.stripeError.code === 'authentication_required' && pi) {
      await env.DB.prepare('INSERT INTO tips (id, booking_id, amount_cents, percent, payment_intent_id, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .bind(tipId, b.id, amountCents, percent, pi.id, 'requires_action', now)
        .run();
      return { status: 'requires_action', tipId, clientSecret: pi.client_secret };
    }
    throw e;
  }
}

/** After the browser finishes authentication: confirm the payment succeeded and record the tip. */
export async function confirmTip(env: Env, bookingId: string, tipId: string): Promise<void> {
  const t = await env.DB.prepare('SELECT * FROM tips WHERE id = ? AND booking_id = ?').bind(tipId, bookingId).first<{ status: string; payment_intent_id: string; amount_cents: number }>();
  if (!t) throw new HttpError(404, 'not_found', 'Tip not found.');
  if (t.status === 'paid') return;
  const pi = await stripe<PaymentIntent>(env, 'GET', `/payment_intents/${t.payment_intent_id}`, { expand: ['latest_charge'] });
  if (pi.status !== 'succeeded' || pi.metadata.tip_id !== tipId) throw new HttpError(402, 'tip_failed', 'The tip wasn’t completed.');
  const claim = await env.DB.prepare(`UPDATE tips SET status = 'paid', charge_id = ? WHERE id = ? AND status != 'paid'`).bind(chargeId(pi) ?? null, tipId).run();
  if (claim.meta.changes === 1) await tipPaid(env, bookingId, tipId, t.amount_cents);
}

async function tipPaid(env: Env, bookingId: string, tipId: string, amountCents: number) {
  await env.DB.prepare('UPDATE bookings SET tip_cents = tip_cents + ? WHERE id = ?').bind(amountCents, bookingId).run();
  const b = await env.DB.prepare('SELECT status FROM bookings WHERE id = ?').bind(bookingId).first<{ status: string }>();
  if (b?.status === 'completed') await payTips(env, bookingId);
  else if (b?.status === 'canceled') await refundTips(env, bookingId);
  void tipId;
}

/** Send every paid, unsent tip on a completed booking to its driver. Failures are retried by the cron. */
export async function payTips(env: Env, bookingId: string): Promise<void> {
  const d = await env.DB.prepare(`SELECT d.stripe_account_id FROM bookings b JOIN drivers d ON d.id = b.driver_id WHERE b.id = ? AND b.status = 'completed'`).bind(bookingId).first<{ stripe_account_id: string | null }>();
  if (!d?.stripe_account_id) return;
  const due = await env.DB.prepare(`SELECT id, amount_cents, charge_id FROM tips WHERE booking_id = ? AND status = 'paid' AND transfer_status IN ('pending','failed') AND transfer_attempts < 20`)
    .bind(bookingId)
    .all<{ id: string; amount_cents: number; charge_id: string | null }>();
  for (const t of due.results) {
    try {
      if (!t.charge_id) throw new Error('tip has no charge');
      const tr = await transferToDriver(env, { bookingId, accountId: d.stripe_account_id, amountCents: t.amount_cents, chargeId: t.charge_id, kind: 'tip', key: `transfer-${t.id}` });
      await env.DB.prepare(`UPDATE tips SET transfer_status = 'sent', transfer_id = ?, transfer_attempts = transfer_attempts + 1 WHERE id = ?`).bind(tr?.id ?? null, t.id).run();
    } catch (e) {
      console.error('tip transfer failed', t.id, e);
      await env.DB.prepare(`UPDATE tips SET transfer_status = 'failed', transfer_attempts = transfer_attempts + 1 WHERE id = ?`).bind(t.id).run();
    }
  }
}

/** Refund every paid tip on a canceled booking (tips made during a trip that didn't happen). */
export async function refundTips(env: Env, bookingId: string): Promise<void> {
  const paid = await env.DB.prepare(`SELECT id, payment_intent_id FROM tips WHERE booking_id = ? AND status = 'paid' AND transfer_status != 'sent'`).bind(bookingId).all<{ id: string; payment_intent_id: string }>();
  for (const t of paid.results) {
    try {
      await stripe(env, 'POST', '/refunds', { payment_intent: t.payment_intent_id, metadata: { booking_id: bookingId, tip_id: t.id } }, `refund-${t.id}`);
      await env.DB.prepare(`UPDATE tips SET status = 'refunded' WHERE id = ?`).bind(t.id).run();
    } catch (e) {
      console.error('tip refund failed', t.id, e);
    }
  }
  await env.DB.prepare(`UPDATE bookings SET tip_cents = (SELECT COALESCE(SUM(amount_cents), 0) FROM tips WHERE booking_id = ? AND status = 'paid') WHERE id = ?`).bind(bookingId, bookingId).run();
}

/** Cron: retry failed tip transfers on completed trips. */
export async function retryTipTransfers(env: Env): Promise<void> {
  const due = await env.DB.prepare(`SELECT DISTINCT t.booking_id FROM tips t JOIN bookings b ON b.id = t.booking_id WHERE t.status = 'paid' AND t.transfer_status IN ('pending','failed') AND b.status = 'completed' AND t.transfer_attempts < 20 LIMIT 50`).all<{ booking_id: string }>();
  for (const r of due.results) await payTips(env, r.booking_id);
}
