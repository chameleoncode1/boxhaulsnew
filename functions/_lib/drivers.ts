/**
 * BoxHauls Driver accounts: the driver record, the enrollment checklist, and account deletion.
 * Enrollment (Uber-style "required steps"): profile photo, driver's license, vehicle, registration, insurance,
 * background-check consent, payouts (Stripe), driver agreement → submit → BoxHauls reviews and approves.
 */
import type { Env } from './env';
import { HttpError } from './http';
import { displayPhone } from './auth';

export interface DriverRow {
  id: string;
  name: string;
  phone: string;
  active: number;
  app_user: number;
  application_status: string;
  first_name: string | null;
  last_name: string | null;
  preferred_name: string | null;
  email: string | null;
  email_verified_at: string | null;
  phone_verified_at: string | null;
  password_hash: string | null;
  date_of_birth: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  license_number: string | null;
  license_state: string | null;
  license_expiry: string | null;
  vehicle_year: number | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_color: string | null;
  vehicle_plate: string | null;
  vehicle_plate_state: string | null;
  vehicle_vin: string | null;
  bed_length: string | null;
  registration_expiry: string | null;
  insurance_carrier: string | null;
  insurance_policy_number: string | null;
  insurance_expiry: string | null;
  background_consent_at: string | null;
  background_status: string;
  agreement_accepted_at: string | null;
  submitted_at: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  stripe_account_id: string | null;
  payouts_ready: number;
  online: number;
  online_since: string | null;
  last_seen_at: string | null;
  nav_app: string;
  sms_opt_in: number;
  created_at: string;
}

export const DOC_KINDS = ['profile_photo', 'license_front', 'license_back', 'registration', 'insurance_card'] as const;
export type DocKind = (typeof DOC_KINDS)[number];

export async function getDriver(env: Env, id: string): Promise<DriverRow> {
  const d = await env.DB.prepare(`SELECT * FROM drivers WHERE id = ? AND app_user = 1 AND application_status != 'deleted'`).bind(id).first<DriverRow>();
  if (!d) throw new HttpError(401, 'signed_out', 'Please sign in.');
  return d;
}

type StepState = 'todo' | 'done' | 'review';
export interface Step {
  key: string;
  label: string;
  state: StepState;
}

/** The required steps and their status. A step is 'done' once its information (and photo) is in. */
export async function checklist(env: Env, d: DriverRow): Promise<Step[]> {
  const docs = await env.DB.prepare('SELECT kind, status FROM driver_documents WHERE driver_id = ?').bind(d.id).all<{ kind: DocKind; status: string }>();
  const has = (k: DocKind) => docs.results.some((x) => x.kind === k && x.status !== 'rejected');
  const s = (ok: boolean): StepState => (ok ? 'done' : 'todo');
  return [
    { key: 'personal', label: 'Personal information', state: s(Boolean(d.date_of_birth && d.address_line1 && d.city && d.postal_code)) },
    { key: 'photo', label: 'Profile photo', state: s(has('profile_photo')) },
    { key: 'license', label: "Driver's license", state: s(Boolean(d.license_number && d.license_state && d.license_expiry && has('license_front') && has('license_back'))) },
    { key: 'vehicle', label: 'Pickup truck', state: s(Boolean(d.vehicle_year && d.vehicle_make && d.vehicle_model && d.vehicle_plate)) },
    { key: 'registration', label: 'Vehicle registration', state: s(Boolean(d.registration_expiry && has('registration'))) },
    { key: 'insurance', label: 'Proof of insurance', state: s(Boolean(d.insurance_carrier && d.insurance_policy_number && d.insurance_expiry && has('insurance_card'))) },
    { key: 'background', label: 'Background check', state: d.background_consent_at ? (d.background_status === 'clear' ? 'done' : 'review') : 'todo' },
    { key: 'payouts', label: 'Payouts', state: s(Boolean(d.payouts_ready)) },
    { key: 'agreement', label: 'Driver agreement', state: s(Boolean(d.agreement_accepted_at)) },
  ];
}

/** Ready to submit: everything but the background-check result (BoxHauls reviews that). */
export const readyToSubmit = (steps: Step[]) => steps.every((x) => x.state !== 'todo');

/** May go online and accept jobs. */
export const canDrive = (d: DriverRow) => d.application_status === 'approved' && d.active === 1 && d.payouts_ready === 1;

