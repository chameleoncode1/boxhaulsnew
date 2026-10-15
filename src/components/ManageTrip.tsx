/**
 * Customer's manage-trip page (React island) at /book/trip/?t=<token>. Linked from the booking confirmation,
 * the customer's text, and Stripe's return after 3-D Secure (&confirm=<id>, which finishes activation).
 * Shows status and lets the customer cancel, with the exact fee shown before they confirm.
 */
import { useEffect, useState } from 'react';

interface Trip {
  id: string;
  status: string;
  item: string;
  when: string;
  pickup: string;
  dropoff: string;
  priceCents: number;
  capturedCents: number | null;
  cancelFeeCents: number | null;
  decideBy: string | null;
  freeCancelUntil: string | null;
  driver: { firstName: string; phone: string } | null;
  cancel: { allowed: boolean; feeCents: number; reason: string };
}

const usd = (c: number) => `$${(c / 100).toFixed(2)}`;
const time = (iso: string) => new Date(iso).toLocaleString('en-US', { timeZone: 'America/Los_Angeles', weekday: 'short', hour: 'numeric', minute: '2-digit' });

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({ message: 'Something went wrong.' }));
  if (!res.ok) throw Object.assign(new Error(data.message), data);
  return data as T;
}

const STATUS: Record<string, string> = {
  pending_payment: 'Waiting for card authorization',
  dispatching: 'Finding a driver',
  assigned: 'Driver on the way',
  completed: 'Completed',
  canceled: 'Canceled',
  unfilled: 'No driver was available',
  abandoned: 'Not completed',
};

export default function ManageTrip() {
  const [token, setToken] = useState('');
  const [trip, setTrip] = useState<Trip | null>(null);
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  async function load(t: string) {
    try {
      setTrip(await post<Trip>('/api/trip', { token: t }));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get('t') ?? '';
    setToken(t);
    if (!t) {
      setError('This trip link is missing its code.');
      return;
    }
    const confirmId = params.get('confirm');
    // Back from a Stripe redirect (3-D Secure): finish activation, then show the trip.
    (confirmId ? post('/api/confirm', { id: confirmId, customerToken: t }).catch(() => undefined) : Promise.resolve()).then(() => load(t));
  }, []);

  async function cancel() {
    setBusy(true);
    setError('');
    try {
      await post('/api/cancel', { token });
      setConfirming(false);
      await load(token);
    } catch (e) {
      setError((e as Error).message);
      await load(token);
    } finally {
      setBusy(false);
    }
  }

  if (!trip) return error ? <p className="text-brand">{error}</p> : <p className="text-muted">Loading your trip…</p>;

  const row = (k: string, v: string) => (
    <div className="flex justify-between gap-4 border-b border-border py-2"><dt className="text-muted">{k}</dt><dd className="text-right font-semibold">{v}</dd></div>
  );

  return (
    <div className="rounded-sm border-t-4 border-brand bg-bg p-5 shadow-[0_8px_24px_var(--color-border)]">
      <p className="text-sm text-muted">Trip {trip.id}</p>
      <h2 className="mt-1 text-2xl">{STATUS[trip.status] ?? trip.status}</h2>
      <dl className="mt-3 text-sm">
        {row('Item', trip.item)}
        {row('When', trip.when)}
        {row('Pickup', trip.pickup)}
        {row('Drop-off', trip.dropoff)}
        {row('Price', usd(trip.priceCents))}
        {trip.driver && row('Driver', `${trip.driver.firstName}, ${trip.driver.phone.replace(/^\+1(\d{3})(\d{3})(\d{4})$/, '($1) $2-$3')}`)}
        {trip.status === 'completed' && trip.capturedCents !== null && row('Charged', usd(trip.capturedCents))}
        {trip.status === 'canceled' && row('Cancellation fee', trip.cancelFeeCents ? usd(trip.cancelFeeCents) : 'None (full refund)')}
      </dl>

      {trip.status === 'dispatching' && trip.decideBy && <p className="mt-3 text-sm text-muted">We'll text you when a driver accepts, or by {time(trip.decideBy)} if none is available.</p>}
      {['dispatching', 'assigned', 'pending_payment'].includes(trip.status) && <p className="mt-2 text-sm text-muted">Your card is authorized, not charged. It's charged when the driver marks the trip complete.</p>}

      {trip.cancel.allowed && !confirming && (
        <button onClick={() => setConfirming(true)} className="mt-5 w-full rounded-sm border-2 border-ink px-6 py-3 font-semibold">Cancel trip</button>
      )}
      {trip.cancel.allowed && confirming && (
        <div className="mt-5 rounded-sm border-2 border-brand p-4" role="alertdialog" aria-label="Confirm cancellation">
          <p className="font-semibold">
            {trip.cancel.feeCents === 0 ? 'Cancel for a full refund?' : `Cancel and pay the ${usd(trip.cancel.feeCents)} cancellation fee?`}
          </p>
          <p className="mt-1 text-sm text-muted">
            {trip.cancel.reason}
            {trip.cancel.feeCents === 0 && trip.freeCancelUntil && <> Free until {time(trip.freeCancelUntil)}, unless a driver accepts first.</>}
          </p>
          <div className="mt-3 flex gap-3">
            <button onClick={cancel} disabled={busy} className="display rounded-sm bg-brand px-5 py-2 text-inverse disabled:bg-border-strong">{busy ? 'Canceling…' : 'Yes, cancel'}</button>
            <button onClick={() => setConfirming(false)} className="rounded-sm border-2 border-border-strong px-5 py-2">Keep trip</button>
          </div>
        </div>
      )}
      {error && <p className="mt-3 text-sm text-brand" role="alert">{error}</p>}
    </div>
  );
}
