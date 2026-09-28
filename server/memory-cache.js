// Minimal in-memory stand-in for the Workers Cache API (caches.default).
// Only what functions/api/track.js needs: match() and put() honouring
// Cache-Control max-age. Bounded so a flood of unique keys cannot grow it forever.

const MAX_ENTRIES = 50_000;

export class MemoryCache {
  constructor() {
    this.entries = new Map();
  }

  async match(request) {
    const key = keyOf(request);
    const e = this.entries.get(key);
    if (!e) return undefined;
    if (e.expires <= Date.now()) {
      this.entries.delete(key);
      return undefined;
    }
    return new Response(e.body, { headers: e.headers });
  }

  async put(request, response) {
    const maxAge = /max-age=(\d+)/.exec(response.headers.get('Cache-Control') || '');
    if (!maxAge) return;
    if (this.entries.size >= MAX_ENTRIES) this.#prune();
    this.entries.set(keyOf(request), {
      body: await response.text(),
      headers: [...response.headers],
      expires: Date.now() + Number(maxAge[1]) * 1000,
    });
  }

  #prune() {
    const now = Date.now();
    for (const [k, e] of this.entries) if (e.expires <= now) this.entries.delete(k);
    // Still full of live entries: drop the oldest half.
    if (this.entries.size >= MAX_ENTRIES) {
      let drop = Math.floor(this.entries.size / 2);
      for (const k of this.entries.keys()) {
        if (drop-- <= 0) break;
        this.entries.delete(k);
      }
    }
  }
}

function keyOf(request) {
  return typeof request === 'string' ? request : request.url;
}
