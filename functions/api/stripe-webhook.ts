/**
 * POST /api/stripe-webhook — Stripe events (signature-verified with STRIPE_WEBHOOK_SECRET).
 *   payment_intent.amount_capturable_updated → card authorized: start dispatch (same as /api/confirm, idempotent)
 *   account.updated (Connect)                → mark a driver's payouts ready or not
 * Register in Stripe: Developers → Webhooks → endpoint https://<site>/api/stripe-webhook, and enable
 * "Listen to events on Connected accounts" for account.updated. See deploy/cloudflare/README.md.
 */
import type { Env } from '../_lib/env';
import { json } from '../_lib/http';
import { verifyWebhook } from '../_lib/stripe';
import { activateBooking } from '../_lib/payments';

interface StripeEvent {
  type: string;
  account?: string;
  data: { object: { id: string; metadata?: Record<string, string>; capabilities?: { transfers?: string }; payouts_enabled?: boolean } };
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const payload = await request.text();
  if (!(await verifyWebhook(env, payload, request.headers.get('Stripe-Signature')))) return json({ error: 'bad_signature' }, 400);
  const event = JSON.parse(payload) as StripeEvent;
  try {
    if (event.type === 'payment_intent.amount_capturable_updated') {
      const bookingId = event.data.object.metadata?.booking_id;
      if (bookingId && env.QUOTE_SECRET) await activateBooking(env, bookingId, env.QUOTE_SECRET);
    } else if (event.type === 'account.updated') {
      const acct = event.data.object;
      const ready = acct.capabilities?.transfers === 'active' && acct.payouts_enabled === true ? 1 : 0;
      await env.DB.prepare('UPDATE drivers SET payouts_ready = ? WHERE stripe_account_id = ?').bind(ready, acct.id).run();
    }
  } catch (e) {
    console.error('webhook handling error', event.type, e);
    return json({ error: 'handler_failed' }, 500); // Stripe retries
  }
  return json({ received: true });
};
