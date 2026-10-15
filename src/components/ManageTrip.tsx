/**
 * Customer's trip page (React island) at /book/trip/. Reached by ?t=<token> (confirmation screen, texts, Stripe's
 * 3-D Secure return with &confirm=<id>) or ?id=<booking> when signed in.
 * Live: refreshes every 10 seconds while the trip is active and shows the driver's progress. Tip any time once a
 * driver accepts; the moment the trip shows as completed, the tip screen opens (15% preselected every time).
 */
import { useEffect, useRef, useState } from 'react';
import TipScreen, { type TipInfo } from './TipScreen';

interface Trip {
  id: string;
  status: string;
  stage: string;
  item: string;
  when: string;
  pickup: string;
  dropoff: string;
  priceCents: number;
  capturedCents: number | null;
  cancelFeeCents: number | null;
  decideBy: string | null;
  freeCancelUntil: string | null;
  driver: { firstName: string; phone: string; vehicle: string | null; plate: string | null } | null;
  cancel: { allowed: boolean; feeCents: number; reason: string };
  cancelReason: string | null;
  noShowAt: string | null;
  tip: TipInfo;
}

const usd = (c: number) => `$${(c / 100).toFixed(2)}`;
const time = (iso: string) => new Date(iso).toLocaleString('en-US', { timeZone: 'America/Los_Angeles', weekday: 'short', hour: 'numeric', minute: '2-digit' });
const ACTIVE = ['pending_payment', 'dispatching', 'assigned'];

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({ message: 'Something went wrong.' }));
  if (!res.ok) throw Object.assign(new Error(data.message), data);
  return data as T;
}

const HEADLINE: Record<string, string> = {
  pending_payment: 'Waiting for card authorization',
  dispatching: 'Finding your driver',
  to_pickup: 'Your driver is on the way',
  at_pickup: 'Your driver has arrived',
  to_dropoff: 'Heading to drop-off',
  completed: 'Trip complete',
  canceled: 'Trip canceled',
  unfilled: 'No driver was available',
  abandoned: 'Not completed',
};
const STEPS = [
  { key: 'dispatching', label: 'Finding driver' },
  { key: 'to_pickup', label: 'On the way' },
  { key: 'at_pickup', label: 'Arrived' },
  { key: 'to_dropoff', label: 'To drop-off' },
  { key: 'completed', label: 'Done' },
];

