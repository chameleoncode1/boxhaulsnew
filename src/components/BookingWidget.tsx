/**
 * Booking widget (React island). Mounted on / and /book/.
 *
 * Flow: choose both addresses from suggestions (/api/places) → real price from driving distance (/api/quote,
 * signed by the server) → ASAP or a date and time window → contact details → booking request (/api/book).
 * No payment is taken online. No price is shown until both addresses are chosen. No driver cards, ETAs,
 * ratings or payout split — ever (CLAUDE.md rule 3, map Section 4).
 */
import { useEffect, useId, useRef, useState } from 'react';
import { ITEMS, TIERS, itemBySlug, tierBySlug, type TierKey } from '../lib/items';
import { money, phone as phoneFact, phoneE164 } from '../lib/site';
import placeholders from '../../docs/placeholders.json';

declare global {
  interface Window {
    bhTrack?: (event: string, params?: Record<string, unknown>) => void;
  }
}

const track = (event: string, params: Record<string, unknown>) => window.bhTrack?.(event, params);
const WINDOWS = placeholders.BOOKING_WINDOWS as string[];
const DAYS_AHEAD = Number(placeholders.BOOKING_DAYS_AHEAD);
const usd = (cents: number) => `$${(cents / 100).toFixed(2)}`;
const newSession = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : String(Math.random()).slice(2));

interface Picked {
  placeId: string;
  text: string;
}
interface Quote {
  quote: string;
  pickup: string;
  dropoff: string;
  miles: number;
  lines: { label: string; cents: number }[];
  totalCents: number;
}
interface ApiError {
  error: string;
  message: string;
}

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = (await res.json().catch(() => ({ error: 'network', message: 'Something went wrong. Please try again.' }))) as T | ApiError;
  if (!res.ok) throw Object.assign(new Error((data as ApiError).message), data as ApiError);
  return data as T;
}

/** Upcoming dates in Fresno time, as { value: YYYY-MM-DD, label: "Mon, Oct 6" }. */
function upcomingDates(): { value: string; label: string }[] {
  const out = [];
  for (let i = 0; i <= DAYS_AHEAD; i++) {
    const d = new Date(Date.now() + i * 86400_000);
    const value = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' }).format(d);
    const label = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', weekday: 'short', month: 'short', day: 'numeric' }).format(d);
    out.push({ value, label: i === 0 ? `Today, ${label}` : label });
  }
  return out;
}

const field = 'mt-1 w-full rounded-sm border-2 border-border-strong bg-bg px-3 py-2 text-ink focus:border-brand';
const labelCls = 'block text-sm font-semibold text-ink';

function CallUs({ children }: { children?: string }) {
  const tel = phoneE164();
  return (
    <p className="text-sm">
      {children ?? 'Online booking is unavailable right now.'}{' '}
      {tel && (
        <>
          Call <a href={`tel:${tel}`}>{phoneFact.value}</a> to book.
        </>
      )}
    </p>
  );
}

