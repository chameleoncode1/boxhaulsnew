/**
 * POST /api/driver/payouts — set up or check payouts (Stripe Connect Express). Stripe collects the bank account,
 * tax ID (SSN) and identity check; BoxHauls stores only whether payouts are ready. Returns a Stripe link while
 * setup is incomplete, then { ready: true }.
 */
import type { Env } from '../../_lib/env';
import { assertSameOrigin, handle, json } from '../../_lib/http';
import { requireUser } from '../../_lib/auth';
import { getDriver, publicDriver } from '../../_lib/drivers';
import { stripe } from '../../_lib/stripe';

interface Account {
  id: string;
  payouts_enabled: boolean;
  capabilities?: { transfers?: string };
  external_accounts?: { data?: { last4?: string }[] };
  individual?: { ssn_last_4_provided?: boolean };
}

export const onRequestPost: PagesFunction<Env> = ({ request, env }) =>
  handle(async () => {
    assertSameOrigin(request);
    const id = await requireUser(env, request, 'driver');
    const d = await getDriver(env, id);
    let accountId = d.stripe_account_id;
    if (!accountId) {
      const acct = await stripe<Account>(
        env,
        'POST',
        '/accounts',
        {
          type: 'express',
          country: 'US',
          email: d.email ?? undefined,
          business_type: 'individual',
          capabilities: { transfers: { requested: true } },
          individual: { first_name: d.first_name ?? undefined, last_name: d.last_name ?? undefined, email: d.email ?? undefined, phone: d.phone },
          business_profile: { product_description: 'Local pickup-truck hauling for BoxHauls customers' },
          metadata: { driver_id: d.id },
        },
        `acct-${d.id}`,
      );
      accountId = acct.id;
      await env.DB.prepare('UPDATE drivers SET stripe_account_id = ? WHERE id = ?').bind(accountId, d.id).run();
    }
    const acct = await stripe<Account>(env, 'GET', `/accounts/${accountId}`);
    const ready = acct.capabilities?.transfers === 'active' && acct.payouts_enabled;
    const last4 = acct.external_accounts?.data?.[0]?.last4 ?? null;
    await env.DB.prepare('UPDATE drivers SET payouts_ready = ?, bank_last4 = ?, tax_info_status = ? WHERE id = ?').bind(ready ? 1 : 0, last4, ready ? 'verified' : 'pending', d.id).run();
    const fresh = await publicDriver(env, await getDriver(env, id));
    if (ready) {
      const login = await stripe<{ url: string }>(env, 'POST', `/accounts/${accountId}/login_links`).catch(() => null);
      return json({ ready: true, dashboardUrl: login?.url ?? null, driver: fresh });
    }
    const origin = new URL(request.headers.get('Origin') ?? request.url).origin;
    const appBase = /(^|\.)driver\.boxhauls\.com$/.test(new URL(origin).hostname) ? `${origin}/` : `${origin}/driver-app/`;
    const link = await stripe<{ url: string }>(env, 'POST', '/account_links', { account: accountId, refresh_url: `${appBase}?payouts=retry`, return_url: `${appBase}?payouts=done`, type: 'account_onboarding' });
    return json({ ready: false, url: link.url, driver: fresh });
  });