export default function ManageTrip() {
  const [access, setAccess] = useState<{ token: string } | { id: string } | null>(null);
  const [trip, setTrip] = useState<Trip | null>(null);
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [tipOpen, setTipOpen] = useState<null | 'during' | 'after'>(null);
  const [tipKey, setTipKey] = useState(0);
  const shownAfter = useRef(false);
  const lastStatus = useRef<string | null>(null);

  function openTip(kind: 'during' | 'after') {
    setTipKey((k) => k + 1); // remount → 15% selected again
    setTipOpen(kind);
  }

  async function load(a: { token: string } | { id: string }) {
    try {
      const t = await post<Trip>('/api/trip', a);
      // The moment the trip shows as completed (live, on load, or from the completion text), open the tip screen.
      if (t.status === 'completed' && t.tip.allowed && !shownAfter.current && (lastStatus.current !== 'completed' || new URLSearchParams(location.search).has('tip'))) {
        shownAfter.current = true;
        openTip('after');
      }
      lastStatus.current = t.status;
      setTrip(t);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get('t');
    const id = params.get('id');
    const a = t ? { token: t } : id ? { id } : null;
    if (!a) return setError('This trip link is missing its code.');
    setAccess(a);
    const confirmId = params.get('confirm');
    // Back from a Stripe redirect (3-D Secure): finish activation, then show the trip.
    (confirmId && t ? post('/api/confirm', { id: confirmId, customerToken: t }).catch(() => undefined) : Promise.resolve()).then(() => load(a));
  }, []);

  // Live updates while the trip is active.
  useEffect(() => {
    if (!access || !trip || !ACTIVE.includes(trip.status)) return;
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') load(access);
    }, 10_000);
    return () => clearInterval(timer);
  }, [access, trip?.status]);

  async function act(url: string, after?: () => void) {
    if (!access) return;
    setBusy(true);
    setError('');
    try {
      await post(url, access);
      after?.();
      await load(access);
    } catch (e) {
      setError((e as Error).message);
      await load(access);
    } finally {
      setBusy(false);
    }
  }

  if (!trip || !access) return error ? <p className="text-brand">{error}</p> : <p className="text-muted">Loading your trip…</p>;

  const driverName = trip.driver?.firstName ?? 'your driver';

  if (tipOpen === 'after') {
    return (
      <div className="rounded-md border-t-4 border-brand bg-bg p-6 shadow-[0_8px_24px_var(--color-border)]">
        <TipScreen key={tipKey} tip={trip.tip} access={access} driverName={driverName} completed onDone={() => load(access)} onClose={() => setTipOpen(null)} />
      </div>
    );
  }

  const stage = trip.status === 'assigned' ? trip.stage : trip.status;
  const stepIndex = STEPS.findIndex((s) => s.key === stage);
  const row = (k: string, v: string) => (
    <div className="flex justify-between gap-4 border-b border-border py-2"><dt className="text-muted">{k}</dt><dd className="text-right font-semibold">{v}</dd></div>
  );
  const phone = trip.driver?.phone.replace(/^\+1/, '') ?? '';

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-md bg-night text-inverse">
        <div className="h-1.5 bg-brand" />
        <div className="p-5">
          <p className="text-sm text-night-muted">Trip {trip.id} · {trip.when}</p>
          <h2 className="mt-1 text-2xl">{HEADLINE[stage] ?? trip.status}</h2>
          {stepIndex >= 0 && (
            <ol className="mt-4 grid grid-cols-5 gap-1" aria-label="Trip progress">
              {STEPS.map((s, i) => (
                <li key={s.key} className="text-center">
                  <span className={`block h-1.5 rounded-full ${i <= stepIndex ? 'bg-brand' : 'bg-night-border'}`} />
                  <span className={`mt-1.5 block text-[0.65rem] leading-tight ${i <= stepIndex ? 'text-inverse' : 'text-night-muted'}`}>{s.label}</span>
                </li>
              ))}
            </ol>
          )}
          {trip.status === 'dispatching' && trip.decideBy && <p className="mt-4 text-sm text-night-muted">We'll text you when a driver accepts, or by {time(trip.decideBy)} if none is available.</p>}
        </div>
      </div>

      {trip.driver && ['assigned', 'completed'].includes(trip.status) && (
        <div className="flex items-center gap-4 rounded-md border border-border p-4">
          <span className="display flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand text-xl text-inverse">{trip.driver.firstName.slice(0, 1)}</span>
          <div className="min-w-0 flex-1">
            <p className="font-bold">{trip.driver.firstName}</p>
            {trip.driver.vehicle && <p className="truncate text-sm text-muted">{trip.driver.vehicle}{trip.driver.plate ? ` · ${trip.driver.plate}` : ''}</p>}
          </div>
          {trip.status === 'assigned' && (
            <div className="flex gap-2">
              <a href={`tel:${phone}`} aria-label={`Call ${trip.driver.firstName}`} className="flex h-11 w-11 items-center justify-center rounded-full bg-surface text-ink no-underline hover:bg-surface-strong">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2" /></svg>
              </a>
              <a href={`sms:${phone}`} aria-label={`Text ${trip.driver.firstName}`} className="flex h-11 w-11 items-center justify-center rounded-full bg-surface text-ink no-underline hover:bg-surface-strong">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M21 12a8 8 0 01-11.6 7.1L4 20l1-4.4A8 8 0 1121 12z" /></svg>
              </a>
            </div>
          )}
        </div>
      )}

      {trip.tip.allowed && (
        <div className="flex items-center justify-between gap-3 rounded-md bg-surface p-4">
          <div>
            <p className="font-bold">{trip.tip.paidCents > 0 ? `You tipped ${usd(trip.tip.paidCents)}` : `Tip ${driverName}`}</p>
            <p className="text-sm text-muted">100% goes to your driver.</p>
          </div>
          <button onClick={() => openTip(trip.status === 'completed' ? 'after' : 'during')} className="display shrink-0 rounded-sm bg-brand px-4 py-2.5 text-inverse hover:bg-brand-hover">
            {trip.tip.paidCents > 0 ? 'Add tip' : 'Add a tip'}
          </button>
        </div>
      )}

      {tipOpen === 'during' && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-[color-mix(in_srgb,var(--color-night)_65%,transparent)] sm:items-center" role="dialog" aria-modal="true" aria-label="Tip your driver">
          <div className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-xl bg-bg p-6 sm:rounded-xl">
            <TipScreen key={tipKey} tip={trip.tip} access={access} driverName={driverName} completed={false} onDone={() => load(access)} onClose={() => setTipOpen(null)} />
          </div>
        </div>
      )}

      <dl className="rounded-md border border-border px-4 py-2 text-sm">
        {row('Item', trip.item)}
        {row('Pickup', trip.pickup)}
        {row('Drop-off', trip.dropoff)}
        {row('Price', usd(trip.priceCents))}
        {trip.status === 'completed' && trip.capturedCents !== null && row('Charged', usd(trip.capturedCents))}
        {trip.tip.paidCents > 0 && row('Tip', usd(trip.tip.paidCents))}
        {trip.status === 'canceled' && row('Canceled by', trip.cancelReason === 'driver' ? 'Your driver' : trip.cancelReason === 'no_show' ? 'You (driver no-show)' : 'You')}
        {trip.status === 'canceled' && row('Charged', trip.cancelFeeCents ? usd(trip.cancelFeeCents) : 'Nothing, your hold was released')}
      </dl>
      {ACTIVE.includes(trip.status) && <p className="text-sm text-muted">Your card is authorized, not charged. It's charged when the driver marks the trip complete.</p>}

      {trip.cancel.allowed && !confirming && (
        <button onClick={() => setConfirming(true)} className="w-full rounded-sm border-2 border-ink px-6 py-3 font-semibold">Cancel trip</button>
      )}
      {trip.cancel.allowed && confirming && (
        <div className="rounded-sm border-2 border-brand p-4" role="alertdialog" aria-label="Confirm cancellation">
          <p className="font-semibold">{trip.cancel.feeCents === 0 ? 'Cancel for a full refund?' : `Cancel and pay the ${usd(trip.cancel.feeCents)} cancellation fee?`}</p>
          <p className="mt-1 text-sm text-muted">
            {trip.cancel.reason}
            {trip.cancel.feeCents === 0 && trip.freeCancelUntil && <> Free until {time(trip.freeCancelUntil)}, unless a driver accepts first.</>}
            {trip.tip.paidCents > 0 && <> Your tip will be refunded.</>}
          </p>
          <div className="mt-3 flex gap-3">
            <button onClick={() => act('/api/cancel', () => setConfirming(false))} disabled={busy} className="display rounded-sm bg-brand px-5 py-2 text-inverse disabled:bg-border-strong">{busy ? 'Canceling…' : 'Yes, cancel'}</button>
            <button onClick={() => setConfirming(false)} className="rounded-sm border-2 border-border-strong px-5 py-2">Keep trip</button>
          </div>
        </div>
      )}
      {trip.status === 'assigned' && trip.noShowAt && Date.now() >= Date.parse(trip.noShowAt) && (
        <button
          onClick={() => window.confirm("Report that your driver didn't show up? The trip is canceled and your card hold is released.") && act('/api/no-show')}
          disabled={busy}
          className="w-full rounded-sm border-2 border-brand px-6 py-3 font-semibold text-brand"
        >
          My driver didn't show up
        </button>
      )}
      {trip.status === 'assigned' && trip.noShowAt && Date.now() < Date.parse(trip.noShowAt) && (
        <p className="text-xs text-muted">If your driver doesn't show, you can report it here after {time(trip.noShowAt)} and your hold is released.</p>
      )}
      {error && <p className="text-sm text-brand" role="alert">{error}</p>}
    </div>
  );
}
