/**
 * Driver payout setup (React island) at /drive/payouts/?t=<token>. Sends the driver to Stripe's hosted
 * onboarding (Stripe collects identity and bank details) and shows when payouts are ready. Drivers only
 * receive job offers once Stripe can pay them.
 */
import { useEffect, useState } from 'react';

interface Status {
  ready: boolean;
  name: string;
  url?: string;
}

export default function DriverPayouts() {
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('t') ?? '';
    if (!t) {
      setError('This payouts link is missing its code. Use the link BoxHauls sent you.');
      return;
    }
    fetch('/api/payouts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: t }) })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.message ?? 'Something went wrong.');
        setStatus(data);
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  if (error) return <p className="text-brand">{error}</p>;
  if (!status) return <p className="text-muted">Checking your payouts…</p>;

  return (
    <div className="rounded-sm border-t-4 border-brand bg-bg p-5 shadow-[0_8px_24px_var(--color-border)]">
      {status.ready ? (
        <>
          <h2 className="text-2xl">You're set, {status.name}</h2>
          <p className="mt-3">Stripe can pay you, so you'll now get BoxHauls job texts. Your share of each trip is sent to your Stripe account when you mark the trip complete.</p>
        </>
      ) : (
        <>
          <h2 className="text-2xl">Set up payouts, {status.name}</h2>
          <p className="mt-3">BoxHauls pays drivers through Stripe. Stripe will ask for your identity details and the bank account to pay you. BoxHauls never sees your bank details.</p>
          <p className="mt-2 text-sm text-muted">You'll start getting job texts once setup is complete.</p>
          {status.url && (
            <a href={status.url} className="display mt-5 inline-block w-full rounded-sm bg-brand px-6 py-3 text-center text-lg text-inverse no-underline hover:bg-brand-hover hover:text-inverse">Set up payouts with Stripe</a>
          )}
        </>
      )}
    </div>
  );
}
