/** Which account table an app uses, and lookups shared by the sign-in endpoints. */
import type { Env } from './env';
import { HttpError } from './http';
import type { UserType } from './auth';

export function appOf(v: unknown): UserType {
  if (v === 'customer' || v === 'driver') return v;
  throw new HttpError(400, 'bad_app', 'Unknown app.');
}

export const tableOf = (type: UserType) => (type === 'customer' ? 'customers' : 'drivers');

/** Accounts that can sign in: active customers; drivers who signed up in the app and aren't deleted. */
const live = (type: UserType) => (type === 'customer' ? `status = 'active'` : `app_user = 1 AND application_status NOT IN ('deleted')`);

export async function findByEmail(env: Env, type: UserType, email: string) {
  return env.DB.prepare(`SELECT id, password_hash, phone FROM ${tableOf(type)} WHERE email = ? AND ${live(type)}`).bind(email).first<{ id: string; password_hash: string | null; phone: string | null }>();
}

export async function findByPhone(env: Env, type: UserType, phone: string) {
  return env.DB.prepare(`SELECT id, email FROM ${tableOf(type)} WHERE phone = ? AND ${live(type)}`).bind(phone).first<{ id: string; email: string | null }>();
}
