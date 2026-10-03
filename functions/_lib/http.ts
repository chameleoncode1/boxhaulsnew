/** JSON responses, request parsing and same-origin checks for the booking API. */

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' },
  });
}

/** Wrap a handler: HttpErrors become JSON errors; anything else is a logged 500. */
export async function handle(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.code, message: e.message }, e.status);
    console.error('booking api error', e);
    return json({ error: 'server_error', message: 'Something went wrong. Please try again.' }, 500);
  }
}

const ALLOWED_HOSTS = [/^boxhauls\.com$/, /^www\.boxhauls\.com$/, /^([a-z0-9-]+\.)?boxhaulsnew\.pages\.dev$/, /^localhost$/, /^127\.0\.0\.1$/];

/** Browser requests must come from this site. Blocks other sites from spending the Maps budget through us. */
export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get('Origin');
  if (!origin) throw new HttpError(403, 'forbidden', 'Missing origin.');
  const host = new URL(origin).hostname;
  if (!ALLOWED_HOSTS.some((re) => re.test(host))) throw new HttpError(403, 'forbidden', 'Origin not allowed.');
}

/** Parse a small JSON body (≤ 8 KB). */
export async function readJson<T>(request: Request): Promise<T> {
  if (request.method !== 'POST') throw new HttpError(405, 'method_not_allowed', 'Use POST.');
  const text = await request.text();
  if (text.length > 8192) throw new HttpError(413, 'too_large', 'Request too large.');
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new HttpError(400, 'bad_json', 'Invalid request.');
  }
}

export const str = (v: unknown, max: number): string => (typeof v === 'string' ? v.trim().slice(0, max) : '');