export async function publicDriver(env: Env, d: DriverRow) {
  const steps = await checklist(env, d);
  return {
    id: d.id,
    firstName: d.first_name ?? d.name.split(/\s+/)[0],
    lastName: d.last_name ?? '',
    preferredName: d.preferred_name ?? '',
    email: d.email ?? '',
    phone: displayPhone(d.phone),
    status: d.application_status,
    rejectionReason: d.rejection_reason,
    canDrive: canDrive(d),
    online: Boolean(d.online),
    navApp: d.nav_app,
    smsOptIn: Boolean(d.sms_opt_in),
    memberSince: d.created_at,
    personal: { dateOfBirth: d.date_of_birth ?? '', address1: d.address_line1 ?? '', address2: d.address_line2 ?? '', city: d.city ?? '', state: d.state ?? 'CA', postalCode: d.postal_code ?? '' },
    emergency: { name: d.emergency_contact_name ?? '', phone: displayPhone(d.emergency_contact_phone) },
    license: { number: d.license_number ?? '', state: d.license_state ?? 'CA', expiry: d.license_expiry ?? '' },
    vehicle: { year: d.vehicle_year ?? '', make: d.vehicle_make ?? '', model: d.vehicle_model ?? '', color: d.vehicle_color ?? '', plate: d.vehicle_plate ?? '', plateState: d.vehicle_plate_state ?? 'CA', vin: d.vehicle_vin ?? '', bedLength: d.bed_length ?? '' },
    registration: { expiry: d.registration_expiry ?? '' },
    insurance: { carrier: d.insurance_carrier ?? '', policyNumber: d.insurance_policy_number ?? '', expiry: d.insurance_expiry ?? '' },
    background: { consentedAt: d.background_consent_at, status: d.background_status },
    payoutsReady: Boolean(d.payouts_ready),
    agreementAcceptedAt: d.agreement_accepted_at,
    steps,
    readyToSubmit: readyToSubmit(steps),
  };
}

const ACTIVE = `('assigned')`;

/**
 * Delete a driver account. Refused during an active trip. Personal details, documents, sign-in and sessions are
 * removed; completed trips and payout amounts stay for tax records (1099s). The Stripe payouts account is left in
 * place so the driver can still see past payouts and tax forms in Stripe.
 */
export async function deleteDriver(env: Env, d: DriverRow, reason: string | null): Promise<void> {
  const active = await env.DB.prepare(`SELECT id FROM bookings WHERE driver_id = ? AND status IN ${ACTIVE} LIMIT 1`).bind(d.id).first<{ id: string }>();
  if (active) throw new HttpError(409, 'active_trip', `You have an active trip (${active.id}). Finish or cancel it first.`);
  const now = new Date().toISOString();
  await env.DB.prepare('DELETE FROM driver_documents WHERE driver_id = ?').bind(d.id).run();
  await env.DB.prepare(
    `UPDATE drivers SET application_status = 'deleted', active = 0, online = 0, name = 'Deleted driver', phone = ?, first_name = NULL, last_name = NULL, preferred_name = NULL,
       email = NULL, email_verified_at = NULL, phone_verified_at = NULL, password_hash = NULL, date_of_birth = NULL, address_line1 = NULL, address_line2 = NULL,
       city = NULL, state = NULL, postal_code = NULL, emergency_contact_name = NULL, emergency_contact_phone = NULL, license_number = NULL, license_state = NULL,
       license_expiry = NULL, vehicle_vin = NULL, vehicle_plate = NULL, vehicle_plate_state = NULL, insurance_policy_number = NULL, last_lat = NULL, last_lng = NULL,
       signup_ip_hash = NULL, last_login_ip_hash = NULL, last_user_agent = NULL, background_consent_ip_hash = NULL, onboarding_token_hash = NULL,
       updated_at = ?, deleted_at = ? WHERE id = ?`,
  )
    .bind(`deleted:${d.id}`, now, now, d.id)
    .run();
  await env.DB.prepare(`UPDATE driver_sessions_online SET ended_at = ? WHERE driver_id = ? AND ended_at IS NULL`).bind(now, d.id).run();
  await env.DB.prepare('DELETE FROM sessions WHERE user_type = ? AND user_id = ?').bind('driver', d.id).run();
  await env.DB.prepare('INSERT INTO account_deletions (user_type, user_id, deleted_at, reason) VALUES (?, ?, ?, ?)').bind('driver', d.id, now, reason).run();
}

/** Go online/offline, keeping the hours-online log. */
export async function setOnline(env: Env, d: DriverRow, online: boolean): Promise<void> {
  const now = new Date().toISOString();
  if (online && !d.online) {
    await env.DB.prepare('UPDATE drivers SET online = 1, online_since = ?, last_seen_at = ? WHERE id = ?').bind(now, now, d.id).run();
    await env.DB.prepare('INSERT INTO driver_sessions_online (driver_id, started_at) VALUES (?, ?)').bind(d.id, now).run();
  } else if (!online && d.online) {
    await env.DB.prepare('UPDATE drivers SET online = 0, online_since = NULL WHERE id = ?').bind(d.id).run();
    await env.DB.prepare('UPDATE driver_sessions_online SET ended_at = ? WHERE driver_id = ? AND ended_at IS NULL').bind(now, d.id).run();
  }
}
