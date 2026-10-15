/**
 * Card step of the booking widget. Stripe's Payment Element collects the card (details go straight to Stripe,
 * never to BoxHauls servers). Confirming authorizes the card for the hold amount — nothing is charged until the
 * driver marks the trip complete. Then /api/confirm checks the authorization server-side and starts dispatch.
 */
import { useEffect, useState } from 'react';
import { loadStripe, type Stripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';

export interface PaymentSession {
  id: string;
  clientSecret: string;
  customerToken: string;
  totalCents: number;
  holdCents: number;
}
export interface Activated {
  id: string;
  status: string;
  decideBy: string | null;
}

const usd = (c: number) => `$${(c / 100).toFixed(2)}`;
let stripePromise: Promise<Stripe | null> | null = null;

async function getStripe(): Promise<Stripe | null> {
  if (!stripePromise) {
    stripePromise = fetch('/api/config')
      .then((r) => r.json() as Promise<{ stripePublishableKey: string | null }>)
      .then((c) => (c.stripePublishableKey ? loadStripe(c.stripePublishableKey) : null));
  }
  return stripePromise;
}

/** Stripe appearance from the site's design tokens (src/styles/tokens.css), read at runtime. */
function appearance() {
  const v = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return {
    theme: 'stripe' as const,
    variables: { colorPrimary: v('--color-brand'), colorText: v('--color-ink'), colorDanger: v('--color-brand'), borderRadius: '2px', fontFamily: 'Inter, system-ui, sans-serif' },
  };
}

function ConfirmButton({ session, onDone, label }: { session: PaymentSession; onDone: (a: Activated) => void; label: string }) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function confirm() {
    if (!stripe || !elements || busy) return;
    setBusy(true);
    setError('');
    const returnUrl = `${window.location.origin}/book/trip/?t=${encodeURIComponent(session.customerToken)}&confirm=${encodeURIComponent(session.id)}`;
    const result = await stripe.confirmPayment({ elements, redirect: 'if_required', confirmParams: { return_url: returnUrl } });
    if (result.error) {
      setError(result.error.message ?? 'Your card could not be authorized.');
      setBusy(false);
      return;
    }
    const res = await fetch('/api/confirm', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: session.id, customerToken: session.customerToken }) });
    const data = await res.json();
    if (!res.ok) {
      setError(data.message ?? 'Something went wrong. Your card was not charged.');
      setBusy(false);
      return;
    }
    onDone(data as Activated);
  }

  return (
    <>
      <button
        type="button"
        onClick={confirm}
        disabled={!stripe || busy}
        className="display mt-5 w-full rounded-sm bg-brand px-6 py-3 text-lg text-inverse hover:bg-brand-hover disabled:cursor-not-allowed disabled:bg-border-strong"
      >
        {busy ? 'Authorizing…' : label}
      </button>
      {error && <p className="mt-3 text-sm text-brand" role="alert">{error}</p>}
    </>
  );
}

export default function PaymentStep({ session, dumpRun, onDone }: { session: PaymentSession; dumpRun: boolean; onDone: (a: Activated) => void }) {
  const [stripe, setStripe] = useState<Stripe | null | undefined>(undefined);
  useEffect(() => {
    getStripe().then(setStripe);
  }, []);

  if (stripe === undefined) return <p className="mt-4 text-sm text-muted">Loading secure card form…</p>;
  if (stripe === null) return <p className="mt-4 text-sm text-brand">Online payment is unavailable right now.</p>;

  return (
    <div className="mt-5 border-t border-border pt-4">
      <h3 className="text-lg font-semibold">Card</h3>
      <p className="mt-1 text-sm text-muted">
        Your card is authorized now and charged {usd(session.totalCents)} only when the driver marks the trip complete.
        {dumpRun && session.holdCents > session.totalCents && <> The hold is {usd(session.holdCents)}, including up to {usd(session.holdCents - session.totalCents)} for the dump fee; you're charged only the actual fee from the receipt.</>}
      </p>
      <div className="mt-3">
        <Elements stripe={stripe} options={{ clientSecret: session.clientSecret, appearance: appearance() }}>
          <PaymentElement />
          <ConfirmButton session={session} onDone={onDone} label={`Request trip · ${usd(session.totalCents)}`} />
        </Elements>
      </div>
    </div>
  );
}
