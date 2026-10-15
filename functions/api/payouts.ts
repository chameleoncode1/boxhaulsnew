/**
 * POST /api/payouts — a driver sets up or checks payouts. Body: { token } (from their payouts link).
 * Creates their Stripe Connect Express account on first use, refreshes whether Stripe can pay them, and
 * returns a Stripe-hosted onboarding link while setup is incomplete. Stripe collects bank and identity details.
 */
import type { Env } from '../_lib/env';
import { assertSameOrigin, handle, HttpError, json, readJson, str } from '../_lib/http';
import { sha256 } from '../_lib/quote';
import { stripe } from '../_lib/stripe';

interface Account {
  id: string;
  payouts_enabled: boolean;
  capabilities?: { transfers?: string };
}

export const onRequestPost: PagesFunction<Env> = ({ request, env }) =>
  handle(async () => {
    assertSameOrigin(request);
    if (!env.QUOTE_SECRET) throw new HttpError(503, 'not_configured', 'Unavailable.');
    const { token } = await readJson<{ token?: unknown }>(request);
    const t = str(token, 100);
    if (t.length < 20) throw new HttpError(404, 'not_found', 'This payouts link is not valid.');
    const d = await env.DB.prepare('SELECT id, name, phone, stripe_account_id FROM drivers WHERE onboarding_token_hash = ? AND active = 1')
      .bind(await sha256(t))
      .first<{ id: string; name: string; phone: string; stripe_account_id: string | null }>();
    if (!d) throw new HttpError(404, 'not_found', 'This payouts link is not valid.');

    let accountId = d.stripe_account_id;
    if (!accountId) {
      const acct = await stripe<Account>(
        env,
        'POST',
        '/accounts',
        { type: 'express', country: 'US', business_type: 'individual', capabilities: { transfers: { requested: true } }, metadata: { driver_id: d.id } },
        `acct-${d.id}`,
      );
      accountId = acct.id;
      await env.DB.prepare('UPDATE drivers SET stripe_account_id = ? WHERE id = ?').bind(accountId, d.id).run();
    }

    const acct = await stripe<Account>(env, 'GET', `/accounts/${accountId}`);
    const ready = acct.capabilities?.transfers === 'active' && acct.payouts_enabled;
    await env.DB.prepare('UPDATE drivers SET payouts_ready = ? WHERE id = ?').bind(ready ? 1 : 0, d.id).run();
    if (ready) return json({ ready: true, name: d.name.split(/\s+/)[0] });

    const base = env.PUBLIC_SITE_URL ?? 'https://boxhauls.com';
    const back = `${base}/drive/payouts/?t=${encodeURIComponent(t)}`;
    const link = await stripe<{ url: string }>(env, 'POST', '/account_links', { account: accountId, refresh_url: back, return_url: back, type: 'account_onboarding' });
    return json({ ready: false, name: d.name.split(/\s+/)[0], url: link.url });
  });
