/**
 * BoxHauls Driver enrollment, in the style of Uber's "required steps": a checklist, a screen per step, then submit
 * for review. StepForm is reused from Account to update documents later.
 */
import { useState, type ReactNode } from 'react';
import { post, resizeImage, type Driver } from './api';
import { Chevron, ErrorText, Field, Screen, inputCls, primaryBtn } from './ui';
import placeholders from '../../../docs/placeholders.json';

const APPROVAL_TIME = String(placeholders.APPROVAL_TIME);
const APPROVAL_FINE_PRINT = String(placeholders.APPROVAL_FINE_PRINT);

const US_STATES = 'AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY DC'.split(' ');

function StateSelect(props: { value: string; onChange: (e: { target: { value: string } }) => void }) {
  return (
    <select className={inputCls} {...props}>
      {US_STATES.map((s) => <option key={s}>{s}</option>)}
    </select>
  );
}

function DocUpload({ kind, label, hint, capture = 'environment', version }: { kind: string; label: string; hint: string; capture?: 'user' | 'environment'; version: number }) {
  const [status, setStatus] = useState<'idle' | 'uploading' | 'done' | 'error'>('idle');
  const [error, setError] = useState('');
  const [bust, setBust] = useState(version);
  const [missing, setMissing] = useState(false);

  async function pick(file: File | undefined) {
    if (!file) return;
    setStatus('uploading');
    setError('');
    try {
      const dataUrl = await resizeImage(file);
      await post('/api/driver/document', { kind, dataUrl });
      setStatus('done');
      setMissing(false);
      setBust(Date.now());
    } catch (e) {
      setStatus('error');
      setError((e as Error).message);
    }
  }

  return (
    <div className="rounded-md border-2 border-dashed border-border p-4">
      <p className="font-semibold">{label}</p>
      <p className="text-sm text-muted">{hint}</p>
      <div className="mt-3 flex items-center gap-4">
        {!missing && (
          <img
            src={`/api/driver/document?kind=${kind}&v=${bust}`}
            alt=""
            className="h-20 w-28 rounded-sm bg-surface object-cover"
            onError={() => setMissing(true)}
            onLoad={() => setMissing(false)}
          />
        )}
        <label className="display cursor-pointer rounded-md bg-ink px-4 py-3 text-sm text-inverse">
          {status === 'uploading' ? 'Uploading…' : missing ? 'Take photo' : 'Replace photo'}
          <input type="file" accept="image/*" capture={capture} className="sr-only" onChange={(e) => pick(e.target.files?.[0])} />
        </label>
      </div>
      {status === 'done' && <p className="mt-2 text-sm font-semibold">Uploaded.</p>}
      <ErrorText>{error}</ErrorText>
    </div>
  );
}

type Section = 'personal' | 'photo' | 'license' | 'vehicle' | 'registration' | 'insurance' | 'background' | 'payouts' | 'agreement' | 'emergency';

