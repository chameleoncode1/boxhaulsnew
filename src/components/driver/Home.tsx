/**
 * BoxHauls Driver home, modeled on the Uber driver app: full-screen map, today's earnings pill, a big round GO
 * button, a bottom sheet ("You're offline" / "Finding jobs"), job offers that slide up with a countdown, and a
 * step-by-step trip sheet (navigate → arrived → loaded → complete).
 * Polls /api/driver/state every 5 s online (keeps the driver online) and every 20 s offline (scheduled jobs).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { navUrl, post, usd, type Driver, type LiveState, type Offer, type Trip } from './api';

const OFFER_SECONDS = 30;

function beep() {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    [0, 0.25, 0.5].forEach((t) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.25, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.2);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + t);
      o.stop(ctx.currentTime + t + 0.2);
    });
    navigator.vibrate?.([300, 150, 300]);
  } catch {
    /* audio not allowed yet */
  }
}

/** Stylized dark street map (no third-party map service or key needed). */
function MapBackdrop({ online, located }: { online: boolean; located: boolean }) {
  return (
    <div className="absolute inset-0 overflow-hidden bg-[#1b1b1b]" aria-hidden="true">
      <svg className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid slice" viewBox="0 0 400 800">
        <defs>
          <pattern id="blocks" width="80" height="80" patternUnits="userSpaceOnUse" patternTransform="rotate(-8)">
            <rect width="80" height="80" fill="#1b1b1b" />
            <rect x="6" y="6" width="68" height="68" rx="3" fill="#232323" />
          </pattern>
        </defs>
        <rect width="400" height="800" fill="url(#blocks)" />
        <path d="M-20 520 C 120 470, 220 560, 420 480" stroke="#3a3a3a" strokeWidth="18" fill="none" />
        <path d="M150 -20 C 170 200, 120 420, 210 820" stroke="#3a3a3a" strokeWidth="14" fill="none" />
        <path d="M-20 250 L 420 300" stroke="#333" strokeWidth="10" fill="none" />
        <path d="M300 -20 L 260 820" stroke="#333" strokeWidth="8" fill="none" />
        <text x="40" y="200" fill="#5a5a5a" fontSize="14" fontFamily="Inter, sans-serif" letterSpacing="3">FRESNO</text>
        <text x="270" y="140" fill="#5a5a5a" fontSize="12" fontFamily="Inter, sans-serif" letterSpacing="3">CLOVIS</text>
      </svg>
      <div className="absolute top-[42%] left-1/2 -translate-x-1/2 -translate-y-1/2">
        {online && <span className="absolute inset-0 -m-6 animate-ping rounded-full bg-brand opacity-40" />}
        <span className={`relative block h-5 w-5 rounded-full border-4 border-inverse ${located ? 'bg-brand' : 'bg-night-muted'} shadow-[0_0_0_6px_rgba(200,8,26,0.25)]`} />
      </div>
    </div>
  );
}

function Countdown({ seconds, total }: { seconds: number; total: number }) {
  const r = 22;
  const c = 2 * Math.PI * r;
  return (
    <svg width="56" height="56" viewBox="0 0 56 56" aria-label={`${seconds} seconds left`}>
      <circle cx="28" cy="28" r={r} stroke="var(--color-border)" strokeWidth="5" fill="none" />
      <circle cx="28" cy="28" r={r} stroke="var(--color-brand)" strokeWidth="5" fill="none" strokeDasharray={c} strokeDashoffset={c * (1 - seconds / total)} transform="rotate(-90 28 28)" strokeLinecap="round" />
      <text x="28" y="33" textAnchor="middle" fontSize="15" fontWeight="700" fill="var(--color-ink)">{seconds}</text>
    </svg>
  );
}

