/**
 * Sign-in for both apps. Customers (boxhauls.com) and drivers (driver.boxhauls.com) have separate accounts,
 * separate session cookies, and host-only cookies, so the two apps never share a session.
 * - Passwords: PBKDF2-SHA256, 100,000 iterations (the Workers maximum), per-user salt.
 * - Sessions: random 32-byte token in an HttpOnly, Secure, SameSite=Lax cookie; only its SHA-256 is stored. 60 days, rolling.
 * - Phone codes: 6 digits, 10 minutes, 5 tries. Sent only when Twilio is configured (phoneLoginAvailable).
 * - Rate limits: 10 failed sign-ins per email or IP per 15 minutes.
 */
import type { Env } from './env';
import { HttpError } from './http';
import { sha256 } from './quote';
import { smsConfigured } from './sms';

export type UserType = 'customer' | 'driver';

const ITERATIONS = 100_000;
const SESSION_DAYS = 60;
const COOKIE: Record<UserType, string> = { customer: 'bh_session', driver: 'bhd_session' };

const b64 = (buf: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function pbkdf2(password: string, salt: Uint8Array, iterations: number): Promise<ArrayBuffer> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  return crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256);
}

export function checkPasswordRules(password: string): void {
  if (password.length < 8) throw new HttpError(422, 'weak_password', 'Use at least 8 characters for your password.');
  if (password.length > 200) throw new HttpError(422, 'weak_password', 'That password is too long.');
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `${ITERATIONS}$${b64(salt)}$${b64(await pbkdf2(password, salt, ITERATIONS))}`;
}

export async function verifyPassword(password: string, stored: string | null): Promise<boolean> {
  if (!stored) return false;
  const [it, salt, hash] = stored.split('$');
  const got = new Uint8Array(await pbkdf2(password, unb64(salt), Number(it)));
  const want = unb64(hash);
  if (got.length !== want.length) return false;
  let diff = 0;
  for (let i = 0; i < got.length; i++) diff |= got[i] ^ want[i];
  return diff === 0;
}

