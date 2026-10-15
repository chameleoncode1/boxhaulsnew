/**
 * POST /api/offer — what a driver sees when they open their accept link. Body: { token }.
 * Before accepting, only the job summary is shown (area, item, miles, time, pay) — never customer details.
 */
import type { Env } from '../_lib/env';
import { assertSameOrigin, handle, json, readJson, str } from '../_lib/http';
import { cityOf, payoutCents, whenText } from '../_lib/dispatch';
import { findOffer, offerState } from '../_lib/offers';
import { DUMP_MATERIALS, DUMP_LOADS } from '../../src/lib/dumpFees';
import { itemBySlug } from '../../src/lib/items';

export const onRequestPost: PagesFunction<Env> = ({ request, env }) =>
  handle(async () => {
    assertSameOrigin(request);
    const { token } = await readJson<{ token?: unknown }>(request);
    const row = await findOffer(env, str(token, 100));
    const state = offerState(row);
    return json({
      id: row.id,
      state,
      item: itemBySlug(row.item)?.label ?? row.item,
      from: cityOf(row.pickup_address),
      to: cityOf(row.dropoff_address),
      miles: row.miles,
      when: whenText(row),
      helper: row.helper === 1,
      dumpRun: row.item === 'dump-run',
      dumpHoldCents: row.dump_hold_cents ?? 0,
      dumpMaterial: DUMP_MATERIALS.find((m) => m.key === row.dump_material)?.label ?? null,
      dumpLoad: DUMP_LOADS.find((l) => l.key === row.dump_load)?.label ?? null,
      payoutCents: payoutCents(row.price_cents),
      completed: row.status === 'completed',
      canceled: row.status === 'canceled',
      priceCents: row.price_cents,
      // Full details only for the driver who won the job.
      ...(state === 'yours'
        ? { pickup: row.pickup_address, dropoff: row.dropoff_address, customer: row.name, phone: row.phone, notes: row.notes }
        : {}),
    });
  });
