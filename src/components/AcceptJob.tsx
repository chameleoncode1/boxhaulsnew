/**
 * Driver job page (React island) at /drive/accept/?t=<token>, opened from the dispatch text.
 * Shows the job summary and pay; "Accept job" assigns it if nobody else has. After accepting, the driver
 * sees the full addresses and customer contact (the same details arrive by text).
 */
import { useEffect, useState } from 'react';

interface Offer {
  id: string;
  state: 'open' | 'yours' | 'taken' | 'expired';
  item: string;
  from: string;
  to: string;
  miles: number;
  when: string;
  helper: boolean;
  payoutCents: number;
  priceCents: number;
  pickup?: string;
  dropoff?: string;
  customer?: string;
  phone?: string;
  notes?: string | null;
}

const usd = (c: number) => `$${(c / 100).toFixed(2)}`;

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({ message: 'Something went wrong.' }));
  if (!res.ok) throw Object.assign(new Error(data.message), data);
  return data as T;
}

export default function AcceptJob() {
  const [token, setToken] = useState('');
  const [offer, setOffer] = useState<Offer | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = (t: string) =>
    post<Offer>('/api/offer', { token: t })
      .then(setOffer)
      .catch((e: Error) => setError(e.message));

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('t') ?? '';
    setToken(t);
    if (t) load(t);
    else setError('This job link is missing its code. Open it from the text message.');
  }, []);

  async function accept() {
    setBusy(true);
    setError('');
    try {
      await post('/api/accept', { token });
      await load(token);
    } catch (e) {
      setError((e as Error).message);
      await load(token);
    } finally {
      setBusy(false);
    }
  }

  if (error && !offer) return <p className="text-brand">{error}</p>;
  if (!offer) return <p className="text-muted">Loading job…</p>;

  const row = (k: string, v: string) => (
    <div className="flex justify-between gap-4 border-b border-border py-2"><dt className="text-muted">{k}</dt><dd className="text-right font-semibold">{v}</dd></div>
  );

  return (
    <div className="rounded-sm border-t-4 border-brand bg-bg p-5 shadow-[0_8px_24px_var(--color-border)]">
      <p className="text-sm text-muted">Job {offer.id}</p>
      <h2 className="mt-1 text-2xl">{offer.item}</h2>
      <dl className="mt-3 text-sm">
        {row('Route', `${offer.from} → ${offer.to}`)}
        {row('Distance', `${offer.miles.toFixed(1)} mi`)}
        {row('When', offer.when)}
        {offer.helper && row('Helper', 'Required: bring your helper')}
        {row('You earn', usd(offer.payoutCents))}
        {row('Customer pays', usd(offer.priceCents))}
      </dl>

      {offer.state === 'open' && (
        <button onClick={accept} disabled={busy} className="display mt-5 w-full rounded-sm bg-brand px-6 py-3 text-lg text-inverse hover:bg-brand-hover disabled:bg-border-strong">
          {busy ? 'Accepting…' : 'Accept job'}
        </button>
      )}
      {offer.state === 'taken' && <p className="mt-4 font-semibold">Another driver already accepted this job.</p>}
      {offer.state === 'expired' && <p className="mt-4 font-semibold">This job is no longer available.</p>}
      {offer.state === 'yours' && (
        <div className="mt-5" role="status">
          <p className="font-semibold">It's yours. Details were also texted to you.</p>
          <dl className="mt-3 text-sm">
            {row('Pickup', offer.pickup ?? '')}
            {row('Drop-off', offer.dropoff ?? '')}
            {row('Customer', offer.customer ?? '')}
            {row('Phone', offer.phone ?? '')}
            {offer.notes ? row('Notes', offer.notes) : null}
          </dl>
          {offer.phone && (
            <a href={`tel:${offer.phone.replace(/\D/g, '')}`} className="display mt-4 inline-block rounded-sm bg-night px-5 py-3 text-inverse no-underline">Call customer</a>
          )}
        </div>
      )}
      {error && <p className="mt-3 text-sm text-brand" role="alert">{error}</p>}
    </div>
  );
}
