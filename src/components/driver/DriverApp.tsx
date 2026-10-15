/**
 * BoxHauls Driver (React root). Signed out → welcome / sign in / sign up. Applying or in review → enrollment
 * checklist. Approved → Home (map, GO, offers, trips), Earnings and Account tabs, like the Uber driver app.
 * ?install=1 (from boxhauls.com's "Got a truck?" button) opens the install prompt first.
 * ?payouts=done|retry (back from Stripe) refreshes payout status.
 */
import { useEffect, useState } from 'react';
import { post, type Driver } from './api';
import Auth from './Auth';
import Enrollment, { StepForm } from './Enrollment';
import Home from './Home';
import Earnings from './Earnings';
import Account from './Account';
import { phone as phoneFact } from '../../lib/site';

type Tab = 'home' | 'earnings' | 'account';

function InstallPrompt({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-40 flex items-end bg-[color-mix(in_srgb,var(--color-night)_80%,transparent)] sm:items-center sm:justify-center" role="dialog" aria-modal="true" aria-label="Install BoxHauls Driver">
      <div className="w-full rounded-t-2xl bg-bg p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-ink sm:max-w-sm sm:rounded-2xl">
        <div className="flex items-center gap-4">
          <img src="/brand/driver-icon-192.png" alt="" width={64} height={64} className="h-16 w-16 rounded-2xl bg-night" />
          <div>
            <p className="text-xl font-bold">BoxHauls Driver</p>
            <p className="text-sm text-muted">Get paid to haul with your pickup.</p>
          </div>
        </div>
        <button type="button" data-install-app className="display mt-6 flex w-full items-center justify-center gap-2 rounded-md bg-brand py-4 text-lg text-inverse">
          <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6"><path d="M12 3v12m0 0l-5-5m5 5l5-5M5 21h14" /></svg>
          Install the app
        </button>
        <button onClick={onClose} className="mt-3 w-full py-2 text-sm font-semibold text-muted underline">Continue in the browser</button>
      </div>
    </div>
  );
}

export default function DriverApp() {
  const [state, setState] = useState<{ loading: boolean; driver: Driver | null }>({ loading: true, driver: null });
  const [tab, setTab] = useState<Tab>('home');
  const [enrollAccount, setEnrollAccount] = useState(false);
  const [payoutsOpen, setPayoutsOpen] = useState(false);
  const [install, setInstall] = useState(false);

  async function load() {
    const r = await post<{ signedIn: boolean; driver?: Driver }>('/api/driver/me').catch(() => ({ signedIn: false }) as { signedIn: boolean; driver?: Driver });
    setState({ loading: false, driver: r.signedIn ? r.driver ?? null : null });
    return r.driver ?? null;
  }

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const standalone = matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
    if (params.has('install') && !standalone) setInstall(true);
    load().then((d) => {
      if (d && params.has('payouts')) post<{ driver: Driver }>('/api/driver/payouts').then((r) => setState({ loading: false, driver: r.driver })).catch(() => undefined);
    });
    if (params.has('install') || params.has('payouts')) history.replaceState(null, '', location.pathname);
  }, []);

  const setDriver = (driver: Driver) => setState({ loading: false, driver });
  const signedOut = () => {
    setState({ loading: false, driver: null });
    setTab('home');
    setEnrollAccount(false);
  };

  let screen;
  if (state.loading) {
    screen = (
      <div className="flex h-full items-center justify-center bg-night">
        <img src="/brand/wordmark-on-dark.png" alt="BoxHauls" width={183} height={44} className="h-10 w-auto animate-pulse" />
      </div>
    );
  } else if (!state.driver) {
    screen = <Auth onIn={load} />;
  } else if (['applying', 'submitted', 'rejected'].includes(state.driver.status)) {
    screen = enrollAccount ? (
      <div className="flex h-full flex-col">
        <button onClick={() => setEnrollAccount(false)} className="bg-night px-5 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2 text-left text-sm font-semibold text-inverse">‹ Back to steps</button>
        <div className="min-h-0 flex-1"><Account driver={state.driver} onChange={setDriver} onSignedOut={signedOut} supportPhone={phoneFact.value ?? ''} /></div>
      </div>
    ) : (
      <Enrollment driver={state.driver} onChange={setDriver} onAccount={() => setEnrollAccount(true)} />
    );
  } else if (payoutsOpen) {
    screen = <StepForm step="payouts" driver={state.driver} onSaved={(d) => { setDriver(d); setPayoutsOpen(false); }} onBack={() => setPayoutsOpen(false)} />;
  } else {
    const d = state.driver;
    screen = (
      <div className="flex h-full flex-col">
        <div className="min-h-0 flex-1">
          {tab === 'home' && <Home driver={d} onOpenAccount={() => setTab('account')} onSetupPayouts={() => setPayoutsOpen(true)} />}
          {tab === 'earnings' && <Earnings />}
          {tab === 'account' && <Account driver={d} onChange={setDriver} onSignedOut={signedOut} supportPhone={phoneFact.value ?? ''} />}
        </div>
        <nav className="grid grid-cols-3 border-t border-night-border bg-night pb-[env(safe-area-inset-bottom)] text-xs font-semibold" aria-label="Driver app">
          {(
            [
              ['home', 'Home', 'M3 11l9-7 9 7v9a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1z'],
              ['earnings', 'Earnings', 'M4 20V10m6 10V4m6 16v-7m4 7H2'],
              ['account', 'Account', 'M12 12a4 4 0 100-8 4 4 0 000 8zm-8 9a8 8 0 0116 0'],
            ] as const
          ).map(([key, label, icon]) => (
            <button key={key} onClick={() => setTab(key)} aria-current={tab === key ? 'page' : undefined} className={`flex flex-col items-center gap-1 py-2.5 ${tab === key ? 'text-inverse' : 'text-night-muted'}`}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true"><path d={icon} /></svg>
              {label}
              <span className={`h-0.5 w-6 rounded-full ${tab === key ? 'bg-brand' : 'bg-transparent'}`} />
            </button>
          ))}
        </nav>
      </div>
    );
  }

  return (
    <div className="h-full">
      {screen}
      {install && <InstallPrompt onClose={() => setInstall(false)} />}
    </div>
  );
}
