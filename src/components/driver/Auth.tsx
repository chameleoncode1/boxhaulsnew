/** BoxHauls Driver: welcome, sign in (email + password, or phone code once Twilio is live), sign up, password reset. */
import { useEffect, useState } from 'react';
import { post } from './api';
import { ErrorText, Field, Logo, Screen, inputCls, primaryBtn } from './ui';

type Mode = 'welcome' | 'signin' | 'signup' | 'phone' | 'forgot';

export default function Auth({ onIn }: { onIn: () => void }) {
  const [mode, setMode] = useState<Mode>('welcome');
  const [opts, setOpts] = useState({ phone: false, passwordReset: false });
  const [v, setV] = useState({ firstName: '', lastName: '', email: '', phone: '', password: '', city: 'Fresno', code: '', terms: false });
  const [codeSent, setCodeSent] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    post<{ phone: boolean; passwordReset: boolean }>('/api/auth/options').then(setOpts).catch(() => undefined);
  }, []);

  const bind = (k: keyof typeof v) => ({ value: v[k] as string, onChange: (e: { target: { value: string } }) => setV((s) => ({ ...s, [k]: e.target.value })) });
  const go = (m: Mode) => {
    setMode(m);
    setError('');
    setCodeSent(false);
  };
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

  if (mode === 'welcome') {
    return (
      <div className="relative flex h-full flex-col overflow-hidden bg-night px-6 pt-[max(2rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <div className="pointer-events-none absolute -top-10 -right-24 h-80 w-80 rotate-12 bg-brand opacity-90" style={{ clipPath: 'polygon(30% 0, 100% 0, 70% 100%, 0 100%)' }} aria-hidden="true" />
        <Logo className="relative h-10 w-auto self-start" />
        <p className="display relative mt-2 text-sm tracking-[0.2em] text-brand-on-night">Driver</p>
        <div className="relative mt-auto">
          <h1 className="text-5xl leading-[0.95]">Got a truck?<br /><span className="text-brand-on-night">Get paid to drive it.</span></h1>
          <p className="mt-4 max-w-sm text-night-muted">Haul furniture, appliances and junk around Fresno and Clovis. Go online when you want, pick the jobs you want.</p>
          <div className="mt-8 space-y-3">
            <button onClick={() => go('signup')} className={primaryBtn}>Get started</button>
            <button onClick={() => go('signin')} className="display w-full rounded-md border-2 border-inverse px-6 py-4 text-lg text-inverse">Sign in</button>
            <button type="button" data-install-app className="mt-1 flex w-full items-center justify-center gap-2 py-2 text-sm font-semibold text-night-muted underline">
              <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6"><path d="M12 3v12m0 0l-5-5m5 5l5-5M5 21h14" /></svg>
              Install the BoxHauls Driver app
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (mode === 'signup') {
    return (
      <Screen
        title="Create your driver account"
        onBack={() => go('welcome')}
        footer={<button form="signup" className={primaryBtn} disabled={busy}>{busy ? 'Creating account…' : 'Continue'}</button>}
      >
        <form
          id="signup"
          className="space-y-4"
          onSubmit={(e) => run(e, async () => { await post('/api/driver/signup', { ...v, acceptTerms: v.terms }); onIn(); })}
        >
          <p className="text-sm text-muted">Use your name exactly as it appears on your driver's license.</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="First name"><input autoComplete="given-name" required className={inputCls} {...bind('firstName')} /></Field>
            <Field label="Last name"><input autoComplete="family-name" required className={inputCls} {...bind('lastName')} /></Field>
          </div>
          <Field label="Email"><input type="email" autoComplete="email" required className={inputCls} {...bind('email')} /></Field>
          <Field label="Mobile number" hint="Job alerts and customer calls use this number."><input type="tel" autoComplete="tel" required className={inputCls} placeholder="(559) 555-0123" {...bind('phone')} /></Field>
          <Field label="Password" hint="At least 8 characters."><input type="password" autoComplete="new-password" minLength={8} required className={inputCls} {...bind('password')} /></Field>
          <Field label="City you'll drive in">
            <select className={inputCls} {...bind('city')}>
              <option>Fresno</option>
              <option>Clovis</option>
            </select>
          </Field>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" required checked={v.terms} onChange={(e) => setV((s) => ({ ...s, terms: e.target.checked }))} className="mt-1 h-4 w-4 accent-[var(--color-brand)]" />
            <span>I agree to the <a href="https://boxhauls.com/legal/terms/" target="_blank" rel="noopener">Terms</a> and <a href="https://boxhauls.com/legal/privacy/" target="_blank" rel="noopener">Privacy Policy</a>, and to get texts about jobs and my account.</span>
          </label>
          <ErrorText>{error}</ErrorText>
        </form>
      </Screen>
    );
  }

  if (mode === 'phone') {
    return (
      <Screen title="Sign in with your phone" onBack={() => go('signin')} footer={<button form="phone" className={primaryBtn} disabled={busy}>{codeSent ? 'Sign in' : 'Text me a code'}</button>}>
        <form
          id="phone"
          className="space-y-4"
          onSubmit={(e) =>
            run(e, async () => {
              if (!codeSent) {
                await post('/api/auth/phone-start', { app: 'driver', phone: v.phone });
                setCodeSent(true);
                return;
              }
              await post('/api/auth/phone-verify', { app: 'driver', phone: v.phone, code: v.code });
              onIn();
            })
          }
        >
          <Field label="Mobile number"><input type="tel" autoComplete="tel" required disabled={codeSent} className={inputCls} {...bind('phone')} /></Field>
          {codeSent && <Field label="6-digit code"><input inputMode="numeric" autoComplete="one-time-code" required className={inputCls} {...bind('code')} /></Field>}
          <ErrorText>{error}</ErrorText>
        </form>
      </Screen>
    );
  }

  if (mode === 'forgot') {
    return (
      <Screen title="Reset your password" onBack={() => go('signin')} footer={<button form="forgot" className={primaryBtn} disabled={busy}>{codeSent ? 'Set new password' : 'Send code'}</button>}>
        <form
          id="forgot"
          className="space-y-4"
          onSubmit={(e) =>
            run(e, async () => {
              if (!codeSent) {
                await post('/api/auth/forgot', { app: 'driver', email: v.email });
                setCodeSent(true);
                return;
              }
              await post('/api/auth/reset', { app: 'driver', email: v.email, code: v.code, password: v.password });
              onIn();
            })
          }
        >
          <p className="text-sm text-muted">{codeSent ? 'If that email has a driver account, we sent a code to its phone or email.' : 'We’ll send a code to the phone or email on your account.'}</p>
          <Field label="Email"><input type="email" required disabled={codeSent} className={inputCls} {...bind('email')} /></Field>
          {codeSent && (
            <>
              <Field label="Code"><input inputMode="numeric" autoComplete="one-time-code" required className={inputCls} {...bind('code')} /></Field>
              <Field label="New password"><input type="password" autoComplete="new-password" minLength={8} required className={inputCls} {...bind('password')} /></Field>
            </>
          )}
          <ErrorText>{error}</ErrorText>
        </form>
      </Screen>
    );
  }

  return (
    <Screen title="Sign in" onBack={() => go('welcome')} footer={<button form="signin" className={primaryBtn} disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>}>
      <form id="signin" className="space-y-4" onSubmit={(e) => run(e, async () => { await post('/api/auth/login', { app: 'driver', email: v.email, password: v.password }); onIn(); })}>
        <Field label="Email"><input type="email" autoComplete="email" required className={inputCls} {...bind('email')} /></Field>
        <Field label="Password"><input type="password" autoComplete="current-password" required className={inputCls} {...bind('password')} /></Field>
        <div className="flex flex-wrap justify-between gap-2 text-sm font-semibold">
          {opts.passwordReset && <button type="button" className="underline" onClick={() => go('forgot')}>Forgot password?</button>}
          {opts.phone && <button type="button" className="underline" onClick={() => go('phone')}>Use your phone number</button>}
        </div>
        <ErrorText>{error}</ErrorText>
        <p className="pt-4 text-sm text-muted">New to BoxHauls? <button type="button" className="font-semibold text-ink underline" onClick={() => go('signup')}>Create a driver account</button></p>
      </form>
    </Screen>
  );
}
