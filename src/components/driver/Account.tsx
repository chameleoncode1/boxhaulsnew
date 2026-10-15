/** BoxHauls Driver account: profile, documents and truck, payouts, app settings, help, sign out, delete account. */
import { useState } from 'react';
import { post, type Driver } from './api';
import { StepForm } from './Enrollment';
import { Chevron, ErrorText, Field, Screen, inputCls, primaryBtn } from './ui';

type View = null | 'profile' | 'password' | 'delete' | 'settings' | 'personal' | 'license' | 'vehicle' | 'registration' | 'insurance' | 'photo' | 'payouts' | 'emergency' | 'background' | 'agreement';

export default function Account({ driver, onChange, onSignedOut, supportPhone }: { driver: Driver; onChange: (d: Driver) => void; onSignedOut: () => void; supportPhone: string }) {
  const [view, setView] = useState<View>(null);
  const [v, setV] = useState({ firstName: driver.firstName, lastName: driver.lastName, email: driver.email, phone: driver.phone, current: '', next: '', confirm: '' });
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const bind = (k: keyof typeof v) => ({ value: v[k], onChange: (e: { target: { value: string } }) => setV((s) => ({ ...s, [k]: e.target.value })) });

  async function call(url: string, body: unknown, after?: (r: { driver?: Driver; dashboardUrl?: string | null }) => void) {
    setBusy(true);
    setError('');
    setMsg('');
    try {
      const r = await post<{ driver?: Driver; dashboardUrl?: string | null }>(url, body);
      if (r.driver) onChange(r.driver);
      after?.(r);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (view && ['personal', 'license', 'vehicle', 'registration', 'insurance', 'photo', 'payouts', 'emergency', 'background', 'agreement'].includes(view)) {
    return <StepForm step={view as never} driver={driver} onSaved={(d) => { onChange(d); setView(null); }} onBack={() => setView(null)} />;
  }

  if (view === 'profile') {
    return (
      <Screen title="Profile" onBack={() => setView(null)} footer={<button form="profile" className={primaryBtn} disabled={busy}>Save</button>}>
        <form id="profile" className="space-y-4" onSubmit={(e) => { e.preventDefault(); call('/api/driver/profile', { section: 'account', firstName: v.firstName, lastName: v.lastName, email: v.email, phone: v.phone }, () => setMsg('Saved.')); }}>
          <div className="grid grid-cols-2 gap-3">
            <Field label="First name"><input className={inputCls} {...bind('firstName')} /></Field>
            <Field label="Last name"><input className={inputCls} {...bind('lastName')} /></Field>
          </div>
          <Field label="Email"><input type="email" className={inputCls} {...bind('email')} /></Field>
          <Field label="Mobile number"><input type="tel" className={inputCls} {...bind('phone')} /></Field>
          {msg && <p className="text-sm font-semibold">{msg}</p>}
          <ErrorText>{error}</ErrorText>
        </form>
      </Screen>
    );
  }

  if (view === 'password') {
    return (
      <Screen title="Change password" onBack={() => setView(null)} footer={<button form="pw" className={primaryBtn} disabled={busy}>Update password</button>}>
        <form id="pw" className="space-y-4" onSubmit={(e) => { e.preventDefault(); call('/api/driver/profile', { section: 'account', currentPassword: v.current, newPassword: v.next }, () => { setMsg('Password updated.'); setV((s) => ({ ...s, current: '', next: '' })); }); }}>
          <Field label="Current password"><input type="password" autoComplete="current-password" className={inputCls} {...bind('current')} /></Field>
          <Field label="New password" hint="At least 8 characters."><input type="password" autoComplete="new-password" minLength={8} className={inputCls} {...bind('next')} /></Field>
          {msg && <p className="text-sm font-semibold">{msg}</p>}
          <ErrorText>{error}</ErrorText>
        </form>
      </Screen>
    );
  }

  if (view === 'settings') {
    return (
      <Screen title="App settings" onBack={() => setView(null)}>
        <p className="text-sm font-semibold text-muted">Navigation app</p>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {(['google', 'apple', 'waze'] as const).map((a) => (
            <button key={a} onClick={() => call('/api/driver/profile', { section: 'settings', navApp: a })} className={`rounded-md border-2 py-3 font-semibold ${driver.navApp === a ? 'border-brand bg-brand text-inverse' : 'border-border'}`}>
              {a === 'google' ? 'Google Maps' : a === 'apple' ? 'Apple Maps' : 'Waze'}
            </button>
          ))}
        </div>
        <label className="mt-6 flex items-center justify-between gap-4 border-t border-border pt-4">
          <span><span className="font-semibold">Job texts</span><span className="block text-sm text-muted">Get a text when a job comes in.</span></span>
          <input type="checkbox" checked={driver.smsOptIn} onChange={(e) => call('/api/driver/profile', { section: 'settings', smsOptIn: e.target.checked })} className="h-5 w-5 accent-[var(--color-brand)]" />
        </label>
        <ErrorText>{error}</ErrorText>
      </Screen>
    );
  }

  if (view === 'delete') {
    return (
      <Screen title="Delete account" onBack={() => setView(null)} footer={<button onClick={() => call('/api/driver/delete', { confirm: v.confirm }, () => onSignedOut())} disabled={v.confirm !== 'DELETE' || busy} className="display w-full rounded-md bg-brand px-6 py-4 text-lg text-inverse disabled:bg-border-strong">Delete my driver account</button>}>
        <div className="space-y-4 text-sm">
          <p>This permanently deletes your BoxHauls Driver account: your profile, documents, truck details and sign-in. You won't get jobs any more.</p>
          <p>Completed trips and payout amounts are kept for tax records (1099). Your Stripe account stays open so you can still see past payouts and tax forms there.</p>
          <p className="font-semibold">You can't undo this.</p>
          <Field label="Type DELETE to confirm"><input className={inputCls} autoComplete="off" {...bind('confirm')} /></Field>
          <ErrorText>{error}</ErrorText>
        </div>
      </Screen>
    );
  }

  const row = (label: string, sub: string, go: View | (() => void)) => (
    <li>
      <button onClick={() => (typeof go === 'function' ? go() : setView(go))} className="flex w-full items-center gap-4 px-5 py-4 text-left hover:bg-surface">
        <span className="flex-1"><span className="block font-semibold">{label}</span><span className="block text-sm text-muted">{sub}</span></span>
        <Chevron />
      </button>
    </li>
  );
  const stepState = (k: string) => driver.steps.find((s) => s.key === k)?.state;
  const docSub = (k: string) => (stepState(k) === 'done' ? 'On file' : stepState(k) === 'review' ? 'In review' : 'Needed');

  return (
    <div className="h-full overflow-y-auto bg-bg text-ink">
      <header className="flex items-center gap-4 bg-night px-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-6 text-inverse">
        <img src="/api/driver/document?kind=profile_photo" alt="" className="h-16 w-16 rounded-full bg-night-border object-cover" onError={(e) => ((e.target as HTMLImageElement).style.visibility = 'hidden')} />
        <div>
          <p className="text-2xl font-bold">{driver.preferredName || driver.firstName} {driver.lastName}</p>
          <p className="text-sm text-night-muted">{driver.status === 'approved' ? 'BoxHauls driver' : `Application: ${driver.status}`} · since {new Date(driver.memberSince).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</p>
        </div>
      </header>
      <p className="px-5 pt-5 text-sm font-semibold text-muted">Account</p>
      <ul className="mt-1 divide-y divide-border border-y border-border">
        {row('Profile', `${driver.email} · ${driver.phone}`, 'profile')}
        {row('Personal information', 'Date of birth and home address', 'personal')}
        {row('Emergency contact', driver.emergency.name || 'Not set', 'emergency')}
        {row('Password', 'Change your password', 'password')}
      </ul>
      <p className="px-5 pt-5 text-sm font-semibold text-muted">Truck and documents</p>
      <ul className="mt-1 divide-y divide-border border-y border-border">
        {row('Profile photo', docSub('photo'), 'photo')}
        {row("Driver's license", docSub('license'), 'license')}
        {row('Pickup truck', driver.vehicle.make ? `${driver.vehicle.year} ${driver.vehicle.make} ${driver.vehicle.model} · ${driver.vehicle.plate}` : 'Needed', 'vehicle')}
        {row('Registration', docSub('registration'), 'registration')}
        {row('Insurance', docSub('insurance'), 'insurance')}
        {row('Background check', driver.background.status.replace('_', ' '), 'background')}
        {row('Driver agreement', driver.agreementAcceptedAt ? 'Accepted' : 'Needed', 'agreement')}
      </ul>
      <p className="px-5 pt-5 text-sm font-semibold text-muted">Money</p>
      <ul className="mt-1 divide-y divide-border border-y border-border">
        {row('Payouts', driver.payoutsReady ? 'Set up with Stripe · view payouts and tax forms' : 'Set up to get paid', driver.payoutsReady ? () => call('/api/driver/payouts', {}, (r) => r.dashboardUrl && window.open(r.dashboardUrl, '_blank')) : 'payouts')}
      </ul>
      <p className="px-5 pt-5 text-sm font-semibold text-muted">App</p>
      <ul className="mt-1 divide-y divide-border border-y border-border">
        {row('App settings', 'Navigation app and job texts', 'settings')}
        {supportPhone && row('Help', `Call or text BoxHauls support at ${supportPhone}`, () => (location.href = `tel:${supportPhone.replace(/\D/g, '')}`))}
      </ul>
      <div className="space-y-3 p-5 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <button onClick={() => post('/api/auth/logout', { app: 'driver' }).finally(onSignedOut)} className="w-full rounded-md border-2 border-ink py-3 font-semibold">Sign out</button>
        <button onClick={() => setView('delete')} className="w-full py-2 text-sm font-semibold text-brand underline">Delete account</button>
        <ErrorText>{error}</ErrorText>
      </div>
    </div>
  );
}