/** One step's screen. Calls onSaved with the updated driver. */
export function StepForm({ step, driver, onSaved, onBack }: { step: Section; driver: Driver; onSaved: (d: Driver) => void; onBack: () => void }) {
  const [v, setV] = useState<Record<string, string>>(() => {
    const d = driver;
    const map: Record<string, Record<string, string | number>> = {
      personal: { ...d.personal, preferredName: d.preferredName },
      license: d.license,
      vehicle: { ...d.vehicle, year: String(d.vehicle.year ?? '') },
      registration: d.registration,
      insurance: d.insurance,
      emergency: d.emergency,
    };
    return Object.fromEntries(Object.entries(map[step] ?? {}).map(([k, x]) => [k, String(x ?? '')]));
  });
  const [signature, setSignature] = useState('');
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const bind = (k: string) => ({ value: v[k] ?? '', onChange: (e: { target: { value: string } }) => setV((s) => ({ ...s, [k]: e.target.value })) });

  async function save(e: { preventDefault(): void }) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      let r: { driver: Driver; url?: string; ready?: boolean };
      if (step === 'background') r = await post('/api/driver/consent', { signature });
      else if (step === 'agreement') r = await post('/api/driver/agreement', { accept: agree });
      else if (step === 'payouts') {
        r = await post('/api/driver/payouts');
        if (!r.ready && r.url) {
          location.href = r.url;
          return;
        }
      } else if (step === 'photo') {
        r = await post('/api/driver/me');
      } else r = await post('/api/driver/profile', { section: step, ...v });
      onSaved(r.driver);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const titles: Record<Section, string> = {
    personal: 'Personal information',
    photo: 'Profile photo',
    license: "Driver's license",
    vehicle: 'Your pickup truck',
    registration: 'Vehicle registration',
    insurance: 'Proof of insurance',
    background: 'Background check',
    payouts: 'Payouts',
    agreement: 'Driver agreement',
    emergency: 'Emergency contact',
  };
  const cta: Partial<Record<Section, string>> = { background: 'Sign and authorize', agreement: 'Accept agreement', payouts: driver.payoutsReady ? 'Refresh status' : 'Set up payouts with Stripe', photo: 'Done' };
  let body: ReactNode = null;

  switch (step) {
    case 'personal':
      body = (
        <>
          <Field label="Date of birth"><input type="date" required className={inputCls} {...bind('dateOfBirth')} /></Field>
          <Field label="Preferred first name" hint="Optional. What customers see, e.g. Mike instead of Michael."><input className={inputCls} {...bind('preferredName')} /></Field>
          <Field label="Home street address"><input autoComplete="address-line1" required className={inputCls} {...bind('address1')} /></Field>
          <Field label="Apt, suite (optional)"><input autoComplete="address-line2" className={inputCls} {...bind('address2')} /></Field>
          <div className="grid grid-cols-[1fr_5rem] gap-3">
            <Field label="City"><input autoComplete="address-level2" required className={inputCls} {...bind('city')} /></Field>
            <Field label="State"><StateSelect {...bind('state')} /></Field>
          </div>
          <Field label="ZIP code"><input inputMode="numeric" autoComplete="postal-code" required className={inputCls} {...bind('postalCode')} /></Field>
        </>
      );
      break;
    case 'photo':
      body = (
        <>
          <p className="text-sm text-muted">Customers see this photo so they know who's coming. Face the camera, no sunglasses or hats, good light.</p>
          <DocUpload kind="profile_photo" label="Your photo" hint="A clear photo of your face." capture="user" version={1} />
        </>
      );
      break;
    case 'license':
      body = (
        <>
          <Field label="License number"><input required autoCapitalize="characters" className={inputCls} {...bind('number')} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="State"><StateSelect {...bind('state')} /></Field>
            <Field label="Expires"><input type="date" required className={inputCls} {...bind('expiry')} /></Field>
          </div>
          <DocUpload kind="license_front" label="Front of license" hint="All four corners visible, no glare." version={1} />
          <DocUpload kind="license_back" label="Back of license" hint="All four corners visible." version={1} />
        </>
      );
      break;
    case 'vehicle':
      body = (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Year"><input inputMode="numeric" required className={inputCls} {...bind('year')} /></Field>
            <Field label="Color"><input required className={inputCls} {...bind('color')} /></Field>
          </div>
          <Field label="Make"><input required placeholder="Ford, Chevrolet, Toyota…" className={inputCls} {...bind('make')} /></Field>
          <Field label="Model"><input required placeholder="F-150, Silverado, Tacoma…" className={inputCls} {...bind('model')} /></Field>
          <div className="grid grid-cols-[1fr_5rem] gap-3">
            <Field label="License plate"><input required autoCapitalize="characters" className={inputCls} {...bind('plate')} /></Field>
            <Field label="State"><StateSelect {...bind('plateState')} /></Field>
          </div>
          <Field label="Bed length">
            <select className={inputCls} {...bind('bedLength')}>
              <option value="">Choose</option>
              <option>5.5 ft (short bed)</option>
              <option>6.5 ft (standard bed)</option>
              <option>8 ft (long bed)</option>
              <option>Other</option>
            </select>
          </Field>
          <Field label="VIN (optional)" hint="17 characters, on your registration or the driver-side dashboard."><input autoCapitalize="characters" className={inputCls} {...bind('vin')} /></Field>
        </>
      );
      break;
    case 'registration':
      body = (
        <>
          <Field label="Registration expires"><input type="date" required className={inputCls} {...bind('expiry')} /></Field>
          <DocUpload kind="registration" label="Registration card" hint="Current, with your plate and VIN visible." version={1} />
        </>
      );
      break;
    case 'insurance':
      body = (
        <>
          <Field label="Insurance company"><input required className={inputCls} {...bind('carrier')} /></Field>
          <Field label="Policy number"><input required className={inputCls} {...bind('policyNumber')} /></Field>
          <Field label="Policy expires"><input type="date" required className={inputCls} {...bind('expiry')} /></Field>
          <DocUpload kind="insurance_card" label="Insurance card" hint="Your name and this truck must be on the card." version={1} />
        </>
      );
      break;
    case 'emergency':
      body = (
        <>
          <Field label="Contact name"><input required className={inputCls} {...bind('name')} /></Field>
          <Field label="Contact phone"><input type="tel" required className={inputCls} {...bind('phone')} /></Field>
        </>
      );
      break;
    case 'background':
      body = (
        <>
          {driver.background.consentedAt ? (
            <p className="rounded-md bg-surface p-4 text-sm">You authorized the background check on {new Date(driver.background.consentedAt).toLocaleDateString()}. Status: <strong>{driver.background.status.replace('_', ' ')}</strong>.</p>
          ) : (
            <>
              <div className="max-h-64 overflow-y-auto rounded-md border border-border p-4 text-sm">
                <p className="font-semibold">Disclosure and authorization</p>
                <p className="mt-2">BoxHauls will get a consumer report about you, including a criminal history check and your driving record, from a background-check company, to decide whether you can drive with BoxHauls. The company will ask for your Social Security number directly; BoxHauls never sees or stores it.</p>
                <p className="mt-2"><span className="todo">[TODO: standalone FCRA disclosure and California ICRAA/CCRAA notices, reviewed by California counsel, plus the provider's name and contact details]</span></p>
              </div>
              <Field label={`Type your full legal name to sign (${driver.firstName} ${driver.lastName})`}><input required className={inputCls} value={signature} onChange={(e) => setSignature(e.target.value)} /></Field>
            </>
          )}
        </>
      );
      break;
    case 'payouts':
      body = (
        <div className="space-y-3 text-sm">
          <p>BoxHauls pays you through <strong>Stripe</strong>. Stripe collects your bank account, Social Security number (for tax forms) and ID check. BoxHauls never sees those numbers.</p>
          <p className={`rounded-md p-4 font-semibold ${driver.payoutsReady ? 'bg-surface' : 'border-2 border-brand'}`}>{driver.payoutsReady ? 'Payouts are set up. You’re ready to get paid.' : 'Not set up yet. It takes about 5 minutes.'}</p>
        </div>
      );
      break;
    case 'agreement':
      body = (
        <div className="space-y-4 text-sm">
          <p>As a BoxHauls driver you're an independent contractor. You choose when you drive and which jobs you take, use your own truck, and keep your share of each fare plus 100% of tips.</p>
          <p>Read the full <a href="https://boxhauls.com/legal/driver-agreement/" target="_blank" rel="noopener" className="font-semibold">BoxHauls driver agreement</a>.</p>
          {driver.agreementAcceptedAt ? (
            <p className="rounded-md bg-surface p-4 font-semibold">Accepted on {new Date(driver.agreementAcceptedAt).toLocaleDateString()}.</p>
          ) : (
            <label className="flex items-start gap-2"><input type="checkbox" required checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-1 h-4 w-4 accent-[var(--color-brand)]" /> <span>I've read and accept the BoxHauls driver agreement.</span></label>
          )}
        </div>
      );
      break;
  }

  const done = (step === 'background' && driver.background.consentedAt) || (step === 'agreement' && driver.agreementAcceptedAt);
  return (
    <Screen
      title={titles[step]}
      onBack={onBack}
      footer={done ? <button onClick={onBack} className={primaryBtn}>Back</button> : <button form="step" className={primaryBtn} disabled={busy}>{busy ? 'Saving…' : cta[step] ?? 'Save'}</button>}
    >
      <form id="step" onSubmit={save} className="space-y-4">
        {body}
        <ErrorText>{error}</ErrorText>
      </form>
    </Screen>
  );
}

const STEP_KEY: Record<string, Section> = { personal: 'personal', photo: 'photo', license: 'license', vehicle: 'vehicle', registration: 'registration', insurance: 'insurance', background: 'background', payouts: 'payouts', agreement: 'agreement' };

export default function Enrollment({ driver, onChange, onAccount }: { driver: Driver; onChange: (d: Driver) => void; onAccount: () => void }) {
  const [open, setOpen] = useState<Section | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  if (open) return <StepForm step={open} driver={driver} onSaved={(d) => { onChange(d); setOpen(null); }} onBack={() => setOpen(null)} />;

  const done = driver.steps.filter((s) => s.state !== 'todo').length;
  const submitted = driver.status === 'submitted';

  async function submit() {
    setBusy(true);
    setError('');
    try {
      const r = await post<{ driver: Driver }>('/api/driver/submit');
      onChange(r.driver);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-full flex-col bg-bg text-ink">
      <header className="bg-night px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-6 text-inverse">
        <div className="flex items-center justify-between">
          <img src="/brand/wordmark-on-dark.png" alt="BoxHauls" width={150} height={36} className="h-8 w-auto" />
          <button onClick={onAccount} aria-label="Account" className="display flex h-10 w-10 items-center justify-center rounded-full bg-brand text-inverse">{driver.firstName.slice(0, 1)}</button>
        </div>
        <h1 className="mt-6 text-3xl">{submitted ? 'Application in review' : `Welcome, ${driver.firstName}`}</h1>
        <p className="mt-1 text-night-muted">
          {submitted ? `We're reviewing your documents and background check. Approval typically takes ${APPROVAL_TIME}. We'll text you when you're approved.` : driver.status === 'rejected' ? `Your application needs changes: ${driver.rejectionReason ?? 'see below'}.` : 'Here’s what you need to do to start driving.'}
        </p>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-night-border" aria-label={`${done} of ${driver.steps.length} steps done`}>
          <div className="h-full bg-brand transition-all" style={{ width: `${(done / driver.steps.length) * 100}%` }} />
        </div>
        <p className="mt-1.5 text-xs text-night-muted">{done} of {driver.steps.length} steps</p>
        {submitted && <p className="mt-3 text-[0.7rem] leading-snug text-night-muted">{APPROVAL_FINE_PRINT}</p>}
      </header>
      <div className="flex-1 overflow-y-auto">
        <p className="px-5 pt-5 text-sm font-semibold text-muted">Required steps</p>
        <ul className="mt-2 divide-y divide-border border-y border-border">
          {driver.steps.map((s) => (
            <li key={s.key}>
              <button onClick={() => setOpen(STEP_KEY[s.key])} className="flex w-full items-center gap-4 px-5 py-4 text-left hover:bg-surface">
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${s.state === 'done' ? 'bg-ink text-inverse' : s.state === 'review' ? 'bg-surface-strong' : 'border-2 border-border-strong'}`}>
                  {s.state === 'done' && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>}
                  {s.state === 'review' && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><circle cx="12" cy="12" r="8" /><path d="M12 8v4l2.5 2" /></svg>}
                </span>
                <span className="flex-1">
                  <span className="block font-semibold">{s.label}</span>
                  <span className="block text-sm text-muted">{s.state === 'done' ? 'Done' : s.state === 'review' ? 'In review' : 'Get started'}</span>
                </span>
                <Chevron />
              </button>
            </li>
          ))}
        </ul>
        <div className="p-5">
          <button onClick={() => setOpen('emergency')} className="flex w-full items-center justify-between rounded-md bg-surface px-4 py-3 text-left text-sm font-semibold">Emergency contact (recommended) <Chevron /></button>
        </div>
      </div>
      {!submitted && (
        <div className="border-t border-border px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button onClick={submit} disabled={!driver.readyToSubmit || busy} className={primaryBtn}>{busy ? 'Submitting…' : driver.readyToSubmit ? 'Submit application' : 'Finish the steps to submit'}</button>
          <ErrorText>{error}</ErrorText>
        </div>
      )}
    </div>
  );
}
