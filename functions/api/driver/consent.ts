/**
 * POST /api/driver/consent — background-check disclosure and authorization. Body: { signature } (full legal name, as typed).
 * Recorded with time and a hashed IP. The provider collects the SSN directly; BoxHauls never sees it.
 */
import type { Env } from '../../_lib/env';
import { assertSameOrigin, handle, HttpError, json, readJson, str } from '../../_lib/http';
import { ipHash, requireUser } from '../../_lib/auth';
import { getDriver, publicDriver } from '../../_lib/drivers';
import placeholders from '../../../docs/placeholders.json';

export const onRequestPost: PagesFunction<Env> = ({ request, env }) =>
  handle(async () => {
    assertSameOrigin(request);
    const id = await requireUser(env, request, 'driver');
    const d = await getDriver(env, id);
    const b = await readJson<{ signature?: unknown }>(request);
    const sig = str(b.signature, 120).toLowerCase().replace(/\s+/g, ' ');
    const legal = `${d.first_name ?? ''} ${d.last_name ?? ''}`.toLowerCase().replace(/\s+/g, ' ').trim();
    if (!sig || sig !== legal) throw new HttpError(422, 'bad_signature', `Type your full legal name (${d.first_name} ${d.last_name}) to sign.`);
    await env.DB.prepare(`UPDATE drivers SET background_consent_at = ?, background_consent_ip_hash = ?, background_status = 'consented', background_provider = ?, updated_at = ? WHERE id = ?`)
      .bind(new Date().toISOString(), await ipHash(request), String((placeholders as Record<string, unknown>).BACKGROUND_PROVIDER ?? ''), new Date().toISOString(), id)
      .run();
    return json({ ok: true, driver: await publicDriver(env, await getDriver(env, id)) });
  });
