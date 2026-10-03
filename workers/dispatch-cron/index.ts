/**
 * boxhauls-dispatch-cron — runs every 5 minutes. Any booking still dispatching past its deadline is marked
 * 'unfilled' and the customer is texted, so nobody waits on a request no driver took.
 * Shares the D1 database and dispatch code with the Pages Functions (functions/_lib).
 */
import type { Env } from '../../functions/_lib/env';
import { notifyUnfilled } from '../../functions/_lib/dispatch';

export async function expireUnfilled(env: Env, now = new Date()): Promise<number> {
  const due = await env.DB.prepare(`SELECT id, phone FROM bookings WHERE status = 'dispatching' AND dispatch_expires_at <= ? LIMIT 100`)
    .bind(now.toISOString())
    .all<{ id: string; phone: string }>();
  let n = 0;
  for (const b of due.results) {
    // Conditional update: if a driver accepted in the meantime, this changes nothing and no text goes out.
    const res = await env.DB.prepare(`UPDATE bookings SET status = 'unfilled' WHERE id = ? AND status = 'dispatching'`).bind(b.id).run();
    if (res.meta.changes === 1) {
      await notifyUnfilled(env, b);
      n++;
    }
  }
  return n;
}

export default {
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(
      expireUnfilled(env).then((n) => {
        if (n) console.log(`marked ${n} booking(s) unfilled`);
      }),
    );
  },
} satisfies ExportedHandler<Env>;
