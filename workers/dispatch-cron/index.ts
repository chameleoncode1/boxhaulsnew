/**
 * boxhauls-dispatch-cron — runs every 5 minutes:
 *  1. Bookings still dispatching past their deadline → 'unfilled', card hold released, customer texted.
 *  2. Bookings that never got a card authorization within an hour → 'abandoned', PaymentIntent canceled.
 *  3. Driver payouts that failed after the customer was charged are retried.
 * Shares the D1 database and code with the Pages Functions (functions/_lib).
 */
import type { Env } from '../../functions/_lib/env';
import { notifyUnfilled } from '../../functions/_lib/dispatch';
import { releaseHold } from '../../functions/_lib/stripe';
import { retryFailedTransfers } from '../../functions/_lib/payments';

export async function expireUnfilled(env: Env, now = new Date()): Promise<number> {
  const due = await env.DB.prepare(`SELECT id, phone, payment_intent_id FROM bookings WHERE status = 'dispatching' AND dispatch_expires_at <= ? LIMIT 100`)
    .bind(now.toISOString())
    .all<{ id: string; phone: string; payment_intent_id: string | null }>();
  let n = 0;
  for (const b of due.results) {
    // Conditional update: if a driver accepted (or the customer canceled) meanwhile, nothing changes.
    const res = await env.DB.prepare(`UPDATE bookings SET status = 'unfilled' WHERE id = ? AND status = 'dispatching'`).bind(b.id).run();
    if (res.meta.changes !== 1) continue;
    if (b.payment_intent_id && env.STRIPE_SECRET_KEY) await releaseHold(env, b.payment_intent_id, 'abandoned').catch((e) => console.error('release failed', b.id, e));
    await notifyUnfilled(env, b);
    n++;
  }
  return n;
}

export async function abandonUnpaid(env: Env, now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - 3600_000).toISOString();
  const due = await env.DB.prepare(`SELECT id, payment_intent_id FROM bookings WHERE status = 'pending_payment' AND created_at <= ? LIMIT 100`)
    .bind(cutoff)
    .all<{ id: string; payment_intent_id: string | null }>();
  let n = 0;
  for (const b of due.results) {
    const res = await env.DB.prepare(`UPDATE bookings SET status = 'abandoned' WHERE id = ? AND status = 'pending_payment'`).bind(b.id).run();
    if (res.meta.changes !== 1) continue;
    if (b.payment_intent_id && env.STRIPE_SECRET_KEY) await releaseHold(env, b.payment_intent_id, 'abandoned').catch((e) => console.error('release failed', b.id, e));
    n++;
  }
  return n;
}

export default {
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(
      Promise.all([expireUnfilled(env), abandonUnpaid(env), env.STRIPE_SECRET_KEY ? retryFailedTransfers(env) : 0]).then(([u, a, t]) => {
        if (u || a || t) console.log(`unfilled: ${u}, abandoned: ${a}, payouts retried: ${t}`);
      }),
    );
  },
} satisfies ExportedHandler<Env>;
