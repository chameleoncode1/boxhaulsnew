/** Looking up a driver's job offer by the token in their accept link. */
import type { Env } from './env';
import { HttpError } from './http';
import { hash } from './quote';
import type { BookingRow } from './dispatch';

export interface OfferRow extends BookingRow {
  status: string;
  driver_id: string | null;
  dispatch_expires_at: string;
  offer_driver_id: string;
}

export async function findOffer(env: Env, token: string): Promise<OfferRow> {
  if (!env.QUOTE_SECRET) throw new HttpError(503, 'not_configured', 'Unavailable.');
  if (token.length < 20) throw new HttpError(404, 'not_found', 'This job link is not valid.');
  const row = await env.DB.prepare(
    `SELECT b.*, o.driver_id AS offer_driver_id FROM offers o JOIN bookings b ON b.id = o.booking_id WHERE o.token_hash = ?`,
  )
    .bind(await hash(token, env.QUOTE_SECRET))
    .first<OfferRow>();
  if (!row) throw new HttpError(404, 'not_found', 'This job link is not valid.');
  return row;
}

export function offerState(row: OfferRow): 'open' | 'yours' | 'taken' | 'expired' {
  if (row.status === 'assigned') return row.driver_id === row.offer_driver_id ? 'yours' : 'taken';
  if (row.status !== 'dispatching' || Date.now() > Date.parse(row.dispatch_expires_at)) return 'expired';
  return 'open';
}
