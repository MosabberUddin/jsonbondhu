// Unix timestamp helpers. Pure logic; unit-tested in tests/timestamp.test.js.
(function (root) {
  'use strict';

  const MAX_MS = 8.64e15; // the JavaScript Date range: ±100,000,000 days around 1970
  const UNITS = ['s', 'ms', 'us', 'ns'];
  const NS_PER = { s: 1000000000n, ms: 1000000n, us: 1000n, ns: 1n };
  const BN_DIGITS = '০১২৩৪৫৬৭৮৯';

  // Accept Bangla digits, spaces, underscores, commas and thin spaces as separators.
  function clean(input) {
    return String(input == null ? '' : input)
      .replace(/[০-৯]/g, (d) => String(BN_DIGITS.indexOf(d)))
      .replace(/[\s_,  ']/g, '')
      .replace(/^−/, '-');
  }

  // Guess the unit from the number of integer digits (present-day values:
  // 10 digits = seconds, 13 = ms, 16 = µs, 19 = ns).
  function detectUnit(intDigits) {
    const n = String(intDigits).replace(/^[-+]?0*/, '').length;
    if (n <= 11) return 's';
    if (n <= 14) return 'ms';
    if (n <= 17) return 'us';
    return 'ns';
  }

  const floorDiv = (a, b) => { const q = a / b; return (a % b !== 0n && (a < 0n) !== (b < 0n)) ? q - 1n : q; };

  // -> { ok: true, unit, detected, ms, fracMs, seconds, millis, int32 }
  //    ms: integer Date milliseconds (floored); fracMs: sub-millisecond remainder in [0,1)
  //    seconds / millis: exact whole values as strings
  // or { ok: false, error: 'empty' | 'invalid' | 'range' }
  function parse(input, unit) {
    const s = clean(input);
    if (!s) return { ok: false, error: 'empty' };
    const m = /^([+-]?)(\d+)(?:\.(\d*))?$/.exec(s);
    if (!m) return { ok: false, error: 'invalid' };
    const detected = !unit || unit === 'auto';
    const u = detected ? detectUnit(m[2]) : unit;
    if (!NS_PER[u]) return { ok: false, error: 'invalid' };
    const per = NS_PER[u];
    const fracDigits = String(per).length - 1;
    const frac = (m[3] || '').slice(0, fracDigits).padEnd(fracDigits, '0');
    let ns = BigInt(m[2]) * per + (fracDigits ? BigInt(frac || '0') : 0n);
    if (m[1] === '-') ns = -ns;
    const msBig = floorDiv(ns, 1000000n);
    if (msBig > BigInt(MAX_MS) || msBig < -BigInt(MAX_MS)) return { ok: false, error: 'range', unit: u, detected };
    const seconds = floorDiv(ns, 1000000000n);
    return {
      ok: true,
      unit: u,
      detected,
      ms: Number(msBig),
      fracMs: Number(ns - msBig * 1000000n) / 1e6,
      seconds: String(seconds),
      millis: String(msBig),
      int32: seconds >= -2147483648n && seconds <= 2147483647n,
    };
  }

  const pad = (n, w) => String(Math.abs(n)).padStart(w || 2, '0');
  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  function year4(y) { return y < 0 ? '-' + pad(y, 4) : pad(y, 4); }

  // "Tue, 14 Nov 2023 22:13:20 +0000" (RFC 2822 / RFC 5322 date-time, in UTC)
  function rfc2822(ms) {
    const d = new Date(ms);
    return DAYS[d.getUTCDay()] + ', ' + pad(d.getUTCDate()) + ' ' + MONTHS[d.getUTCMonth()] + ' ' + year4(d.getUTCFullYear()) + ' ' +
      pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes()) + ':' + pad(d.getUTCSeconds()) + ' +0000';
  }
  // "Tue, 14 Nov 2023 22:13:20 GMT" (HTTP-date, RFC 9110)
  function httpDate(ms) {
    return rfc2822(ms).replace(/\+0000$/, 'GMT');
  }
  const iso = (ms) => new Date(ms).toISOString();

  // Date.UTC that does not map years 0–99 to 1900–1999.
  function utc(y, mo, d, h, mi, s, ms) {
    const t = new Date(Date.UTC(2000, mo - 1, d, h, mi, s, ms));
    t.setUTCFullYear(y, mo - 1, d);
    return t.getTime();
  }

  const offsetFormatters = new Map();
  // Offset of `timeZone` from UTC at the instant `ms`, in milliseconds (Dhaka: +21600000).
  // timeZone undefined = the runtime's local zone.
  function zoneOffsetMs(ms, timeZone) {
    const key = timeZone || '';
    let f = offsetFormatters.get(key);
    if (!f) {
      f = new Intl.DateTimeFormat('en-US', {
        timeZone, hourCycle: 'h23', era: 'short', year: 'numeric', month: 'numeric', day: 'numeric',
        hour: 'numeric', minute: 'numeric', second: 'numeric',
      });
      offsetFormatters.set(key, f);
    }
    const p = {};
    for (const x of f.formatToParts(new Date(ms))) p[x.type] = x.value;
    let y = Number(p.year);
    if (/^b/i.test(p.era || '')) y = 1 - y;
    const wall = utc(y, Number(p.month), Number(p.day), Number(p.hour) % 24, Number(p.minute), Number(p.second), 0);
    return wall - (ms - (((ms % 1000) + 1000) % 1000));
  }

  // "2024-03-05T14:30" / "…:45" / "…:45.123" (a datetime-local value) read as wall-clock
  // time in `timeZone` -> Unix ms, or null if the text is not a valid date-time.
  function zonedToEpoch(text, timeZone) {
    const m = /^([+-]?\d{4,6})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3})\d*)?)?$/.exec(String(text || '').trim());
    if (!m) return null;
    const [y, mo, d, h, mi] = [m[1], m[2], m[3], m[4], m[5]].map(Number);
    const s = Number(m[6] || 0);
    const msPart = Number((m[7] || '0').padEnd(3, '0'));
    if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59 || s > 59) return null;
    const wall = utc(y, mo, d, h, mi, s, msPart);
    const check = new Date(wall);
    if (check.getUTCDate() !== d || check.getUTCMonth() !== mo - 1) return null; // e.g. 31 February
    if (timeZone === 'UTC') return wall;
    // Two passes handle offsets that change around the guessed instant (DST).
    const first = wall - zoneOffsetMs(wall, timeZone);
    const result = wall - zoneOffsetMs(first, timeZone);
    return Math.abs(result) <= MAX_MS ? result : null;
  }

  // Signed difference in ms -> { value, unit } for Intl.RelativeTimeFormat (value < 0 = past).
  function relative(diffMs) {
    const a = Math.abs(diffMs) / 1000;
    const sign = diffMs < 0 ? -1 : 1;
    const pick = (value, unit) => ({ value: sign * Math.trunc(value), unit });
    if (a < 60) return pick(a, 'second');
    if (a < 3600) return pick(a / 60, 'minute');
    if (a < 86400) return pick(a / 3600, 'hour');
    if (a < 86400 * 30) return pick(a / 86400, 'day');
    if (a < 86400 * 365) return pick(a / (86400 * 30.44), 'month');
    return pick(a / (86400 * 365.25), 'year');
  }

  // Human-readable date in a time zone, localized (en-GB or bn-BD).
  function formatIn(ms, lang, timeZone) {
    const opts = {
      timeZone, weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23', timeZoneName: 'short',
    };
    if (ms % 1000 !== 0) opts.fractionalSecondDigits = 3;
    if (new Date(ms).getUTCFullYear() < 1) opts.era = 'short';
    return new Intl.DateTimeFormat(lang === 'bn' ? 'bn-BD' : 'en-GB', opts).format(new Date(ms));
  }

  const api = { MAX_MS, UNITS, clean, detectUnit, parse, rfc2822, httpDate, iso, zoneOffsetMs, zonedToEpoch, relative, formatIn };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.JBTS = api;
})(typeof self !== 'undefined' ? self : this);
