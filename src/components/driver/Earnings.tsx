/** BoxHauls Driver earnings: this week's total, a bar per day, trips with fare and tip, and the payout dashboard link. */
import { useEffect, useState } from 'react';
import { post, usd } from './api';

interface Week {
  weekStart: string;
  totalCents: number;
  fareCents: number;
  tipCents: number;
  tripCount: number;
  onlineMinutes: number | null;
  days: { date: string; cents: number }[];
  trips: { id: string; item: string; at: string; canceled: boolean; route: string; miles: number; fareCents: number; tipCents: number }[];
}

export default function Earnings() {
  const [weeksAgo, setWeeksAgo] = useState(0);
  const [week, setWeek] = useState<Week | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setWeek(null);
    post<Week>('/api/driver/earnings', { weeksAgo }).then(setWeek).catch((e) => setError((e as Error).message));
  }, [weeksAgo]);

  const max = Math.max(1, ...(week?.days.map((d) => d.cents) ?? [1]));
  const label = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'narrow' });
  const range = week ? `${new Date(`${week.weekStart}T12:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' })} – ${new Date(Date.parse(`${week.weekStart}T12:00:00Z`) + 6 * 86400_000).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' })}` : '';

  return (
    <div className="h-full overflow-y-auto bg-bg text-ink">
      <header className="bg-night px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-6 text-inverse">
        <h1 className="text-2xl">Earnings</h1>
        <div className="mt-4 flex items-center justify-between">
          <button onClick={() => setWeeksAgo((w) => w + 1)} aria-label="Previous week" className="flex h-10 w-10 items-center justify-center rounded-full bg-night-border">‹</button>
          <div className="text-center">
            <p className="text-sm text-night-muted">{range}</p>
            <p className="display text-5xl">{usd(week?.totalCents ?? 0)}</p>
          </div>
          <button onClick={() => setWeeksAgo((w) => Math.max(0, w - 1))} disabled={weeksAgo === 0} aria-label="Next week" className="flex h-10 w-10 items-center justify-center rounded-full bg-night-border disabled:opacity-30">›</button>
        </div>
        <div className="mt-6 flex h-28 items-end justify-between gap-2" aria-hidden="true">
          {week?.days.map((d) => (
            <div key={d.date} className="flex flex-1 flex-col items-center gap-1">
              <div className="w-full rounded-t-sm bg-brand" style={{ height: `${Math.max(3, (d.cents / max) * 96)}px`, opacity: d.cents ? 1 : 0.25 }} />
              <span className="text-xs text-night-muted">{label(d.date)}</span>
            </div>
          ))}
        </div>
      </header>
      <div className="grid grid-cols-3 divide-x divide-border border-b border-border text-center">
        <div className="py-4"><p className="text-xl font-bold">{week?.tripCount ?? 0}</p><p className="text-xs text-muted">Trips</p></div>
        <div className="py-4"><p className="text-xl font-bold">{usd(week?.tipCents ?? 0)}</p><p className="text-xs text-muted">Tips</p></div>
        <div className="py-4"><p className="text-xl font-bold">{week?.onlineMinutes != null ? `${Math.floor(week.onlineMinutes / 60)}h ${week.onlineMinutes % 60}m` : '—'}</p><p className="text-xs text-muted">Online</p></div>
      </div>
      <div className="p-5">
        <h2 className="text-lg">Trips</h2>
        {week && week.trips.length === 0 && <p className="mt-2 text-sm text-muted">No trips this week yet.</p>}
        <ul className="mt-2 divide-y divide-border">
          {week?.trips.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-4 py-3">
              <span className="min-w-0">
                <span className="block font-semibold">{t.canceled ? 'Cancellation fee' : t.item}</span>
                <span className="block truncate text-sm text-muted">{new Date(t.at).toLocaleString('en-US', { timeZone: 'America/Los_Angeles', weekday: 'short', hour: 'numeric', minute: '2-digit' })} · {t.route}</span>
              </span>
              <span className="shrink-0 text-right">
                <span className="block font-bold">{usd(t.fareCents + t.tipCents)}</span>
                {t.tipCents > 0 && <span className="block text-xs text-muted">incl. {usd(t.tipCents)} tip</span>}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-6 text-xs text-muted">Payouts are sent by Stripe to your bank. See payout dates and tax forms in Account → Payouts.</p>
        {error && <p className="mt-2 text-sm font-semibold text-brand">{error}</p>}
      </div>
    </div>
  );
}
