/**
 * Tip your driver: 15% / 18% / 20% of the trip total (computed by the server) or a custom amount. 15% is selected
 * every time the screen opens. Tips go 100% to the driver. Used full-screen after completion and as a sheet during the trip.
 * If the bank asks for authentication, Stripe.js finishes it and /api/tip-confirm records the tip.
 */
import { useState } from 'react';

export interface TipInfo {
  allowed: boolean;
  paidCents: number;
  baseCents: number;
  suggestions: { percent: number; cents: number }[];
  defaultPercent: number;
}

const usd = (c: number) => `$${(c / 100).toFixed(2)}`;

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({ message: 'Something went wrong.' }));
  if (!res.ok) throw Object.assign(new Error(data.message), data);
  return data as T;
}

async function finishAuthentication(clientSecret: string): Promise<void> {
  const { loadStripe } = await import('@stripe/stripe-js');
  const cfg = await fetch('/api/config').then((r) => r.json() as Promise<{ stripePublishableKey: string | null }>);
  const stripe = cfg.stripePublishableKey ? await loadStripe(cfg.stripePublishableKey) : null;
  if (!stripe) throw new Error('Card authentication is unavailable right now.');
  const r = await stripe.handleNextAction({ clientSecret });
  if (r.error) throw new Error(r.error.message ?? 'Your bank didn’t approve the tip.');
}

interface Props {
  tip: TipInfo;
  access: { token: string } | { id: string };
  driverName: string;
  completed: boolean;
  onDone: (paidCents: number) => void;
  onClose: () => void;
}

export default function TipScreen({ tip, access, driverName, completed, onDone, onClose }: Props) {
  // 15% is selected by default every time this screen is presented (the component remounts each time).
  const [choice, setChoice] = useState<number | 'custom'>(tip.defaultPercent);
  const [custom, setCustom] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [thanks, setThanks] = useState<number | null>(null);

  const selected = choice === 'custom' ? Math.round(Number(custom.replace(/[^0-9.]/g, '')) * 100) || 0 : tip.suggestions.find((s) => s.percent === choice)?.cents ?? 0;

  async function pay() {
    if (selected < 100) return setError('Enter a tip of at least $1.00.');
    setBusy(true);
    setError('');
    try {
      const body = { ...access, amountCents: selected, percent: choice === 'custom' ? null : choice };
      let r = await post<{ status: string; tipId: string; clientSecret?: string; tipCents: number }>('/api/tip', body);
      if (r.status === 'requires_action' && r.clientSecret) {
        await finishAuthentication(r.clientSecret);
        r = await post('/api/tip-confirm', { ...access, tipId: r.tipId });
      }
      setThanks(selected);
      onDone(r.tipCents);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (thanks !== null) {
    return (
      <div className="text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand text-inverse">
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
        </div>
        <h2 className="mt-4 text-3xl">Thank you!</h2>
        <p className="mt-2 text-muted">{driverName} gets your {usd(thanks)} tip in full.</p>
        <button onClick={onClose} className="display mt-6 w-full rounded-sm bg-ink px-6 py-3 text-lg text-inverse">Done</button>
      </div>
    );
  }

  return (
    <div>
      <p className="eyebrow">{completed ? 'Trip complete' : 'Tip during your trip'}</p>
      <h2 className="mt-1 text-3xl">Tip {driverName}</h2>
      <p className="mt-1 text-sm text-muted">
        Trip total {usd(tip.baseCents)}. 100% of your tip goes to {driverName}.{tip.paidCents > 0 && <> You’ve tipped {usd(tip.paidCents)} so far.</>}
      </p>
      <div className="mt-5 grid grid-cols-2 gap-3" role="radiogroup" aria-label="Tip amount">
        {tip.suggestions.map((s) => (
          <button
            key={s.percent}
            type="button"
            role="radio"
            aria-checked={choice === s.percent}
            onClick={() => setChoice(s.percent)}
            className={`rounded-md border-2 px-3 py-4 text-center transition-colors ${choice === s.percent ? 'border-brand bg-brand text-inverse' : 'border-border hover:border-ink'}`}
          >
            <span className="display block text-2xl">{s.percent}%</span>
            <span className={`block text-sm ${choice === s.percent ? '' : 'text-muted'}`}>{usd(s.cents)}</span>
          </button>
        ))}
        <button
          type="button"
          role="radio"
          aria-checked={choice === 'custom'}
          onClick={() => setChoice('custom')}
          className={`rounded-md border-2 px-3 py-4 text-center transition-colors ${choice === 'custom' ? 'border-brand bg-brand text-inverse' : 'border-border hover:border-ink'}`}
        >
          <span className="display block text-2xl">Custom</span>
          <span className={`block text-sm ${choice === 'custom' ? '' : 'text-muted'}`}>Your amount</span>
        </button>
      </div>
      {choice === 'custom' && (
        <label className="mt-4 block">
          <span className="text-sm font-semibold">Tip amount</span>
          <span className="mt-1 flex items-center rounded-sm border-2 border-border-strong focus-within:border-ink">
            <span className="pl-3 text-lg text-muted">$</span>
            <input autoFocus inputMode="decimal" value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="0.00" className="w-full bg-transparent px-2 py-3 text-lg outline-none" />
          </span>
        </label>
      )}
      <button onClick={pay} disabled={busy || selected < 100} className="display mt-6 w-full rounded-sm bg-brand px-6 py-4 text-lg text-inverse hover:bg-brand-hover disabled:bg-border-strong">
        {busy ? 'Sending tip…' : selected >= 100 ? `Tip ${usd(selected)}` : 'Choose a tip'}
      </button>
      <button onClick={onClose} className="mt-3 w-full py-2 text-sm font-semibold text-muted underline">{completed ? 'No tip this time' : 'Not now'}</button>
      {error && <p className="mt-3 text-sm text-brand" role="alert">{error}</p>}
    </div>
  );
}
