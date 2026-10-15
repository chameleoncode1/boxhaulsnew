/**
 * Minimal Stripe REST client for Workers (fetch + form encoding), webhook signature verification, and the
 * money rules: authorize at request, capture on completion or cancellation fee, transfer the driver's share.
 * Every money-moving call sends an Idempotency-Key so a retried request can't charge or pay twice.
 */
import type { Env } from './env';
import { HttpError } from './http';

interface Params {
  [key: string]: string | number | boolean | undefined | string[] | Params;
}

/** Stripe's form encoding: nested objects → a[b]=c, arrays → a[]=x. */
function encode(params: Params, prefix = ''): string[] {
  return Object.entries(params).flatMap(([k, v]) => {
    if (v === undefined) return [];
    const key = prefix ? `${prefix}[${k}]` : k;
    if (Array.isArray(v)) return v.map((x) => `${encodeURIComponent(`${key}[]`)}=${encodeURIComponent(x)}`);
    if (typeof v === 'object') return encode(v, key);
    return [`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`];
  });
}

/** A Stripe API error, with Stripe's error object (e.g. code 'authentication_required' and its payment_intent). */
export class StripeError extends HttpError {
  constructor(
    message: string,
    public stripeError: { message?: string; code?: string; decline_code?: string; payment_intent?: { id: string; client_secret: string; status: string } },
  ) {
    super(402, 'payment_error', message);
  }
}

export function stripeConfigured(env: Env): boolean {
  return Boolean(env.STRIPE_SECRET_KEY && env.STRIPE_PUBLISHABLE_KEY);
}

export async function stripe<T = Record<string, unknown>>(
  env: Env,
  method: 'GET' | 'POST' | 'DELETE',
  path: string,
  params: Params = {},
  idempotencyKey?: string,
): Promise<T> {
  if (!env.STRIPE_SECRET_KEY) throw new HttpError(503, 'not_configured', 'Payments are temporarily unavailable.');
  const body = encode(params).join('&');
  const url = `https://api.stripe.com/v1${path}${method !== 'POST' && body ? `?${body}` : ''}`;
  const headers: Record<string, string> = { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` };
  if (method === 'POST') headers['Content-Type'] = 'application/x-www-form-urlencoded';
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
  const res = await fetch(url, { method, headers, body: method === 'POST' ? body : undefined });
  const data = (await res.json()) as T & { error?: StripeError['stripeError'] };
  if (!res.ok) {
    console.error('stripe error', method, path, res.status, JSON.stringify(data.error));
    throw new StripeError(data.error?.message ?? 'The payment could not be processed.', data.error ?? {});
  }
  return data;
}

export interface PaymentIntent {
  id: string;
  status: string; // requires_payment_method | requires_confirmation | requires_action | requires_capture | succeeded | canceled
  amount: number;
  amount_capturable: number;
  client_secret: string;
  latest_charge?: string | { id: string } | null;
  metadata: Record<string, string>;
}

export const chargeId = (pi: PaymentIntent) => (typeof pi.latest_charge === 'string' ? pi.latest_charge : pi.latest_charge?.id);

/** Release an uncaptured hold. Safe to call on an already-canceled intent. */
export async function releaseHold(env: Env, paymentIntentId: string, reason = 'requested_by_customer'): Promise<void> {
  const pi = await stripe<PaymentIntent>(env, 'GET', `/payment_intents/${paymentIntentId}`);
  if (pi.status === 'canceled' || pi.status === 'succeeded') return;
  await stripe(env, 'POST', `/payment_intents/${paymentIntentId}/cancel`, { cancellation_reason: reason }, `cancel-${paymentIntentId}`);
}

/** Capture part or all of a hold; the rest of the hold is released. */
export async function capture(env: Env, paymentIntentId: string, amountCents: number): Promise<PaymentIntent> {
  return stripe<PaymentIntent>(env, 'POST', `/payment_intents/${paymentIntentId}/capture`, { amount_to_capture: amountCents, expand: ['latest_charge'] }, `capture-${paymentIntentId}`);
}

/** Send the driver their share from a captured charge (funds come from that charge, so they're available). */
export async function transferToDriver(env: Env, opts: { bookingId: string; accountId: string; amountCents: number; chargeId: string; kind: 'trip' | 'cancel_fee' | 'tip'; key?: string }) {
  if (opts.amountCents <= 0) return null;
  return stripe<{ id: string }>(
    env,
    'POST',
    '/transfers',
    {
      amount: opts.amountCents,
      currency: 'usd',
      destination: opts.accountId,
      source_transaction: opts.chargeId,
      transfer_group: opts.bookingId,
      description: `BoxHauls ${opts.bookingId} (${opts.kind === 'trip' ? 'trip' : opts.kind === 'tip' ? 'tip' : 'cancellation fee'})`,
      metadata: { booking_id: opts.bookingId, kind: opts.kind },
    },
    opts.key ?? `transfer-${opts.bookingId}-${opts.kind}`,
  );
}

/** Verify a Stripe webhook signature (Stripe-Signature: t=…,v1=…) with a 5-minute tolerance. */
export async function verifyWebhook(env: Env, payload: string, header: string | null): Promise<boolean> {
  if (!env.STRIPE_WEBHOOK_SECRET || !header) return false;
  const parts = Object.fromEntries(header.split(',').map((kv) => kv.split('=') as [string, string]));
  const t = Number(parts.t);
  if (!t || Math.abs(Date.now() / 1000 - t) > 300) return false;
  const signatures = header.split(',').filter((kv) => kv.startsWith('v1=')).map((kv) => kv.slice(3));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(env.STRIPE_WEBHOOK_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${t}.${payload}`)));
  const expected = [...mac].map((b) => b.toString(16).padStart(2, '0')).join('');
  // Constant-time compare against each v1 signature.
  return signatures.some((sig) => sig.length === expected.length && [...sig].reduce((acc, c, i) => acc | (c.charCodeAt(0) ^ expected.charCodeAt(i)), 0) === 0);
}
