/** A customer reaches a trip with the token from their link or text, or by id when signed in and it's theirs. */
import type { Env } from './env';
import { HttpError, str } from './http';
import { sessionUser } from './auth';
import { bookingByCustomerToken, getBooking, type FullBooking } from './payments';

export async function tripFor(env: Env, request: Request, body: { token?: unknown; id?: unknown }): Promise<FullBooking> {
  const token = str(body.token, 100);
  if (token) return bookingByCustomerToken(env, token);
  const id = str(body.id, 20);
  const me = await sessionUser(env, request, 'customer');
  if (!id || !me) throw new HttpError(404, 'not_found', 'This trip link is not valid.');
  const b = await getBooking(env, id);
  if (!b || b.customer_id !== me) throw new HttpError(404, 'not_found', 'Trip not found.');
  return b;
}