export function randomToken(bytes = 32): string {
  return b64(crypto.getRandomValues(new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function newId(prefix: string, length = 6): string {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  return `${prefix}-${[...crypto.getRandomValues(new Uint8Array(length))].map((b) => alphabet[b % alphabet.length]).join('')}`;
}

export const ipOf = (request: Request) => request.headers.get('CF-Connecting-IP') ?? 'unknown';
export const ipHash = async (request: Request) => (await sha256(`ip:${ipOf(request)}`)).slice(0, 32);

function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get('Cookie') ?? '';
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return v.join('=');
  }
  return null;
}

function cookieHeader(request: Request, type: UserType, value: string, maxAge: number): string {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `${COOKIE[type]}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

/** Create a session and return the Set-Cookie header value. */
export async function startSession(env: Env, request: Request, type: UserType, userId: string): Promise<string> {
  const token = randomToken();
  const now = new Date();
  const expires = new Date(now.getTime() + SESSION_DAYS * 86400_000);
  await env.DB.prepare('INSERT INTO sessions (token_hash, user_type, user_id, created_at, expires_at, ip_hash, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(await sha256(token), type, userId, now.toISOString(), expires.toISOString(), await ipHash(request), (request.headers.get('User-Agent') ?? '').slice(0, 300))
    .run();
  const table = type === 'customer' ? 'customers' : 'drivers';
  await env.DB.prepare(`UPDATE ${table} SET last_login_at = ?, last_login_ip_hash = ?, last_user_agent = ? WHERE id = ?`)
    .bind(now.toISOString(), await ipHash(request), (request.headers.get('User-Agent') ?? '').slice(0, 300), userId)
    .run();
  return cookieHeader(request, type, token, SESSION_DAYS * 86400);
}

/** The signed-in user's id, or null. Extends the session when it's past its halfway point. */
export async function sessionUser(env: Env, request: Request, type: UserType): Promise<string | null> {
  const token = readCookie(request, COOKIE[type]);
  if (!token || token.length < 30) return null;
  const tokenHash = await sha256(token);
  const row = await env.DB.prepare('SELECT user_id, expires_at FROM sessions WHERE token_hash = ? AND user_type = ?').bind(tokenHash, type).first<{ user_id: string; expires_at: string }>();
  if (!row || Date.parse(row.expires_at) < Date.now()) return null;
  if (Date.parse(row.expires_at) - Date.now() < (SESSION_DAYS / 2) * 86400_000) {
    await env.DB.prepare('UPDATE sessions SET expires_at = ? WHERE token_hash = ?').bind(new Date(Date.now() + SESSION_DAYS * 86400_000).toISOString(), tokenHash).run();
  }
  return row.user_id;
}

export async function requireUser(env: Env, request: Request, type: UserType): Promise<string> {
  const id = await sessionUser(env, request, type);
  if (!id) throw new HttpError(401, 'signed_out', 'Please sign in.');
  return id;
}

/** End this session (or every session for the user) and return a Set-Cookie header that clears the cookie. */
export async function endSession(env: Env, request: Request, type: UserType, allForUser?: string): Promise<string> {
  if (allForUser) await env.DB.prepare('DELETE FROM sessions WHERE user_type = ? AND user_id = ?').bind(type, allForUser).run();
  const token = readCookie(request, COOKIE[type]);
  if (token) await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await sha256(token)).run();
  return cookieHeader(request, type, '', 0);
}

/** JSON response with a Set-Cookie header. */
export function withCookie(res: Response, cookie: string): Response {
  const r = new Response(res.body, res);
  r.headers.append('Set-Cookie', cookie);
  return r;
}

// ───────────── Rate limiting ─────────────
const WINDOW_MS = 15 * 60_000;
const MAX_FAILURES = 10;

export async function assertNotLocked(env: Env, keys: string[]): Promise<void> {
  const since = new Date(Date.now() - WINDOW_MS).toISOString();
  for (const key of keys) {
    const r = await env.DB.prepare('SELECT COUNT(*) AS n FROM auth_failures WHERE key = ? AND at > ?').bind(key, since).first<{ n: number }>();
    if ((r?.n ?? 0) >= MAX_FAILURES) throw new HttpError(429, 'locked', 'Too many tries. Wait 15 minutes and try again.');
  }
}

export async function recordFailure(env: Env, keys: string[]): Promise<void> {
  const at = new Date().toISOString();
  for (const key of keys) await env.DB.prepare('INSERT INTO auth_failures (key, at) VALUES (?, ?)').bind(key, at).run();
}

export const failureKeys = async (request: Request, identifier: string) => [`id:${(await sha256(identifier.toLowerCase())).slice(0, 32)}`, `ip:${await ipHash(request)}`];

// ───────────── One-time codes ─────────────
export const phoneLoginAvailable = (env: Env) => smsConfigured(env);

export async function issueCode(env: Env, type: UserType, purpose: 'phone_login' | 'password_reset', target: string): Promise<string> {
  const recent = await env.DB.prepare('SELECT COUNT(*) AS n FROM auth_codes WHERE user_type = ? AND purpose = ? AND target = ? AND created_at > ?')
    .bind(type, purpose, target, new Date(Date.now() - 3600_000).toISOString())
    .first<{ n: number }>();
  if ((recent?.n ?? 0) >= 5) throw new HttpError(429, 'too_many_codes', 'Too many codes requested. Try again in an hour.');
  const code = String(100000 + (crypto.getRandomValues(new Uint32Array(1))[0] % 900000));
  const now = new Date();
  await env.DB.prepare('INSERT INTO auth_codes (id, user_type, purpose, target, code_hash, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(randomToken(12), type, purpose, target, await sha256(`${target}:${code}`), now.toISOString(), new Date(now.getTime() + 10 * 60_000).toISOString())
    .run();
  return code;
}

export async function consumeCode(env: Env, type: UserType, purpose: 'phone_login' | 'password_reset', target: string, code: string): Promise<void> {
  const row = await env.DB.prepare(
    'SELECT id, code_hash, attempts, expires_at FROM auth_codes WHERE user_type = ? AND purpose = ? AND target = ? AND used_at IS NULL ORDER BY created_at DESC LIMIT 1',
  )
    .bind(type, purpose, target)
    .first<{ id: string; code_hash: string; attempts: number; expires_at: string }>();
  const bad = new HttpError(422, 'bad_code', 'That code is wrong or has expired. Request a new one.');
  if (!row || Date.parse(row.expires_at) < Date.now() || row.attempts >= 5) throw bad;
  if (row.code_hash !== (await sha256(`${target}:${code.trim()}`))) {
    await env.DB.prepare('UPDATE auth_codes SET attempts = attempts + 1 WHERE id = ?').bind(row.id).run();
    throw bad;
  }
  await env.DB.prepare('UPDATE auth_codes SET used_at = ? WHERE id = ?').bind(new Date().toISOString(), row.id).run();
}

// ───────────── Field rules ─────────────
export function normEmail(v: unknown): string {
  const email = typeof v === 'string' ? v.trim().toLowerCase().slice(0, 200) : '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw new HttpError(422, 'bad_email', 'Enter a valid email address.');
  return email;
}

/** US phone → E.164 (+1XXXXXXXXXX). */
export function normPhone(v: unknown): string {
  const d = (typeof v === 'string' ? v : '').replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '');
  if (d.length !== 10) throw new HttpError(422, 'bad_phone', 'Enter a 10-digit US phone number.');
  return `+1${d}`;
}

export const displayPhone = (e164: string | null) => (e164 ?? '').replace(/^\+1(\d{3})(\d{3})(\d{4})$/, '($1) $2-$3');
