/** POST /api/driver/earnings — this week's earnings (Monday start, Fresno time), by day, with trips. Body: { weeksAgo? }. */
import type { Env } from '../../_lib/env';
import { assertSameOrigin, handle, json, readJson } from '../../_lib/http';
import { requireUser } from '../../_lib/auth';
import { earnings } from '../../_lib/driverJobs';
import { fresnoInstant, fresnoToday } from '../../_lib/time';

export const onRequestPost: PagesFunction<Env> = ({ request, env }) =>
  handle(async () => {
    assertSameOrigin(request);
    const id = await requireUser(env, request, 'driver');
    const b = await readJson<{ weeksAgo?: unknown }>(request);
    const weeksAgo = typeof b.weeksAgo === 'number' ? Math.max(0, Math.min(52, Math.floor(b.weeksAgo))) : 0;
    const today = new Date(`${fresnoToday()}T12:00:00Z`);
    const monday = new Date(today);
    monday.setUTCDate(today.getUTCDate() - ((today.getUTCDay() + 6) % 7) - weeksAgo * 7);
    const start = fresnoInstant(monday.toISOString().slice(0, 10), '00:00');
    const end = new Date(start.getTime() + 7 * 86400_000);
    const e = await earnings(env, id, start.toISOString());
    const trips = e.trips.filter((t) => t.at && Date.parse(t.at) < end.getTime());
    const days = Array.from({ length: 7 }, (_, i) => {
      const dayStart = start.getTime() + i * 86400_000;
      const list = trips.filter((t) => Date.parse(t.at!) >= dayStart && Date.parse(t.at!) < dayStart + 86400_000);
      return { date: new Date(dayStart + 12 * 3600_000).toISOString().slice(0, 10), cents: list.reduce((s, t) => s + t.fareCents + t.tipCents, 0) };
    });
    return json({
      weekStart: monday.toISOString().slice(0, 10),
      totalCents: trips.reduce((s, t) => s + t.fareCents + t.tipCents, 0),
      fareCents: trips.reduce((s, t) => s + t.fareCents, 0),
      tipCents: trips.reduce((s, t) => s + t.tipCents, 0),
      tripCount: trips.filter((t) => !t.canceled).length,
      onlineMinutes: weeksAgo === 0 ? e.onlineMinutes : null,
      days,
      trips,
    });
  });
