/**
 * Booking widget (React island). Mounted on / and /book/.
 *
 * Stub: there is no legacy booking component in ./legacy/ and no routing or booking API yet. The fields, job
 * types, heavy-item fee, helper rule and price formula are real (docs/placeholders.json via src/lib/pricing.ts).
 * Trip distance can't be computed without routing, so after both addresses are entered the price uses a clearly
 * labeled demo distance. No price is shown until both addresses exist. No driver cards, ETAs, ratings or payout
 * split — ever (CLAUDE.md rule 3, map Section 4).
 */
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ITEMS, TIERS, itemBySlug, tierBySlug, type TierKey } from '../lib/items';
import { tripPrice, usd } from '../lib/pricing';
import { money, radius } from '../lib/site';

declare global {
  interface Window {
    bhTrack?: (event: string, params?: Record<string, unknown>) => void;
  }
}

const track = (event: string, params: Record<string, unknown>) => window.bhTrack?.(event, params);
const MAX_MILES = Number(radius.value ?? 25);
const ADDRESS_MIN = 6;

function Todo({ children }: { children: string }) {
  return <span className="todo">[TODO: {children}]</span>;
}

export default function BookingWidget({ source = 'home' }: { source?: string }) {
  const id = useId();
  const [pickup, setPickup] = useState('');
  const [dropoff, setDropoff] = useState('');
  const [itemSlug, setItemSlug] = useState('couch');
  const [tier, setTier] = useState<TierKey>('TIER_3');
  const [helper, setHelper] = useState(false);
  const [miles, setMiles] = useState(10);
  const [submitted, setSubmitted] = useState(false);
  const priceTracked = useRef(false);

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
  const ready = pickup.trim().length >= ADDRESS_MIN && dropoff.trim().length >= ADDRESS_MIN;

  const breakdown = useMemo(() => {
    const base = money('BASE_FARE') ?? 0;
    const perMile = money('PER_MILE') ?? 0;
    const heavyFee = money('HEAVY_FEE') ?? 0;
    const helperFee = money('HELPER_FEE') ?? 0;
    return {
      lines: [
        { label: 'Base fare', amount: base },
        { label: `${miles} miles × ${usd(perMile)}`, amount: perMile * miles },
        ...(item.heavy ? [{ label: 'Heavy-item fee', amount: heavyFee }] : []),
        ...(helper ? [{ label: 'Helper (when available)', amount: helperFee }] : []),
      ],
      total: tripPrice(miles, { heavy: item.heavy, helper }),
    };
  }, [miles, item.heavy, helper]);

  useEffect(() => {
    if (ready && !priceTracked.current) {
      priceTracked.current = true;
      track('price_shown', { item: item.slug, tier, helper, source, total: breakdown.total });
    }
  }, [ready, item.slug, tier, helper, source, breakdown.total]);

  function onSubmit(e: { preventDefault(): void }) {
    e.preventDefault();
    if (!ready) return;
    track('booking_started', { item: item.slug, tier, helper, source, total: breakdown.total });
    setSubmitted(true);
  }

  const field = 'mt-1 w-full rounded-sm border-2 border-border-strong bg-bg px-3 py-2 text-ink focus:border-brand';
  const label = 'block text-sm font-semibold text-ink';

  return (
    <form onSubmit={onSubmit} className="rounded-sm border-t-4 border-brand bg-bg p-5 shadow-[0_8px_24px_var(--color-border)]" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className="text-xl">See your price</h2>

      <div className="mt-4 grid gap-4">
        <div>
          <label htmlFor={`${id}-pickup`} className={label}>Pickup address</label>
          <input id={`${id}-pickup`} className={field} autoComplete="street-address" value={pickup} onChange={(e) => setPickup(e.target.value)} placeholder="Where is it now?" required />
        </div>
        <div>
          <label htmlFor={`${id}-dropoff`} className={label}>Drop-off address</label>
          <input id={`${id}-dropoff`} className={field} autoComplete="street-address" value={dropoff} onChange={(e) => setDropoff(e.target.value)} placeholder="Where is it going?" required />
        </div>
        <div>
          <label htmlFor={`${id}-item`} className={label}>What's going</label>
          <select
            id={`${id}-item`}
            className={field}
            value={itemSlug}
            onChange={(e) => {
              setItemSlug(e.target.value);
              setTier(itemBySlug(e.target.value)?.tier ?? 'TIER_3');
            }}
          >
            {ITEMS.map((i) => (
              <option key={i.slug} value={i.slug}>{i.label}</option>
            ))}
          </select>
          {item.note && <p className="mt-1 text-sm text-muted">{renderNote(item.note)}</p>}
        </div>

        <fieldset>
          <legend className={label}>Job type</legend>
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
            <strong>Request a helper</strong> (+{usd(money('HELPER_FEE') ?? 0)}). Helpers come with the driver, so one is available only when a driver bringing a helper accepts. Not guaranteed.
          </span>
        </label>
      </div>

      <div className="mt-5 border-t border-border pt-4" aria-live="polite">
        {!ready ? (
          <p className="text-sm text-muted">Enter both addresses to see your price.</p>
        ) : (
          <>
            <label htmlFor={`${id}-miles`} className={label}>
              Trip distance: {miles} miles <span className="font-normal text-muted">(demo)</span>
            </label>
            <input id={`${id}-miles`} type="range" min={1} max={MAX_MILES} value={miles} onChange={(e) => setMiles(Number(e.target.value))} className="mt-2 w-full accent-[var(--color-brand)]" />
            <p className="mt-1 text-xs text-muted">
              <Todo>connect routing so distance comes from the two addresses</Todo>
            </p>
            <dl className="mt-3 space-y-1 text-sm">
              {breakdown.lines.map((l) => (
                <div key={l.label} className="flex justify-between gap-4">
                  <dt className="text-muted">{l.label}</dt>
                  <dd>{usd(l.amount)}</dd>
                </div>
              ))}
              <div className="flex justify-between gap-4 border-t border-border pt-2 text-lg font-bold">
                <dt>Total</dt>
                <dd>{usd(breakdown.total)}</dd>
              </div>
            </dl>
            {item.slug === 'dump-run' && <p className="mt-1 text-sm text-muted">Plus the dump fee, passed through at cost.</p>}
          </>
        )}
      </div>

      <button
        type="submit"
        disabled={!ready}
        className="display mt-5 w-full rounded-sm bg-brand px-6 py-3 text-lg text-inverse hover:bg-brand-hover disabled:cursor-not-allowed disabled:bg-border-strong"
      >
        Book this trip
      </button>
      {submitted && (
        <p className="mt-3 text-sm" role="status">
          <Todo>connect the booking API; web booking isn't live yet</Todo>
        </p>
      )}
    </form>
  );
}

/** Render "[TODO: …]" inside an item note as a visible marker. */
function renderNote(note: string) {
  const parts = note.split(/(\[TODO: [^\]]+\])/g).filter(Boolean);
  return parts.map((p, i) => (p.startsWith('[TODO: ') ? <Todo key={i}>{p.slice(7, -1)}</Todo> : <span key={i}>{p}</span>));
}