/** Address input with suggestions (ARIA combobox). */
function AddressField({ label, placeholder, value, onPick, sessionToken }: { label: string; placeholder: string; value: Picked | null; onPick: (p: Picked | null) => void; sessionToken: string }) {
  const id = useId();
  const [text, setText] = useState(value?.text ?? '');
  const [options, setOptions] = useState<Picked[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [error, setError] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  function search(input: string) {
    clearTimeout(timer.current);
    if (input.trim().length < 3) {
      setOptions([]);
      return;
    }
    timer.current = setTimeout(async () => {
      try {
        const r = await post<{ suggestions: Picked[] }>('/api/places', { input, sessionToken });
        setOptions(r.suggestions);
        setOpen(true);
        setActive(-1);
        setError(r.suggestions.length ? '' : 'No matching addresses in the Fresno and Clovis area.');
      } catch (e) {
        const ex = e as Error & Partial<ApiError>;
        const tel = phoneFact.value;
        setError(ex.error === 'maps_unavailable' && tel ? `${ex.message} Call ${tel} to book.` : ex.message);
      }
    }, 250);
  }

  function pick(p: Picked) {
    setText(p.text);
    setOpen(false);
    setError('');
    onPick(p);
  }

  return (
    <div className="relative">
      <label htmlFor={`${id}-input`} className={labelCls}>{label}</label>
      <input
        id={`${id}-input`}
        className={field}
        role="combobox"
        aria-expanded={open && options.length > 0}
        aria-controls={`${id}-list`}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `${id}-opt-${active}` : undefined}
        autoComplete="off"
        placeholder={placeholder}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          if (value) onPick(null);
          search(e.target.value);
        }}
        onKeyDown={(e) => {
          if (!open || !options.length) return;
          if (e.key === 'ArrowDown') (e.preventDefault(), setActive((a) => Math.min(a + 1, options.length - 1)));
          else if (e.key === 'ArrowUp') (e.preventDefault(), setActive((a) => Math.max(a - 1, 0)));
          else if (e.key === 'Enter' && active >= 0) (e.preventDefault(), pick(options[active]));
          else if (e.key === 'Escape') setOpen(false);
        }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        required
      />
      {open && options.length > 0 && (
        <ul id={`${id}-list`} role="listbox" className="absolute z-20 mt-1 max-h-60 w-full overflow-auto border-2 border-border-strong bg-bg">
          {options.map((o, i) => (
            <li
              key={o.placeId}
              id={`${id}-opt-${i}`}
              role="option"
              aria-selected={i === active}
              className={`cursor-pointer px-3 py-2 text-sm ${i === active ? 'bg-surface-strong' : 'hover:bg-surface'}`}
              onMouseDown={(e) => (e.preventDefault(), pick(o))}
            >
              {o.text}
            </li>
          ))}
        </ul>
      )}
      {error && <p className="mt-1 text-sm text-brand">{error}</p>}
    </div>
  );
}