function OfferCard({ offer, onAccept, onDecline, busy }: { offer: Offer; onAccept: () => void; onDecline: () => void; busy: boolean }) {
  const [left, setLeft] = useState(OFFER_SECONDS);
  useEffect(() => {
    if (!offer.asap) return;
    setLeft(OFFER_SECONDS);
    const t = setInterval(() => setLeft((s) => (s <= 1 ? 0 : s - 1)), 1000);
    return () => clearInterval(t);
  }, [offer.id]);
  useEffect(() => {
    if (offer.asap && left === 0) onDecline();
  }, [left]);

  return (
    <div className="animate-[slideup_0.25s_ease-out] rounded-t-2xl bg-bg px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-ink shadow-[0_-12px_40px_rgba(0,0,0,0.5)]" role="alertdialog" aria-label="New job">
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="display inline-block rounded-sm bg-brand px-2 py-0.5 text-xs text-inverse">{offer.asap ? 'ASAP' : 'Scheduled'} · {offer.jobType}</span>
          <p className="display mt-2 text-4xl leading-none">{usd(offer.payoutCents)}</p>
          <p className="text-sm text-muted">Your earnings, plus tips</p>
        </div>
        {offer.asap ? <Countdown seconds={left} total={OFFER_SECONDS} /> : <span className="text-right text-sm font-semibold">{offer.when}</span>}
      </div>
      <div className="mt-4 space-y-3">
        <div className="flex gap-3">
          <div className="flex flex-col items-center pt-1">
            <span className="h-3 w-3 rounded-full bg-ink" />
            <span className="my-1 w-0.5 flex-1 bg-border-strong" />
            <span className="h-3 w-3 bg-brand" />
          </div>
          <div className="flex-1 space-y-3">
            <p><span className="block text-xs text-muted">Pickup</span><span className="font-semibold">{offer.pickupCity}</span></p>
            <p><span className="block text-xs text-muted">Drop-off</span><span className="font-semibold">{offer.dropoffCity}</span></p>
          </div>
          <p className="self-center text-right text-sm font-semibold">{offer.miles.toFixed(1)} mi<br /><span className="font-normal text-muted">trip</span></p>
        </div>
        <p className="rounded-md bg-surface px-3 py-2 text-sm"><strong>{offer.item}</strong>{offer.heavy && ' · heavy item'}{offer.dump && ` · ${offer.dump}`}</p>
      </div>
      <div className="mt-4 grid grid-cols-[4rem_1fr] gap-3">
        <button onClick={onDecline} disabled={busy} aria-label="Decline" className="flex items-center justify-center rounded-md border-2 border-border text-2xl">×</button>
        <button onClick={onAccept} disabled={busy} className="display rounded-md bg-brand py-4 text-xl text-inverse disabled:bg-border-strong">{busy ? 'Accepting…' : 'Accept'}</button>
      </div>
    </div>
  );
}

