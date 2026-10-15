/**
 * Customer accounts (React island) at /account/. Signed out: Sign in (email + password, or phone + texted code
 * once Twilio is live) and Create account. Signed in: trips, profile, saved places, card on file, notifications,
 * password, sign out and Delete account. Booking still works without an account.
 */
import { useEffect, useState, type ReactNode } from 'react';

interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  hasPassword: boolean;
  home: { address: string } | null;
  work: { address: string } | null;
  card: { brand: string; last4: string; exp: string } | null;
  smsOptIn: boolean;
  marketingEmail: boolean;
  marketingSms: boolean;
  memberSince: string;
}
interface TripRow {
  id: string;
  status: string;
  item: string;
  when: string;
  pickup: string;
  dropoff: string;
  totalCents: number;
  tipCents: number;
  createdAt: string;
}

async function post<T>(url: string, body: unknown = {}): Promise<T> {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({ message: 'Something went wrong.' }));
  if (!res.ok) throw Object.assign(new Error(data.message), data);
  return data as T;
}
const usd = (c: number) => `$${(c / 100).toFixed(2)}`;
const remember = (name: string | null) => {
  try {
    if (name) localStorage.setItem('bh-account', name);
    else localStorage.removeItem('bh-account');
  } catch {
    /* storage blocked */
  }
};

const inputCls = 'mt-1 w-full rounded-sm border-2 border-border-strong bg-bg px-3 py-2.5 text-ink outline-none focus:border-ink';
const btn = 'display w-full rounded-sm bg-brand px-6 py-3 text-lg text-inverse hover:bg-brand-hover disabled:bg-border-strong';

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-semibold">{label}</span>
      {children}
    </label>
  );
}

function useForm<T extends Record<string, string | boolean>>(initial: T) {
  const [v, setV] = useState(initial);
  const bind = (k: keyof T) => ({ value: v[k] as string, onChange: (e: { target: { value: string } }) => setV((s) => ({ ...s, [k]: e.target.value })) });
  const check = (k: keyof T) => ({ checked: v[k] as boolean, onChange: (e: { target: { checked: boolean } }) => setV((s) => ({ ...s, [k]: e.target.checked })) });
  return { v, setV, bind, check };
}

