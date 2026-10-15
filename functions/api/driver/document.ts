/**
 * POST /api/driver/document — upload a document photo. Body: { kind, dataUrl } (JPEG/PNG/WebP, resized in the browser, ≤ 2.5 MB).
 * GET  /api/driver/document?kind=… — the signed-in driver's own photo (never cached, never public).
 */
import type { Env } from '../../_lib/env';
import { assertSameOrigin, handle, HttpError, json, readJson, str } from '../../_lib/http';
import { randomToken, requireUser } from '../../_lib/auth';
import { DOC_KINDS, getDriver, publicDriver, type DocKind } from '../../_lib/drivers';

const MAX_BYTES = 2_500_000;

export const onRequestPost: PagesFunction<Env> = ({ request, env }) =>
  handle(async () => {
    assertSameOrigin(request);
    const id = await requireUser(env, request, 'driver');
    const d = await getDriver(env, id);
    const b = await readJson<{ kind?: unknown; dataUrl?: unknown }>(request, 3_600_000);
    const kind = str(b.kind, 30) as DocKind;
    if (!DOC_KINDS.includes(kind)) throw new HttpError(400, 'bad_kind', 'Unknown document.');
    const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(typeof b.dataUrl === 'string' ? b.dataUrl : '');
    if (!m) throw new HttpError(422, 'bad_image', 'Upload a photo (JPEG, PNG or WebP).');
    const bytes = Uint8Array.from(atob(m[2]), (c) => c.charCodeAt(0));
    if (bytes.length > MAX_BYTES) throw new HttpError(413, 'too_large', 'That photo is too large. Try again with a smaller one.');
    await env.DB.prepare('DELETE FROM driver_documents WHERE driver_id = ? AND kind = ?').bind(id, kind).run();
    await env.DB.prepare('INSERT INTO driver_documents (id, driver_id, kind, mime, bytes, data, uploaded_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind(randomToken(12), id, kind, m[1], bytes.length, bytes, new Date().toISOString())
      .run();
    if (d.application_status === 'approved' && kind !== 'profile_photo') {
      await env.DB.prepare(`UPDATE drivers SET application_status = 'submitted', approved_at = NULL, online = 0 WHERE id = ?`).bind(id).run();
    }
    return json({ ok: true, driver: await publicDriver(env, await getDriver(env, id)) });
  });

export const onRequestGet: PagesFunction<Env> = ({ request, env }) =>
  handle(async () => {
    const id = await requireUser(env, request, 'driver');
    const kind = new URL(request.url).searchParams.get('kind') ?? '';
    const doc = await env.DB.prepare('SELECT mime, data FROM driver_documents WHERE driver_id = ? AND kind = ?').bind(id, kind).first<{ mime: string; data: ArrayBuffer }>();
    if (!doc) throw new HttpError(404, 'not_found', 'No photo yet.');
    return new Response(new Uint8Array(doc.data), { headers: { 'Content-Type': doc.mime, 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex' } });
  });
