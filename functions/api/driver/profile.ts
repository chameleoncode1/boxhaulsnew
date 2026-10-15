/**
 * POST /api/driver/profile — save one section of the driver record.
 * Body: { section: 'personal' | 'license' | 'vehicle' | 'registration' | 'insurance' | 'emergency' | 'account' | 'settings', ...fields }.
 * License, vehicle, registration and insurance can't change while an application is under review without re-review.
 */
import type { Env } from '../../_lib/env';
import { assertSameOrigin, handle, HttpError, json, readJson, str } from '../../_lib/http';
import { checkPasswordRules, hashPassword, normEmail, normPhone, requireUser, verifyPassword } from '../../_lib/auth';
import { getDriver, publicDriver } from '../../_lib/drivers';

const date = (v: unknown, label: string) => {
  const s = str(v, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new HttpError(422, 'bad_date', `Enter ${label} as a date.`);
  return s;
};
const req = (v: unknown, max: number, label: string) => {
  const s = str(v, max);
  if (!s) throw new HttpError(422, 'missing', `Enter ${label}.`);
  return s;
};
const future = (iso: string, label: string) => {
  if (iso < new Date().toISOString().slice(0, 10)) throw new HttpError(422, 'expired', `Your ${label} has expired. Upload a current one.`);
  return iso;
};
const stateCode = (v: unknown) => {
  const s = str(v, 2).toUpperCase();
  if (!/^[A-Z]{2}$/.test(s)) throw new HttpError(422, 'bad_state', 'Use the 2-letter state code, e.g. CA.');
  return s;
};

export const onRequestPost: PagesFunction<Env> = ({ request, env }) =>
  handle(async () => {
    assertSameOrigin(request);
    const id = await requireUser(env, request, 'driver');
    const d = await getDriver(env, id);
    const b = await readJson<Record<string, unknown>>(request);
    const set: Record<string, unknown> = {};

    switch (b.section) {
      case 'personal': {
        const dob = date(b.dateOfBirth, 'your date of birth');
        const age = (Date.now() - Date.parse(`${dob}T00:00:00Z`)) / (365.25 * 86400_000);
        if (age < 18 || age > 100) throw new HttpError(422, 'bad_dob', 'Check your date of birth.');
        const zip = str(b.postalCode, 10);
        if (!/^\d{5}(-\d{4})?$/.test(zip)) throw new HttpError(422, 'bad_zip', 'Enter a 5-digit ZIP code.');
        Object.assign(set, { date_of_birth: dob, address_line1: req(b.address1, 120, 'your street address'), address_line2: str(b.address2, 60) || null, city: req(b.city, 60, 'your city'), state: stateCode(b.state), postal_code: zip, preferred_name: str(b.preferredName, 40) || null });
        break;
      }
      case 'license':
        Object.assign(set, { license_number: req(b.number, 30, 'your license number').toUpperCase(), license_state: stateCode(b.state), license_expiry: future(date(b.expiry, 'the expiration date'), "driver's license") });
        break;
      case 'vehicle': {
        const year = Number(b.year);
        if (!Number.isInteger(year) || year < 1980 || year > new Date().getFullYear() + 1) throw new HttpError(422, 'bad_year', 'Enter the truck’s model year.');
        const vin = str(b.vin, 17).toUpperCase();
        if (vin && !/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) throw new HttpError(422, 'bad_vin', 'A VIN is 17 letters and numbers.');
        Object.assign(set, { vehicle_year: year, vehicle_make: req(b.make, 30, 'the make'), vehicle_model: req(b.model, 40, 'the model'), vehicle_color: req(b.color, 20, 'the color'), vehicle_plate: req(b.plate, 10, 'the license plate').toUpperCase(), vehicle_plate_state: stateCode(b.plateState), vehicle_vin: vin || null, bed_length: str(b.bedLength, 20) || null });
        break;
      }
      case 'registration':
        set.registration_expiry = future(date(b.expiry, 'the registration expiration date'), 'registration');
        break;
      case 'insurance':
        Object.assign(set, { insurance_carrier: req(b.carrier, 60, 'your insurance company'), insurance_policy_number: req(b.policyNumber, 40, 'the policy number'), insurance_expiry: future(date(b.expiry, 'the policy expiration date'), 'insurance policy') });
        break;
      case 'emergency':
        Object.assign(set, { emergency_contact_name: req(b.name, 80, 'a contact name'), emergency_contact_phone: normPhone(b.phone) });
        break;
      case 'account': {
        if ('firstName' in b) set.first_name = req(b.firstName, 60, 'your first name');
        if ('lastName' in b) set.last_name = req(b.lastName, 60, 'your last name');
        if ('email' in b) {
          const email = normEmail(b.email);
          if (email !== d.email) {
            if (await env.DB.prepare('SELECT id FROM drivers WHERE email = ? AND id != ?').bind(email, id).first()) throw new HttpError(409, 'email_taken', 'Another driver account uses that email.');
            Object.assign(set, { email, email_verified_at: null });
          }
        }
        if ('phone' in b) {
          const phone = normPhone(b.phone);
          if (phone !== d.phone) {
            if (await env.DB.prepare('SELECT id FROM drivers WHERE phone = ? AND id != ?').bind(phone, id).first()) throw new HttpError(409, 'phone_taken', 'Another driver account uses that number.');
            Object.assign(set, { phone, phone_verified_at: null });
          }
        }
        if ('newPassword' in b) {
          const next = str(b.newPassword, 200);
          checkPasswordRules(next);
          if (!(await verifyPassword(str(b.currentPassword, 200), d.password_hash))) throw new HttpError(401, 'bad_password', 'Your current password is wrong.');
          set.password_hash = await hashPassword(next);
        }
        if (set.first_name || set.last_name) set.name = `${set.first_name ?? d.first_name} ${set.last_name ?? d.last_name}`;
        break;
      }
      case 'settings':
        if ('navApp' in b) set.nav_app = ['google', 'apple', 'waze'].includes(b.navApp as string) ? b.navApp : 'google';
        if ('smsOptIn' in b) set.sms_opt_in = b.smsOptIn === true ? 1 : 0;
        break;
      default:
        throw new HttpError(400, 'bad_section', 'Unknown section.');
    }

    // Changing license, truck, registration or insurance after approval sends the account back for review.
    if (['license', 'vehicle', 'registration', 'insurance'].includes(String(b.section)) && d.application_status === 'approved') {
      Object.assign(set, { application_status: 'submitted', approved_at: null, online: 0 });
    }
    set.updated_at = new Date().toISOString();
    const cols = Object.keys(set);
    await env.DB.prepare(`UPDATE drivers SET ${cols.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`).bind(...cols.map((k) => set[k]), id).run();
    return json({ ok: true, driver: await publicDriver(env, await getDriver(env, id)) });
  });