// ───────────────────────── Signed out ─────────────────────────
function SignedOut({ onIn, phoneAvailable, resetAvailable }: { onIn: () => void; phoneAvailable: boolean; resetAvailable: boolean }) {
  const initial = new URLSearchParams(location.search).get('mode') === 'signup' ? 'signup' : 'signin';
  const [mode, setMode] = useState<'signin' | 'signup' | 'phone' | 'forgot'>(initial);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const f = useForm({ firstName: '', lastName: '', email: '', phone: '', password: '', code: '', terms: false, marketing: false });
  const [codeSent, setCodeSent] = useState(false);
  const [newPhoneAccount, setNewPhoneAccount] = useState(false);

  async function run(e: { preventDefault(): void }, fn: () => Promise<unknown>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const done = () => {
    const next = new URLSearchParams(location.search).get('next');
    if (next && next.startsWith('/') && !next.startsWith('//')) location.href = next;
    else onIn();
  };

  const tabs = (
    <div className="grid grid-cols-2 rounded-md bg-surface p-1 text-center font-semibold" role="tablist">
      {(['signin', 'signup'] as const).map((m) => (
        <button key={m} role="tab" aria-selected={mode === m || (m === 'signin' && (mode === 'phone' || mode === 'forgot'))} onClick={() => { setMode(m); setError(''); }} className={`rounded-sm py-2.5 ${mode === m || (m === 'signin' && (mode === 'phone' || mode === 'forgot')) ? 'bg-bg shadow-sm' : 'text-muted'}`}>
          {m === 'signin' ? 'Sign in' : 'Create account'}
        </button>
      ))}
    </div>
  );

  return (
    <div className="mx-auto max-w-md">
      {tabs}
      <div className="mt-6">
        {mode === 'signin' && (
          <form className="space-y-4" onSubmit={(e) => run(e, async () => { await post('/api/auth/login', { app: 'customer', email: f.v.email, password: f.v.password }); done(); })}>
            <Field label="Email"><input type="email" autoComplete="email" required className={inputCls} {...f.bind('email')} /></Field>
            <Field label="Password"><input type="password" autoComplete="current-password" required className={inputCls} {...f.bind('password')} /></Field>
            <button className={btn} disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
            <div className="flex flex-wrap justify-between gap-2 text-sm">
              {resetAvailable && <button type="button" className="font-semibold underline" onClick={() => setMode('forgot')}>Forgot password?</button>}
              {phoneAvailable && <button type="button" className="font-semibold underline" onClick={() => setMode('phone')}>Use your phone number instead</button>}
            </div>
          </form>
        )}

        {mode === 'phone' && (
          <form
            className="space-y-4"
            onSubmit={(e) =>
              run(e, async () => {
                if (!codeSent) {
                  const r = await post<{ newAccount: boolean }>('/api/auth/phone-start', { app: 'customer', phone: f.v.phone });
                  setNewPhoneAccount(r.newAccount);
                  setCodeSent(true);
                  return;
                }
                await post('/api/auth/phone-verify', { app: 'customer', phone: f.v.phone, code: f.v.code, firstName: f.v.firstName, lastName: f.v.lastName, acceptTerms: f.v.terms });
                done();
              })
            }
          >
            <Field label="Mobile number"><input type="tel" autoComplete="tel" required className={inputCls} disabled={codeSent} {...f.bind('phone')} /></Field>
            {codeSent && (
              <>
                <Field label="6-digit code"><input inputMode="numeric" autoComplete="one-time-code" required className={inputCls} {...f.bind('code')} /></Field>
                {newPhoneAccount && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="First name"><input required className={inputCls} {...f.bind('firstName')} /></Field>
                      <Field label="Last name"><input className={inputCls} {...f.bind('lastName')} /></Field>
                    </div>
                    <Terms check={f.check('terms')} />
                  </>
                )}
              </>
            )}
            <button className={btn} disabled={busy}>{busy ? 'One moment…' : codeSent ? 'Continue' : 'Text me a code'}</button>
            <button type="button" className="text-sm font-semibold underline" onClick={() => { setMode('signin'); setCodeSent(false); }}>Use email and password</button>
          </form>
        )}

        {mode === 'forgot' && (
          <form
            className="space-y-4"
            onSubmit={(e) =>
              run(e, async () => {
                if (!codeSent) {
                  await post('/api/auth/forgot', { app: 'customer', email: f.v.email });
                  setCodeSent(true);
                  return;
                }
                await post('/api/auth/reset', { app: 'customer', email: f.v.email, code: f.v.code, password: f.v.password });
                done();
              })
            }
          >
            <p className="text-sm text-muted">{codeSent ? 'If that email has an account, we sent a code by text or email.' : 'We’ll send a reset code to the phone or email on your account.'}</p>
            <Field label="Email"><input type="email" required className={inputCls} disabled={codeSent} {...f.bind('email')} /></Field>
            {codeSent && (
              <>
                <Field label="Reset code"><input inputMode="numeric" autoComplete="one-time-code" required className={inputCls} {...f.bind('code')} /></Field>
                <Field label="New password"><input type="password" autoComplete="new-password" minLength={8} required className={inputCls} {...f.bind('password')} /></Field>
              </>
            )}
            <button className={btn} disabled={busy}>{codeSent ? 'Set new password' : 'Send code'}</button>
            <button type="button" className="text-sm font-semibold underline" onClick={() => { setMode('signin'); setCodeSent(false); }}>Back to sign in</button>
          </form>
        )}

        {mode === 'signup' && (
          <form
            className="space-y-4"
            onSubmit={(e) =>
              run(e, async () => {
                await post('/api/account/signup', { firstName: f.v.firstName, lastName: f.v.lastName, email: f.v.email, phone: f.v.phone, password: f.v.password, acceptTerms: f.v.terms, marketingEmail: f.v.marketing });
                done();
              })
            }
          >
            <div className="grid grid-cols-2 gap-3">
              <Field label="First name"><input autoComplete="given-name" required className={inputCls} {...f.bind('firstName')} /></Field>
              <Field label="Last name"><input autoComplete="family-name" required className={inputCls} {...f.bind('lastName')} /></Field>
            </div>
            <Field label="Email"><input type="email" autoComplete="email" required className={inputCls} {...f.bind('email')} /></Field>
            <Field label="Mobile number"><input type="tel" autoComplete="tel" required className={inputCls} placeholder="(559) 555-0123" {...f.bind('phone')} /></Field>
            <Field label="Password"><input type="password" autoComplete="new-password" minLength={8} required className={inputCls} {...f.bind('password')} /><span className="mt-1 block text-xs text-muted">At least 8 characters.</span></Field>
            <Terms check={f.check('terms')} />
            <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1 accent-[var(--color-brand)]" {...f.check('marketing')} /> <span>Email me BoxHauls news and offers (optional)</span></label>
            <button className={btn} disabled={busy}>{busy ? 'Creating account…' : 'Create account'}</button>
          </form>
        )}
        {error && <p className="mt-4 text-sm text-brand" role="alert">{error}</p>}
      </div>
    </div>
  );
}

