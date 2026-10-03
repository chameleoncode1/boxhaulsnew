/**
 * Signed quotes. /api/quote returns the price with an HMAC signature; /api/book only accepts a quote it
 * signed, unexpired and unmodified, so the booked price is always the server's price.
 */
import { HttpError } from './http';

export interface Place {
  placeId: string;
  address: string;
  lat: number;
  lng: number;
}

export interface QuotePayload {
  pickup: Place;
  dropoff: Place;
  miles: number;
  item: string;
  tier: string;
  helper: boolean;
  heavy: boolean;
  totalCents: number;
  /** Expiry, ms since epoch. */
  exp: number;
}

export const QUOTE_TTL_MS = 30 * 60 * 1000;

const enc = new TextEncoder();
const b64url = (bytes: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64url = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

async function key(secret: string) {
  return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

export async function signQuote(payload: QuotePayload, secret: string): Promise<string> {
  const body = b64url(enc.encode(JSON.stringify(payload)));
  const sig = await crypto.subtle.sign('HMAC', await key(secret), enc.encode(body));
  return `${body}.${b64url(sig)}`;
}

export async function verifyQuote(token: string, secret: string): Promise<QuotePayload> {
  const [body, sig] = token.split('.');
  if (!body || !sig) throw new HttpError(400, 'bad_quote', 'Please get a new price and try again.');
  const ok = await crypto.subtle.verify('HMAC', await key(secret), fromB64url(sig), enc.encode(body));
  if (!ok) throw new HttpError(400, 'bad_quote', 'Please get a new price and try again.');
  const payload = JSON.parse(new TextDecoder().decode(fromB64url(body))) as QuotePayload;
  if (Date.now() > payload.exp) throw new HttpError(410, 'quote_expired', 'Your price expired. Please get a new price.');
  return payload;
}

/** Salted SHA-256 of a value (used for client IPs so raw IPs are never stored). */
export async function hash(value: string, salt: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(`${salt}:${value}`));
  return b64url(digest).slice(0, 32);
}
