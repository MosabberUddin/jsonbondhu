// Small HTTP helpers shared by the Pages Functions.

const BASE_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'X-Content-Type-Options': 'nosniff',
};

export function json(data, { status = 200, cache = 'no-store', headers = {} } = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...BASE_HEADERS, 'Cache-Control': cache, ...headers },
  });
}

export function error(status, message, extra = {}) {
  return json({ error: message, ...extra }, { status });
}

export function noContent() {
  return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
}

export function methodNotAllowed(allowed) {
  return new Response(null, { status: 405, headers: { Allow: allowed.join(', '), 'Cache-Control': 'no-store' } });
}

/**
 * True when the request was initiated by a page on our own origin.
 * Uses Origin when present (all modern browsers send it on POST/PUT),
 * otherwise Sec-Fetch-Site. Requests carrying neither are rejected.
 */
export function isSameOrigin(request) {
  const origin = request.headers.get('Origin');
  if (origin) return origin === new URL(request.url).origin;
  return request.headers.get('Sec-Fetch-Site') === 'same-origin';
}

/**
 * Read a request body as text with a hard size cap. Returns null if too large.
 * Streams so an attacker cannot make us buffer an arbitrarily large body.
 */
export async function readBodyText(request, maxBytes) {
  const declared = Number(request.headers.get('Content-Length'));
  if (Number.isFinite(declared) && declared > maxBytes) return null;
  if (!request.body) return '';
  const reader = request.body.getReader();
  const chunks = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      try { await reader.cancel(); } catch { /* ignore */ }
      return null;
    }
    chunks.push(value);
  }
  const buf = new Uint8Array(size);
  let off = 0;
  for (const c of chunks) { buf.set(c, off); off += c.byteLength; }
  return new TextDecoder().decode(buf);
}

/** Parse JSON body with a size cap. Returns {ok, value} or {ok:false, response}. */
export async function readJson(request, maxBytes) {
  const text = await readBodyText(request, maxBytes);
  if (text === null) return { ok: false, response: error(413, 'Request body too large') };
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false, response: error(400, 'Invalid JSON') };
  }
}
