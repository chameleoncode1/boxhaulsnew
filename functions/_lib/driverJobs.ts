/** What a driver sees: job offers (no customer details until accepted) and their assigned trips (full details). */
import type { Env } from './env';
import { cityOf, payoutCents, whenText } from './dispatch';
import type { FullBooking } from './payments';
import { itemBySlug } from '../../src/lib/items';
import { DUMP_LOADS, DUMP_MATERIALS } from '../../src/lib/dumpFees';
import { ONLINE_WINDOW_MS } from './dispatch';

import placeholders from '../../docs/placeholders.json';
const tierLabel = (t: string) => String((placeholders as Record<string, unknown>)[t] ?? t);
const dumpText = (b: FullBooking) =>
  b.dump_material ? `${DUMP_MATERIALS.find((m) => m.key === b.dump_material)?.label ?? b.dump_material}, ${(DUMP_LOADS.find((l) => l.key === b.dump_load)?.label ?? b.dump_load ?? '').toLowerCase()}` : null;

export function offerView(b: FullBooking) {
  return {
    id: b.id,
    item: itemBySlug(b.item)?.label ?? b.item,
    jobType: tierLabel(b.tier),
    pickupCity: cityOf(b.pickup_address),
    dropoffCity: cityOf(b.dropoff_address),
    miles: b.miles,
    when: whenText(b),
    asap: b.when_type === 'asap',
    payoutCents: payoutCents(b.price_cents),
    heavy: Boolean(b.heavy),
    dump: dumpText(b),
    expiresAt: b.dispatch_expires_at,
  };
}

export function tripView(b: FullBooking) {
  return {
    ...offerView(b),
    stage: b.picked_up_at ? 'to_dropoff' : b.arrived_at ? 'at_pickup' : 'to_pickup',
    pickup: b.pickup_address,
    dropoff: b.dropoff_address,
    customer: { firstName: b.name.split(/\s+/)[0], phone: b.phone },
    notes: b.notes,
    dumpRun: b.item === 'dump-run',
    dumpCapCents: b.dump_hold_cents ?? 0,
    tipCents: b.tip_cents,
  };
}

/** Open jobs this driver may accept now. ASAP jobs only while online; never ones they declined. */
export async function openOffers(env: Env, driverId: string, online: boolean): Promise<FullBooking[]> {
  const now = new Date().toISOString();
  const rows = await env.DB.prepare(
    `SELECT b.* FROM bookings b
      WHERE b.status = 'dispatching' AND b.dispatch_expires_at > ?
        AND NOT EXISTS (SELECT 1 FROM offer_declines x WHERE x.booking_id = b.id AND x.driver_id = ?)
        ${online ? '' : `AND b.when_type = 'scheduled'`}
      ORDER BY b.when_type = 'asap' DESC, b.confirmed_at ASC LIMIT 20`,
  )
    .bind(now, driverId)
    .all<FullBooking>();
  return rows.results;
}

export const isOnline = (d: { online: number; last_seen_at: string | null }) => Boolean(d.online) && Boolean(d.last_seen_at) && Date.now() - Date.parse(d.last_seen_at!) < ONLINE_WINDOW_MS;

/** Earnings: driver share of completed trips and cancellation fees, plus tips. */
export async function earnings(env: Env, driverId: string, sinceIso: string) {
  const trips = await env.DB.prepare(
    `SELECT b.id, b.item, b.status, b.completed_at, b.canceled_at, b.miles, COALESCE(b.driver_transfer_cents, 0) AS fare_cents,
            (SELECT COALESCE(SUM(t.amount_cents), 0) FROM tips t WHERE t.booking_id = b.id AND t.status = 'paid') AS tip_cents,
            b.pickup_address, b.dropoff_address
       FROM bookings b
      WHERE b.driver_id = ? AND ((b.status = 'completed' AND b.completed_at >= ?) OR (b.status = 'canceled' AND b.canceled_at >= ? AND COALESCE(b.driver_transfer_cents, 0) > 0))
      ORDER BY COALESCE(b.completed_at, b.canceled_at) DESC LIMIT 200`,
  )
    .bind(driverId, sinceIso, sinceIso)
    .all<{ id: string; item: string; status: string; completed_at: string | null; canceled_at: string | null; miles: number; fare_cents: number; tip_cents: number; pickup_address: string; dropoff_address: string }>();
  const online = await env.DB.prepare(
    `SELECT COALESCE(SUM((julianday(COALESCE(ended_at, ?)) - julianday(started_at)) * 24 * 60), 0) AS minutes FROM driver_sessions_online WHERE driver_id = ? AND started_at >= ?`,
  )
    .bind(new Date().toISOString(), driverId, sinceIso)
    .first<{ minutes: number }>();
  return {
    trips: trips.results.map((t) => ({
      id: t.id,
      item: itemBySlug(t.item)?.label ?? t.item,
      at: t.completed_at ?? t.canceled_at,
      canceled: t.status === 'canceled',
      route: `${cityOf(t.pickup_address)} → ${cityOf(t.dropoff_address)}`,
      miles: t.miles,
      fareCents: t.fare_cents,
      tipCents: t.tip_cents,
    })),
    onlineMinutes: Math.round(online?.minutes ?? 0),
  };
}