function TripSheet({ trip, driver, onChanged }: { trip: Trip; driver: Driver; onChanged: (doneCents?: number) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [dumpOpen, setDumpOpen] = useState(false);
  const [dumpFee, setDumpFee] = useState('');
  const phone = trip.customer.phone.replace(/\D/g, '').slice(-10);

  async function step(s: 'arrived' | 'picked_up' | 'complete' | 'cancel', extra: Record<string, unknown> = {}) {
    setBusy(true);
    setError('');
    try {
      const r = await post<{ completed?: { driverCents: number } }>('/api/driver/trip', { id: trip.id, step: s, ...extra });
      onChanged(r.completed?.driverCents);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const toDrop = trip.stage === 'to_dropoff';
  const address = toDrop ? trip.dropoff : trip.pickup;
  const action =
    trip.stage === 'to_pickup'
      ? { label: 'Arrived at pickup', run: () => step('arrived') }
      : trip.stage === 'at_pickup'
        ? { label: 'Loaded: start drop-off', run: () => step('picked_up') }
        : { label: 'Complete trip', run: () => (trip.dumpRun ? setDumpOpen(true) : step('complete')) };

  return (
    <div className="rounded-t-2xl bg-bg px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] text-ink shadow-[0_-12px_40px_rgba(0,0,0,0.5)]">
      <span className="mx-auto block h-1.5 w-10 rounded-full bg-border" />
      <p className="mt-3 text-sm font-semibold text-brand">{trip.stage === 'to_pickup' ? 'Heading to pickup' : trip.stage === 'at_pickup' ? 'At pickup' : 'Heading to drop-off'} · {trip.id}</p>
      <h2 className="mt-1 text-2xl leading-tight">{toDrop ? 'Drop off' : 'Pick up'} for {trip.customer.firstName}</h2>
      <p className="mt-1 text-sm">{address}</p>
      <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs font-semibold">
        <a href={navUrl(driver.navApp, address)} target="_blank" rel="noopener" className="flex flex-col items-center gap-1 rounded-md bg-surface py-3 text-ink no-underline">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true"><path d="M3 11l18-8-8 18-2-8-8-2z" /></svg>Navigate
        </a>
        <a href={`tel:${phone}`} className="flex flex-col items-center gap-1 rounded-md bg-surface py-3 text-ink no-underline">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2" /></svg>Call
        </a>
        <a href={`sms:${phone}`} className="flex flex-col items-center gap-1 rounded-md bg-surface py-3 text-ink no-underline">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true"><path d="M21 12a8 8 0 01-11.6 7.1L4 20l1-4.4A8 8 0 1121 12z" /></svg>Text
        </a>
      </div>
      <div className="mt-4 rounded-md border border-border p-3 text-sm">
        <p><strong>{trip.item}</strong>{trip.dump && ` · ${trip.dump}`} · {trip.miles.toFixed(1)} mi · you earn <strong>{usd(trip.payoutCents)}</strong>{trip.tipCents > 0 && <> + {usd(trip.tipCents)} tip</>}</p>
        {trip.notes && <p className="mt-1 text-muted">Notes: {trip.notes}</p>}
        {!toDrop && <p className="mt-1 text-muted">Drop-off: {trip.dropoff}</p>}
      </div>
      {dumpOpen ? (
        <div className="mt-4 rounded-md border-2 border-ink p-4">
          <label className="block text-sm font-semibold">
            Dump fee from the receipt
            <span className="mt-1 flex items-center rounded-md border-2 border-border bg-surface"><span className="pl-3 text-muted">$</span><input autoFocus inputMode="decimal" value={dumpFee} onChange={(e) => setDumpFee(e.target.value)} className="w-full bg-transparent px-2 py-3 outline-none" /></span>
          </label>
          <p className="mt-1 text-xs text-muted">Up to {usd(trip.dumpCapCents)}. You get 100% of the dump fee back.</p>
          <button onClick={() => step('complete', { dumpFeeCents: Math.round(Number(dumpFee || 0) * 100) })} disabled={busy} className="display mt-3 w-full rounded-md bg-brand py-4 text-lg text-inverse">{busy ? 'Completing…' : 'Complete trip'}</button>
        </div>
      ) : (
        <button onClick={action.run} disabled={busy} className="display mt-4 w-full rounded-md bg-brand py-4 text-lg text-inverse disabled:bg-border-strong">{busy ? 'One moment…' : action.label}</button>
      )}
      <button onClick={() => window.confirm('Cancel this trip? The customer is told right away and their card hold is released.') && step('cancel')} className="mt-2 w-full py-2 text-sm font-semibold text-muted underline">Cancel trip</button>
      {error && <p className="mt-2 text-sm font-semibold text-brand" role="alert">{error}</p>}
    </div>
  );
}

export default function Home({ driver, onOpenAccount, onSetupPayouts }: { driver: Driver; onOpenAccount: () => void; onSetupPayouts: () => void }) {
  const [live, setLive] = useState<LiveState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [done, setDone] = useState<number | null>(null);
  const pos = useRef<{ lat: number; lng: number } | null>(null);
  const [located, setLocated] = useState(false);
  const seen = useRef(new Set<string>());

  const refresh = useCallback(async () => {
    try {
      const s = await post<LiveState>('/api/driver/state', pos.current ?? {});
      setLive(s);
      const fresh = s.offers.filter((o) => !seen.current.has(o.id));
      if (fresh.length && s.online) beep();
      fresh.forEach((o) => seen.current.add(o.id));
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, []);
  useEffect(() => {
    const every = live?.online ? 5000 : 20000;
    const t = setInterval(() => document.visibilityState === 'visible' && refresh(), every);
    return () => clearInterval(t);
  }, [live?.online]);

  // While online: share location with the poll and keep the screen awake.
  useEffect(() => {
    if (!live?.online) return;
    let watch: number | undefined;
    let lock: { release: () => Promise<void> } | null = null;
    if ('geolocation' in navigator) {
      watch = navigator.geolocation.watchPosition(
        (p) => {
          pos.current = { lat: p.coords.latitude, lng: p.coords.longitude };
          setLocated(true);
        },
        () => setLocated(false),
        { enableHighAccuracy: true, maximumAge: 15000 },
      );
    }
    (navigator as unknown as { wakeLock?: { request: (t: string) => Promise<{ release: () => Promise<void> }> } }).wakeLock?.request('screen').then((l) => (lock = l)).catch(() => undefined);
    return () => {
      if (watch !== undefined) navigator.geolocation.clearWatch(watch);
      lock?.release().catch(() => undefined);
    };
  }, [live?.online]);

  async function toggle(online: boolean) {
    setBusy(true);
    setError('');
    try {
      await post('/api/driver/online', { online });
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function respond(offer: Offer, action: 'accept' | 'decline') {
    setBusy(true);
    setError('');
    try {
      await post('/api/driver/offer', { id: offer.id, action });
      if (action === 'decline') setDismissed((d) => [...d, offer.id]);
      await refresh();
    } catch (e) {
      setError((e as Error).message);
      setDismissed((d) => [...d, offer.id]);
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  const trip = live?.trips[0];
  const offer = !trip ? live?.offers.find((o) => !dismissed.includes(o.id)) : undefined;
  const online = Boolean(live?.online);

  return (
    <div className="relative h-full">
      <MapBackdrop online={online} located={located} />

      {/* Top bar */}
      <div className="absolute inset-x-0 top-0 flex items-center justify-between px-4 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button onClick={onOpenAccount} aria-label="Account" className="display flex h-12 w-12 items-center justify-center rounded-full bg-bg text-lg text-ink shadow-lg">{driver.firstName.slice(0, 1)}</button>
        <div className="rounded-full bg-night px-5 py-2.5 text-center shadow-lg ring-1 ring-night-border">
          <span className="display text-xl">{usd(live?.today.cents ?? 0)}</span>
          <span className="block text-[0.65rem] text-night-muted">TODAY</span>
        </div>
        <span className="h-12 w-12" />
      </div>

      {/* Bottom area */}
      <div className="absolute inset-x-0 bottom-0">
        {done !== null && (
          <div className="mx-4 mb-3 rounded-xl bg-bg p-5 text-center text-ink shadow-xl">
            <p className="text-sm font-semibold text-muted">Trip complete</p>
            <p className="display mt-1 text-4xl">{usd(done)}</p>
            <p className="text-sm text-muted">added to your earnings. Tips show up as the customer adds them.</p>
            <button onClick={() => setDone(null)} className="display mt-4 w-full rounded-md bg-ink py-3 text-inverse">Done</button>
          </div>
        )}

        {trip ? (
          <TripSheet trip={trip} driver={driver} onChanged={(cents) => { if (cents !== undefined) setDone(cents); refresh(); }} />
        ) : offer && online ? (
          <OfferCard offer={offer} busy={busy} onAccept={() => respond(offer, 'accept')} onDecline={() => respond(offer, 'decline')} />
        ) : (
          <>
            {!driver.canDrive ? null : !online ? (
              <div className="mb-4 flex justify-center">
                <button onClick={() => toggle(true)} disabled={busy} className="display flex h-24 w-24 items-center justify-center rounded-full bg-brand text-3xl text-inverse shadow-[0_0_0_8px_rgba(200,8,26,0.25),0_12px_30px_rgba(0,0,0,0.5)] active:scale-95">
                  {busy ? '…' : 'GO'}
                </button>
              </div>
            ) : null}
            <div className="rounded-t-2xl bg-bg px-5 pt-3 pb-4 text-ink shadow-[0_-12px_40px_rgba(0,0,0,0.5)]">
              <span className="mx-auto block h-1.5 w-10 rounded-full bg-border" />
              <div className="mt-3 flex items-center justify-between gap-3">
                {online && (
                  <button onClick={() => toggle(false)} disabled={busy} aria-label="Go offline" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true"><path d="M12 3v9M6.3 6.3a8 8 0 1011.4 0" /></svg>
                  </button>
                )}
                <div className="flex-1 text-center">
                  <p className="text-xl font-bold">{!driver.canDrive ? (driver.status === 'approved' ? 'Set up payouts to drive' : 'Your account isn’t active') : online ? 'Finding jobs' : "You're offline"}</p>
                  {online && <span className="mx-auto mt-2 block h-1 w-40 overflow-hidden rounded-full bg-surface-strong"><span className="block h-full w-1/3 animate-[scan_1.4s_ease-in-out_infinite] rounded-full bg-brand" /></span>}
                  {!online && driver.canDrive && <p className="text-sm text-muted">Tap GO to start getting jobs.</p>}
                </div>
                {online && <span className="w-11" />}
              </div>
              {!driver.canDrive && driver.status === 'approved' && <button onClick={onSetupPayouts} className="display mt-4 w-full rounded-md bg-brand py-3 text-inverse">Set up payouts</button>}
              {driver.status === 'suspended' && <p className="mt-2 text-center text-sm text-muted">Contact BoxHauls support about your account.</p>}
              {!online && live && live.offers.length > 0 && driver.canDrive && (
                <div className="mt-4">
                  <p className="text-sm font-semibold text-muted">Scheduled jobs you can take</p>
                  <ul className="mt-2 space-y-2">
                    {live.offers.map((o) => (
                      <li key={o.id} className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
                        <span className="min-w-0 text-sm"><strong>{usd(o.payoutCents)}</strong> · {o.item}<span className="block truncate text-muted">{o.when} · {o.pickupCity} → {o.dropoffCity}</span></span>
                        <button onClick={() => respond(o, 'accept')} disabled={busy} className="display shrink-0 rounded-md bg-brand px-4 py-2 text-sm text-inverse">Accept</button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {live && live.trips.length > 1 && <p className="mt-3 text-center text-sm text-muted">{live.trips.length - 1} more scheduled trip{live.trips.length > 2 ? 's' : ''} after this one.</p>}
              {error && <p className="mt-2 text-center text-sm font-semibold text-brand" role="alert">{error}</p>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