function Terms({ check }: { check: { checked: boolean; onChange: (e: { target: { checked: boolean } }) => void } }) {
  return (
    <label className="flex items-start gap-2 text-sm">
      <input type="checkbox" required className="mt-1 accent-[var(--color-brand)]" {...check} />
      <span>I agree to the <a href="/legal/terms/" target="_blank">Terms of Service</a> and <a href="/legal/privacy/" target="_blank">Privacy Policy</a>.</span>
    </label>
  );
}

// ───────────────────────── Signed in ─────────────────────────
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-md border border-border p-5">
      <h2 className="text-xl">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

const STATUS: Record<string, string> = { dispatching: 'Finding driver', assigned: 'In progress', completed: 'Completed', canceled: 'Canceled', unfilled: 'No driver', abandoned: 'Not completed' };

function SignedIn({ customer, onChange, onOut }: { customer: Customer; onChange: (c: Customer) => void; onOut: () => void }) {
  const [tab, setTab] = useState<'trips' | 'profile' | 'settings'>('trips');
  const [trips, setTrips] = useState<TripRow[] | null>(null);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const p = useForm({ firstName: customer.firstName, lastName: customer.lastName, email: customer.email, phone: customer.phone, home: customer.home?.address ?? '', work: customer.work?.address ?? '' });
  const pw = useForm({ current: '', next: '' });
  const [del, setDel] = useState('');

  useEffect(() => {
    post<{ trips: TripRow[] }>('/api/account/trips').then((r) => setTrips(r.trips)).catch(() => setTrips([]));
  }, []);

  async function save(body: Record<string, unknown>, ok = 'Saved.') {
    setBusy(true);
    setError('');
    setMsg('');
    try {
      const r = await post<{ customer: Customer }>('/api/account/update', body);
      onChange(r.customer);
      setMsg(ok);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    await post('/api/auth/logout', { app: 'customer' }).catch(() => undefined);
    remember(null);
    onOut();
  }

  async function deleteAccount() {
    setBusy(true);
    setError('');
    try {
      await post('/api/account/delete', { confirm: del });
      remember(null);
      location.href = '/?account=deleted';
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  const toggle = (key: 'smsOptIn' | 'marketingEmail' | 'marketingSms', label: string, hint: string) => (
    <label className="flex items-start justify-between gap-4 border-b border-border py-3 last:border-0">
      <span><span className="font-semibold">{label}</span><span className="block text-sm text-muted">{hint}</span></span>
      <input type="checkbox" className="mt-1 h-5 w-5 accent-[var(--color-brand)]" checked={customer[key]} onChange={(e) => save({ [key]: e.target.checked })} />
    </label>
  );

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className="display flex h-14 w-14 items-center justify-center rounded-full bg-brand text-2xl text-inverse">{customer.firstName.slice(0, 1) || '?'}</span>
          <div>
            <p className="text-2xl font-bold">Hi, {customer.firstName || 'there'}</p>
            <p className="text-sm text-muted">Member since {new Date(customer.memberSince).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</p>
          </div>
        </div>
        <a href="/book/" className="display rounded-sm bg-brand px-5 py-3 text-inverse no-underline hover:bg-brand-hover hover:text-inverse">Book a trip</a>
      </div>

      <div className="grid grid-cols-3 rounded-md bg-surface p-1 text-center font-semibold" role="tablist">
        {(['trips', 'profile', 'settings'] as const).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => { setTab(t); setMsg(''); setError(''); }} className={`rounded-sm py-2.5 capitalize ${tab === t ? 'bg-bg shadow-sm' : 'text-muted'}`}>{t === 'trips' ? 'Your trips' : t}</button>
        ))}
      </div>

      {tab === 'trips' && (
        <Section title="Your trips">
          {trips === null && <p className="text-muted">Loading…</p>}
          {trips?.length === 0 && <p className="text-muted">No trips yet. Trips you book while signed in show up here.</p>}
          <ul className="divide-y divide-border">
            {trips?.map((t) => (
              <li key={t.id}>
                <a href={`/book/trip/?id=${t.id}`} className="flex items-center justify-between gap-4 py-3 text-ink no-underline hover:text-brand">
                  <span className="min-w-0">
                    <span className="block font-semibold">{t.item} · {t.when}</span>
                    <span className="block truncate text-sm text-muted">{t.pickup} → {t.dropoff}</span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block font-semibold">{usd(t.totalCents + t.tipCents)}</span>
                    <span className="block text-xs text-muted">{STATUS[t.status] ?? t.status}</span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {tab === 'profile' && (
        <>
          <Section title="Profile">
            <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save({ firstName: p.v.firstName, lastName: p.v.lastName, email: p.v.email, phone: p.v.phone }); }}>
              <div className="grid grid-cols-2 gap-3">
                <Field label="First name"><input className={inputCls} {...p.bind('firstName')} /></Field>
                <Field label="Last name"><input className={inputCls} {...p.bind('lastName')} /></Field>
              </div>
              <Field label="Email"><input type="email" className={inputCls} {...p.bind('email')} /></Field>
              <Field label="Mobile number"><input type="tel" className={inputCls} {...p.bind('phone')} /></Field>
              <button className={btn} disabled={busy}>Save profile</button>
            </form>
          </Section>
          <Section title="Saved places">
            <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save({ home: p.v.home ? { address: p.v.home } : null, work: p.v.work ? { address: p.v.work } : null }); }}>
              <Field label="Home"><input className={inputCls} placeholder="Street address" {...p.bind('home')} /></Field>
              <Field label="Work"><input className={inputCls} placeholder="Street address" {...p.bind('work')} /></Field>
              <button className={btn} disabled={busy}>Save places</button>
            </form>
          </Section>
          <Section title="Payment">
            {customer.card ? (
              <div className="flex items-center justify-between gap-4">
                <p><span className="font-semibold capitalize">{customer.card.brand}</span> ending in {customer.card.last4} · expires {customer.card.exp}</p>
                <button className="text-sm font-semibold text-brand underline" onClick={() => save({ removeCard: true }, 'Card removed.')}>Remove</button>
              </div>
            ) : (
              <p className="text-muted">The card you use for your next trip shows here. Card numbers are kept by Stripe, never by BoxHauls.</p>
            )}
          </Section>
        </>
      )}

      {tab === 'settings' && (
        <>
          <Section title="Notifications">
            {toggle('smsOptIn', 'Trip texts', 'Driver updates and receipts for your trips.')}
            {toggle('marketingEmail', 'Email offers', 'BoxHauls news and promotions.')}
            {toggle('marketingSms', 'Text offers', 'Occasional promotions by text.')}
          </Section>
          <Section title={customer.hasPassword ? 'Change password' : 'Set a password'}>
            <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save({ currentPassword: pw.v.current, newPassword: pw.v.next }, 'Password updated.').then(() => pw.setV({ current: '', next: '' })); }}>
              {customer.hasPassword && <Field label="Current password"><input type="password" autoComplete="current-password" className={inputCls} {...pw.bind('current')} /></Field>}
              <Field label="New password"><input type="password" autoComplete="new-password" minLength={8} className={inputCls} {...pw.bind('next')} /></Field>
              <button className={btn} disabled={busy}>Update password</button>
            </form>
          </Section>
          <Section title="Account">
            <button onClick={signOut} className="w-full rounded-sm border-2 border-ink px-6 py-3 font-semibold">Sign out</button>
            <details className="mt-5 rounded-md border-2 border-brand p-4">
              <summary className="cursor-pointer font-semibold text-brand">Delete account</summary>
              <p className="mt-3 text-sm">This permanently deletes your BoxHauls account: your profile, saved places, saved card and sign-in. Trip and payment records are kept without your name, phone or email, as required for accounting. You can’t undo this.</p>
              <Field label="Type DELETE to confirm"><input className={inputCls} value={del} onChange={(e) => setDel(e.target.value)} autoComplete="off" /></Field>
              <button onClick={deleteAccount} disabled={del !== 'DELETE' || busy} className="display mt-4 w-full rounded-sm bg-brand px-6 py-3 text-inverse disabled:bg-border-strong">Delete my account</button>
            </details>
          </Section>
        </>
      )}
      {msg && <p className="text-sm font-semibold" role="status">{msg}</p>}
      {error && <p className="text-sm text-brand" role="alert">{error}</p>}
    </div>
  );
}

export default function AccountApp() {
  const [state, setState] = useState<{ loading: boolean; customer: Customer | null }>({ loading: true, customer: null });
  const [opts, setOpts] = useState({ phone: false, passwordReset: false });

  async function refresh() {
    const r = await post<{ signedIn: boolean; customer?: Customer }>('/api/account/me').catch(() => ({ signedIn: false }) as { signedIn: boolean; customer?: Customer });
    remember(r.signedIn && r.customer ? r.customer.firstName || 'You' : null);
    setState({ loading: false, customer: r.signedIn ? r.customer ?? null : null });
  }

  useEffect(() => {
    refresh();
    post<{ phone: boolean; passwordReset: boolean }>('/api/auth/options').then(setOpts).catch(() => undefined);
  }, []);

  if (state.loading) return <p className="text-center text-muted">Loading…</p>;
  return state.customer ? (
    <SignedIn customer={state.customer} onChange={(c) => setState({ loading: false, customer: c })} onOut={() => setState({ loading: false, customer: null })} />
  ) : (
    <SignedOut onIn={refresh} phoneAvailable={opts.phone} resetAvailable={opts.passwordReset} />
  );
}