export default function BookingWidget({ source = 'home' }: { source?: string }) {
  const id = useId();
  const [session, setSession] = useState(newSession);
  const [pickup, setPickup] = useState<Picked | null>(null);
  const [dropoff, setDropoff] = useState<Picked | null>(null);
  const [itemSlug, setItemSlug] = useState('couch');
  const [tier, setTier] = useState<TierKey>('TIER_3');
  const [helper, setHelper] = useState(false);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteState, setQuoteState] = useState<'idle' | 'loading' | 'error' | 'unavailable'>('idle');
  const [quoteError, setQuoteError] = useState('');
  const [whenType, setWhenType] = useState<'asap' | 'scheduled'>('asap');
  const [dates] = useState(upcomingDates);
  const [date, setDate] = useState('');
  const [window_, setWindow] = useState(WINDOWS[0] ?? '');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [booked, setBooked] = useState<{ id: string; total: string; when: string; phone: string; decideBy: string } | null>(null);
  const priceTracked = useRef(false);

  useEffect(() => setDate(dates[0]?.value ?? ''), [dates]);

  // Preselect item and tier from /book/?item=<slug>&tier=<slug> (pricing-page CTAs).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const item = itemBySlug(params.get('item')) ?? (params.get('item') ? itemBySlug('other') : undefined);
    if (item) {
      setItemSlug(item.slug);
      setTier(item.tier);
    }
    const t = tierBySlug(params.get('tier'));
    if (t) setTier(t.key);
  }, []);

  const item = itemBySlug(itemSlug) ?? ITEMS[0];

  // Re-quote whenever the trip changes.
  useEffect(() => {
    setQuote(null);
    if (!pickup || !dropoff) {
      setQuoteState('idle');
      return;
    }
    let cancelled = false;
    setQuoteState('loading');
    post<Quote>('/api/quote', { pickupPlaceId: pickup.placeId, dropoffPlaceId: dropoff.placeId, sessionToken: session, item: itemSlug, tier, helper })
      .then((q) => {
        if (cancelled) return;
        setQuote(q);
        setQuoteState('idle');
        if (!priceTracked.current) {
          priceTracked.current = true;
          track('price_shown', { item: itemSlug, tier, helper, source, total: q.totalCents / 100, miles: q.miles });
        }
      })
      .catch((e: Error & Partial<ApiError>) => {
        if (cancelled) return;
        if (e.error === 'maps_unavailable' || e.error === 'not_configured') setQuoteState('unavailable');
        else {
          setQuoteState('error');
          setQuoteError(e.message);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [pickup, dropoff, itemSlug, tier, helper, session, source]);

  async function onSubmit(e: { preventDefault(): void }) {
    e.preventDefault();
    if (!quote || submitting) return;
    setSubmitting(true);
    setSubmitError('');
    track('booking_started', { item: itemSlug, tier, helper, source, total: quote.totalCents / 100 });
    try {
      const r = await post<{ id: string; total: string; when: string; phone: string; decideBy: string }>('/api/book', {
        quote: quote.quote,
        name,
        phone,
        email,
        notes,
        when: whenType === 'asap' ? { type: 'asap' } : { type: 'scheduled', date, window: window_ },
      });
      setBooked(r);
      track('booking_completed', { item: itemSlug, tier, helper, source, total: quote.totalCents / 100, when: whenType });
    } catch (err) {
      const ex = err as Error & Partial<ApiError>;
      if (ex.error === 'quote_expired') {
        setSession(newSession()); // forces a fresh quote
        setSubmitError('Your price expired, so we refreshed it. Check the new price and book again.');
      } else if (ex.error === 'no_drivers' || ex.error === 'not_configured') {
        const tel = phoneFact.value;
        setSubmitError(`${ex.message}${tel ? ` Call ${tel} to book.` : ''}`);
      } else setSubmitError(ex.message);
    } finally {
      setSubmitting(false);
    }
  }

  const box = 'rounded-sm border-t-4 border-brand bg-bg p-5 shadow-[0_8px_24px_var(--color-border)]';

  if (booked) {
    return (
      <div className={box} role="status">
        <h2 className="text-xl">Request received</h2>
        <p className="mt-3">
          Your reference is <strong>{booked.id}</strong>. We're texting BoxHauls drivers now. You'll get a text at <strong>{booked.phone}</strong> as soon as one accepts, or by{' '}
          <strong>{new Date(booked.decideBy).toLocaleString('en-US', { timeZone: 'America/Los_Angeles', weekday: 'short', hour: 'numeric', minute: '2-digit' })}</strong> if no driver is available.
        </p>
        <dl className="mt-3 space-y-1 text-sm">
          <div className="flex justify-between gap-4"><dt className="text-muted">When</dt><dd>{booked.when}</dd></div>
          <div className="flex justify-between gap-4"><dt className="text-muted">Quoted price</dt><dd>{booked.total}</dd></div>
        </dl>
        <p className="mt-3 text-sm text-muted">No payment was taken online.</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className={box} aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className="text-xl">See your price</h2>

      <div className="mt-4 grid gap-4">
        <AddressField label="Pickup address" placeholder="Where is it now?" value={pickup} onPick={setPickup} sessionToken={session} />
        <AddressField label="Drop-off address" placeholder="Where is it going?" value={dropoff} onPick={setDropoff} sessionToken={session} />
        <div>
          <label htmlFor={`${id}-item`} className={labelCls}>What's going</label>
          <select
            id={`${id}-item`}
            className={field}
            value={itemSlug}
            onChange={(e) => {
              setItemSlug(e.target.value);
              setTier(itemBySlug(e.target.value)?.tier ?? 'TIER_3');
            }}
          >
            {ITEMS.map((i) => <option key={i.slug} value={i.slug}>{i.label}</option>)}
          </select>
          {item.note && <p className="mt-1 text-sm text-muted">{renderNote(item.note)}</p>}
        </div>
        <fieldset>
          <legend className={labelCls}>Job type</legend>
          <div className="mt-1 grid gap-2 sm:grid-cols-3">
            {TIERS.map((t) => (
              <label key={t.key} className={`flex cursor-pointer items-center gap-2 rounded-sm border-2 px-3 py-2 text-sm ${tier === t.key ? 'border-brand' : 'border-border'}`}>
                <input type="radio" name={`${id}-tier`} value={t.key} checked={tier === t.key} onChange={() => setTier(t.key)} className="accent-[var(--color-brand)]" />
                {t.name}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" checked={helper} onChange={(e) => setHelper(e.target.checked)} className="mt-1 accent-[var(--color-brand)]" />
          <span>
            <strong>Request a helper</strong> (+${(money('HELPER_FEE') ?? 0).toFixed(2)}). Helpers come with the driver, so one is available only when a driver bringing a helper accepts. Not guaranteed.
          </span>
        </label>
      </div>

      <div className="mt-5 border-t border-border pt-4" aria-live="polite">
        {quoteState === 'unavailable' ? (
          <CallUs />
        ) : !pickup || !dropoff ? (
          <p className="text-sm text-muted">Choose both addresses from the suggestions to see your price.</p>
        ) : quoteState === 'loading' ? (
          <p className="text-sm text-muted">Calculating your price…</p>
        ) : quoteState === 'error' ? (
          <p className="text-sm text-brand">{quoteError}</p>
        ) : quote ? (
          <>
            <dl className="space-y-1 text-sm">
              {quote.lines.map((l) => (
                <div key={l.label} className="flex justify-between gap-4"><dt className="text-muted">{l.label}</dt><dd>{usd(l.cents)}</dd></div>
              ))}
              <div className="flex justify-between gap-4 border-t border-border pt-2 text-lg font-bold"><dt>Total</dt><dd>{usd(quote.totalCents)}</dd></div>
            </dl>
            {item.slug === 'dump-run' && <p className="mt-1 text-sm text-muted">Plus the dump fee, passed through at cost.</p>}
          </>
        ) : null}
      </div>

      {quote && (
        <div className="mt-5 grid gap-4 border-t border-border pt-4">
          <fieldset>
            <legend className={labelCls}>When</legend>
            <div className="mt-1 grid gap-2 sm:grid-cols-2">
              {(['asap', 'scheduled'] as const).map((w) => (
                <label key={w} className={`flex cursor-pointer items-center gap-2 rounded-sm border-2 px-3 py-2 text-sm ${whenType === w ? 'border-brand' : 'border-border'}`}>
                  <input type="radio" name={`${id}-when`} checked={whenType === w} onChange={() => setWhenType(w)} className="accent-[var(--color-brand)]" />
                  {w === 'asap' ? 'As soon as possible' : 'Schedule a time'}
                </label>
              ))}
            </div>
          </fieldset>
          {whenType === 'scheduled' && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor={`${id}-date`} className={labelCls}>Date</label>
                <select id={`${id}-date`} className={field} value={date} onChange={(e) => setDate(e.target.value)}>
                  {dates.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor={`${id}-window`} className={labelCls}>Time window</label>
                <select id={`${id}-window`} className={field} value={window_} onChange={(e) => setWindow(e.target.value)}>
                  {WINDOWS.map((w) => <option key={w} value={w}>{w}</option>)}
                </select>
              </div>
            </div>
          )}
          <div>
            <label htmlFor={`${id}-name`} className={labelCls}>Your name</label>
            <input id={`${id}-name`} className={field} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor={`${id}-phone`} className={labelCls}>Mobile phone</label>
              <input id={`${id}-phone`} className={field} type="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required />
            </div>
            <div>
              <label htmlFor={`${id}-email`} className={labelCls}>Email</label>
              <input id={`${id}-email`} className={field} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
          </div>
          <div>
            <label htmlFor={`${id}-notes`} className={labelCls}>Notes for the driver <span className="font-normal text-muted">(optional)</span></label>
            <textarea id={`${id}-notes`} className={field} rows={3} maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Stairs, gate codes, where to park" />
          </div>
        </div>
      )}

      <button
        type="submit"
        disabled={!quote || submitting}
        className="display mt-5 w-full rounded-sm bg-brand px-6 py-3 text-lg text-inverse hover:bg-brand-hover disabled:cursor-not-allowed disabled:bg-border-strong"
      >
        {submitting ? 'Sending…' : quote ? `Request this trip · ${usd(quote.totalCents)}` : 'Book this trip'}
      </button>
      {quote && (
        <p className="mt-2 text-xs text-muted">
          No payment is taken online. By requesting, you agree to receive text messages about this booking from BoxHauls. Message and data rates may apply. Reply STOP to opt out.
        </p>
      )}
      {submitError && <p className="mt-3 text-sm text-brand" role="alert">{submitError}</p>}
    </form>
  );
}

/** Render "[TODO: …]" inside an item note as a visible marker. */
function renderNote(note: string) {
  const parts = note.split(/(\[TODO: [^\]]+\])/g).filter(Boolean);
  return parts.map((p, i) => (p.startsWith('[TODO: ') ? <span key={i} className="todo">{p}</span> : <span key={i}>{p}</span>));
}
