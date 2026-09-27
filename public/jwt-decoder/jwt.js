// JWT decoder page. Loaded with `defer` from <head>: runs after the DOM is parsed
// but before DOMContentLoaded, so the strings below exist for i18n's first apply().
// Privacy: the token, secret and key are only ever read into memory here — never
// stored, logged or sent anywhere.
(function () {
  'use strict';
  const I18N = window.JBI18N;
  const t = I18N.t;
  const J = window.JBJWT;
  const { copy, toast } = window.JBTOOLS;

  I18N.extend({
    en: {
      'jwt.title': 'JWT Decoder — read claims, check expiry, verify signature | JSON Bondhu',
      'jwt.privacy': 'Your token never leaves this browser. Decoding and signature checks run locally — nothing is uploaded or logged.',
      'jwt.sample': 'Sample token',
      'jwt.sample.loaded': 'Demo token loaded (fake data, secret filled in below)',
      'jwt.input': 'Encoded token (JWT)',
      'jwt.input.placeholder': 'Paste a token like eyJhbGciOi… (a leading “Bearer ” is fine)',
      'jwt.header': 'Header',
      'jwt.payload': 'Payload (claims)',
      'jwt.signature': 'Signature (base64url)',
      'jwt.sig.bytes': '{n} bytes',
      'jwt.part.header': 'header',
      'jwt.part.payload': 'payload',
      'jwt.part.signature': 'signature',
      'jwt.ok': 'Decoded ({alg}). Decoding is not verifying — anyone can create a token with these claims. Check the signature below.',
      'jwt.unsigned': '⚠ alg is “none”: this token is NOT signed. Anyone could have written it — never trust it.',
      'jwt.err.empty': 'Paste a JWT above to decode it.',
      'jwt.err.parts': 'A JWT has 3 parts separated by dots — this has {n}.',
      'jwt.err.base64': 'The {part} is not valid base64url.',
      'jwt.err.utf8': 'The {part} is not valid UTF-8 text.',
      'jwt.err.json': 'The {part} is not valid JSON.',
      'jwt.err.notObject': 'The {part} must be a JSON object.',
      'jwt.err.jwe': 'This is an encrypted token (JWE, 5 parts). Its content can only be read with the recipient’s private key, so it can’t be decoded here. The protected header is shown.',
      'jwt.claims': 'Registered claims',
      'jwt.claims.none': 'This token has no registered claims (iss, sub, aud, exp, nbf, iat, jti).',
      'jwt.claim.iss': 'Issuer — who created and signed the token',
      'jwt.claim.sub': 'Subject — who the token is about (usually a user ID)',
      'jwt.claim.aud': 'Audience — who the token is meant for',
      'jwt.claim.exp': 'Expiration time — must be rejected after this',
      'jwt.claim.nbf': 'Not before — must be rejected before this',
      'jwt.claim.iat': 'Issued at — when the token was created',
      'jwt.claim.jti': 'JWT ID — a unique ID, helps prevent replay',
      'jwt.time.utc': 'UTC: {v}',
      'jwt.time.local': 'Your time: {v}',
      'jwt.time.bad': 'Not a valid NumericDate (should be seconds since 1970)',
      'jwt.rel.exp.past': 'Expired {rel}',
      'jwt.rel.exp.future': 'Expires {rel}',
      'jwt.rel.nbf.past': 'Valid since {rel}',
      'jwt.rel.nbf.future': 'Becomes valid {rel}',
      'jwt.rel.iat.past': 'Issued {rel}',
      'jwt.rel.iat.future': 'Issued in the future ({rel}) — check the clocks',
      'jwt.state.valid': '✓ Within its valid time window',
      'jwt.state.expired': '✗ Expired',
      'jwt.state.notYet': '⏳ Not valid yet',
      'jwt.state.noExp': '⚠ No expiry (exp) — never expires',
      'jwt.state.invalid': '✗ exp/nbf is not a number',
      'jwt.verify.title': 'Verify the signature (optional)',
      'jwt.verify.hint.empty': 'Decode a token first.',
      'jwt.verify.hint.secret': '{alg} uses a shared secret (HMAC). Enter the secret to check the signature.',
      'jwt.verify.hint.public': '{alg} uses a key pair. Paste the PUBLIC key — PEM starting with “BEGIN PUBLIC KEY” (SPKI) or a JWK.',
      'jwt.verify.hint.none': 'This token is unsigned (alg “none”), so there is nothing to verify.',
      'jwt.verify.hint.unsupported': 'Verifying “{alg}” is not supported here. Supported: HS256/384/512, RS256/384/512, PS256/384/512, ES256/384/512.',
      'jwt.verify.key.secret': 'Secret',
      'jwt.verify.key.public': 'Public key (PEM or JWK)',
      'jwt.verify.placeholder.secret': 'your-256-bit-secret',
      'jwt.verify.placeholder.public': '-----BEGIN PUBLIC KEY-----\n…\n-----END PUBLIC KEY-----',
      'jwt.verify.b64': 'Secret is base64-encoded',
      'jwt.verify.btn': 'Verify signature',
      'jwt.verify.ok': '✓ Signature verified — the token was signed with this key and has not been changed.',
      'jwt.verify.bad': '✗ Invalid signature — the token was altered or the key is wrong.',
      'jwt.verify.err.none': 'Unsigned token (alg “none”) — cannot be verified and must not be trusted.',
      'jwt.verify.err.unsupported': 'This algorithm is not supported for verification here.',
      'jwt.verify.err.noKey': 'Enter the key first.',
      'jwt.verify.err.keyFormat': 'Could not read the key. Use a PEM “BEGIN PUBLIC KEY” block or a public JWK.',
      'jwt.verify.err.pkcs1': 'This is a PKCS#1 “RSA PUBLIC KEY”. Convert it to SPKI (“BEGIN PUBLIC KEY”), e.g. openssl rsa -RSAPublicKey_in -pubout.',
      'jwt.verify.err.certificate': 'This is a certificate. Extract its public key first, e.g. openssl x509 -pubkey -noout.',
      'jwt.verify.err.privateKey': 'That looks like a PRIVATE key. Never paste private keys into websites — use the public key.',
      'jwt.verify.err.jwks': 'This is a key set (JWKS). Paste just the one key whose “kid” matches the header.',
      'jwt.verify.err.badKey': 'The key does not fit this algorithm (e.g. an EC key for an RS256 token).',
      'jwt.verify.err.sigFormat': 'The signature has the wrong length for this algorithm (ECDSA signatures must be raw r‖s, not DER).',
      'jwt.verify.err.noCrypto': 'Web Crypto is not available (the page must be served over HTTPS).',
      'jwt.paste.failed': 'Press Ctrl + V in the box to paste',
    },
    bn: {
      'jwt.title': 'JWT ডিকোডার — ক্লেইম পড়ুন, মেয়াদ দেখুন, সিগনেচার যাচাই করুন | JSON বন্ধু',
      'jwt.privacy': 'আপনার টোকেন এই ব্রাউজারের বাইরে যায় না। ডিকোড ও সিগনেচার যাচাই এখানেই হয় — কিছুই আপলোড বা সংরক্ষণ করা হয় না।',
      'jwt.sample': 'নমুনা টোকেন',
      'jwt.sample.loaded': 'ডেমো টোকেন লোড হয়েছে (নকল তথ্য, সিক্রেট নিচে বসানো আছে)',
      'jwt.input': 'এনকোড করা টোকেন (JWT)',
      'jwt.input.placeholder': 'eyJhbGciOi… ধরনের টোকেন পেস্ট করুন (শুরুতে “Bearer ” থাকলেও চলবে)',
      'jwt.header': 'হেডার',
      'jwt.payload': 'পেলোড (ক্লেইম)',
      'jwt.signature': 'সিগনেচার (base64url)',
      'jwt.sig.bytes': '{n} বাইট',
      'jwt.part.header': 'হেডার',
      'jwt.part.payload': 'পেলোড',
      'jwt.part.signature': 'সিগনেচার',
      'jwt.ok': 'ডিকোড হয়েছে ({alg})। ডিকোড মানেই যাচাই নয় — যে কেউ এই ক্লেইম দিয়ে টোকেন বানাতে পারে। নিচে সিগনেচার যাচাই করুন।',
      'jwt.unsigned': '⚠ alg হলো “none”: এই টোকেন সাইন করা নয়। যে কেউ এটি লিখতে পারে — কখনো বিশ্বাস করবেন না।',
      'jwt.err.empty': 'ডিকোড করতে ওপরে একটি JWT পেস্ট করুন।',
      'jwt.err.parts': 'JWT-তে ডট দিয়ে আলাদা ৩টি অংশ থাকে — এখানে আছে {n}টি।',
      'jwt.err.base64': '{part} সঠিক base64url নয়।',
      'jwt.err.utf8': '{part} সঠিক UTF-8 টেক্সট নয়।',
      'jwt.err.json': '{part} সঠিক JSON নয়।',
      'jwt.err.notObject': '{part} অবশ্যই একটি JSON অবজেক্ট হতে হবে।',
      'jwt.err.jwe': 'এটি এনক্রিপ্ট করা টোকেন (JWE, ৫টি অংশ)। এর ভেতরের তথ্য শুধু প্রাপকের প্রাইভেট কী দিয়ে পড়া যায়, তাই এখানে ডিকোড করা সম্ভব নয়। সুরক্ষিত হেডারটি দেখানো হলো।',
      'jwt.claims': 'নিবন্ধিত ক্লেইম',
      'jwt.claims.none': 'এই টোকেনে কোনো নিবন্ধিত ক্লেইম (iss, sub, aud, exp, nbf, iat, jti) নেই।',
      'jwt.claim.iss': 'ইস্যুকারী — কে টোকেনটি তৈরি ও সাইন করেছে',
      'jwt.claim.sub': 'বিষয় — টোকেনটি কার সম্পর্কে (সাধারণত ইউজার আইডি)',
      'jwt.claim.aud': 'অডিয়েন্স — টোকেনটি কার জন্য',
      'jwt.claim.exp': 'মেয়াদ শেষের সময় — এরপর অবশ্যই বাতিল',
      'jwt.claim.nbf': 'এর আগে নয় — এর আগে অবশ্যই বাতিল',
      'jwt.claim.iat': 'ইস্যুর সময় — কখন টোকেনটি তৈরি হয়েছে',
      'jwt.claim.jti': 'JWT আইডি — অনন্য আইডি, পুনর্ব্যবহার (replay) ঠেকাতে সাহায্য করে',
      'jwt.time.utc': 'UTC: {v}',
      'jwt.time.local': 'আপনার সময়: {v}',
      'jwt.time.bad': 'সঠিক NumericDate নয় (১৯৭০ থেকে সেকেন্ডের সংখ্যা হওয়া উচিত)',
      'jwt.rel.exp.past': 'মেয়াদ শেষ হয়েছে: {rel}',
      'jwt.rel.exp.future': 'মেয়াদ শেষ হবে: {rel}',
      'jwt.rel.nbf.past': 'বৈধ হয়েছে: {rel}',
      'jwt.rel.nbf.future': 'বৈধ হবে: {rel}',
      'jwt.rel.iat.past': 'ইস্যু হয়েছে: {rel}',
      'jwt.rel.iat.future': 'ভবিষ্যতের ইস্যু সময় ({rel}) — ঘড়ি মিলিয়ে দেখুন',
      'jwt.state.valid': '✓ বৈধ সময়সীমার মধ্যে আছে',
      'jwt.state.expired': '✗ মেয়াদ শেষ',
      'jwt.state.notYet': '⏳ এখনো বৈধ হয়নি',
      'jwt.state.noExp': '⚠ মেয়াদ (exp) নেই — কখনো শেষ হয় না',
      'jwt.state.invalid': '✗ exp/nbf সংখ্যা নয়',
      'jwt.verify.title': 'সিগনেচার যাচাই করুন (ঐচ্ছিক)',
      'jwt.verify.hint.empty': 'আগে একটি টোকেন ডিকোড করুন।',
      'jwt.verify.hint.secret': '{alg} একটি শেয়ার করা সিক্রেট (HMAC) ব্যবহার করে। সিগনেচার যাচাই করতে সিক্রেটটি দিন।',
      'jwt.verify.hint.public': '{alg} কী-জোড়া ব্যবহার করে। পাবলিক কী পেস্ট করুন — “BEGIN PUBLIC KEY” দিয়ে শুরু PEM (SPKI) অথবা JWK।',
      'jwt.verify.hint.none': 'এই টোকেন সাইন করা নয় (alg “none”), তাই যাচাই করার কিছু নেই।',
      'jwt.verify.hint.unsupported': '“{alg}” যাচাই এখানে সমর্থিত নয়। সমর্থিত: HS256/384/512, RS256/384/512, PS256/384/512, ES256/384/512।',
      'jwt.verify.key.secret': 'সিক্রেট',
      'jwt.verify.key.public': 'পাবলিক কী (PEM বা JWK)',
      'jwt.verify.placeholder.secret': 'আপনার-সিক্রেট',
      'jwt.verify.placeholder.public': '-----BEGIN PUBLIC KEY-----\n…\n-----END PUBLIC KEY-----',
      'jwt.verify.b64': 'সিক্রেটটি base64-এ এনকোড করা',
      'jwt.verify.btn': 'সিগনেচার যাচাই',
      'jwt.verify.ok': '✓ সিগনেচার সঠিক — টোকেনটি এই কী দিয়েই সাইন করা এবং বদলানো হয়নি।',
      'jwt.verify.bad': '✗ সিগনেচার ভুল — টোকেনটি বদলানো হয়েছে অথবা কী ভুল।',
      'jwt.verify.err.none': 'সাইনবিহীন টোকেন (alg “none”) — যাচাই করা যায় না, বিশ্বাস করাও উচিত নয়।',
      'jwt.verify.err.unsupported': 'এই অ্যালগরিদমের যাচাই এখানে সমর্থিত নয়।',
      'jwt.verify.err.noKey': 'আগে কী দিন।',
      'jwt.verify.err.keyFormat': 'কী পড়া গেল না। PEM “BEGIN PUBLIC KEY” ব্লক অথবা পাবলিক JWK ব্যবহার করুন।',
      'jwt.verify.err.pkcs1': 'এটি PKCS#1 “RSA PUBLIC KEY”। SPKI (“BEGIN PUBLIC KEY”)-তে রূপান্তর করুন, যেমন openssl rsa -RSAPublicKey_in -pubout।',
      'jwt.verify.err.certificate': 'এটি একটি সার্টিফিকেট। আগে এর পাবলিক কী বের করুন, যেমন openssl x509 -pubkey -noout।',
      'jwt.verify.err.privateKey': 'এটি প্রাইভেট কী মনে হচ্ছে। কোনো ওয়েবসাইটে কখনো প্রাইভেট কী পেস্ট করবেন না — পাবলিক কী ব্যবহার করুন।',
      'jwt.verify.err.jwks': 'এটি কী-সেট (JWKS)। হেডারের “kid”-এর সাথে মেলে এমন একটি কী পেস্ট করুন।',
      'jwt.verify.err.badKey': 'কী-টি এই অ্যালগরিদমের সাথে মেলে না (যেমন RS256 টোকেনের জন্য EC কী)।',
      'jwt.verify.err.sigFormat': 'এই অ্যালগরিদমের জন্য সিগনেচারের দৈর্ঘ্য ভুল (ECDSA সিগনেচার DER নয়, raw r‖s হতে হবে)।',
      'jwt.verify.err.noCrypto': 'Web Crypto পাওয়া যাচ্ছে না (পেজটি HTTPS-এ খুলতে হবে)।',
      'jwt.paste.failed': 'বক্সে Ctrl + V চেপে পেস্ট করুন',
    },
  });

  const $ = (s) => document.querySelector(s);
  const input = $('#jwt-input');
  const colored = $('#jwt-colored');
  const headerEl = $('#jwt-header');
  const payloadEl = $('#jwt-payload');
  const sigEl = $('#jwt-sig');
  const sigBytesEl = $('#jwt-sig-bytes');
  const statusEl = $('#status');
  const claimsEl = $('#jwt-claims');
  const badgeEl = $('#jwt-time-badge');
  const hintEl = $('#jwt-verify-hint');
  const keyEl = $('#jwt-key');
  const keyLabel = $('#jwt-key-label');
  const b64Wrap = $('#jwt-b64-wrap');
  const b64El = $('#jwt-b64');
  const resultEl = $('#jwt-verify-result');
  const subtle = (window.crypto && window.crypto.subtle) || null;

  let decoded = null;       // last decode() result
  let verifyState = null;   // { valid } | { error } | null
  let verifySeq = 0;

  const locale = () => (I18N.lang === 'bn' ? 'bn-BD' : 'en-GB');
  const el = (tag, className, text) => {
    const e = document.createElement(tag);
    if (className) e.className = className;
    if (text !== undefined) e.textContent = text;
    return e;
  };
  const pretty = (obj) => JSON.stringify(obj, null, 2);

  function fmtDate(sec, timeZone) {
    return new Intl.DateTimeFormat(locale(), {
      timeZone, year: 'numeric', month: 'short', day: 'numeric', weekday: 'short',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23', timeZoneName: 'short',
    }).format(new Date(sec * 1000));
  }
  function fmtRel(diffSec) {
    const r = J.relative(diffSec);
    return new Intl.RelativeTimeFormat(locale(), { numeric: 'auto' }).format(r.value, r.unit);
  }

  function setStatus(text, cls) {
    statusEl.textContent = text;
    statusEl.className = 'status' + (cls ? ' ' + cls : '');
  }

  function renderColored(token) {
    colored.textContent = '';
    if (!token) return;
    const parts = token.split('.');
    const cls = parts.length === 3 ? ['h', 'p', 's'] : [];
    parts.forEach((p, i) => {
      if (i) colored.append(el('span', 'dot', '.'));
      colored.append(el('span', cls[i] || '', p));
    });
  }

  function timeCell(name, value, nowSec) {
    const td = el('td');
    if (!J.isNumericDate(value)) {
      td.append(el('code', 'line', JSON.stringify(value)));
      td.append(el('span', 'line badge err', t('jwt.time.bad')));
      return td;
    }
    td.append(el('code', 'line', I18N.num(value)));
    td.append(el('span', 'line', t('jwt.time.utc', { v: fmtDate(value, 'UTC') })));
    td.append(el('span', 'line sub', t('jwt.time.local', { v: fmtDate(value) })));
    const diff = value - nowSec;
    const dir = diff < 0 ? 'past' : 'future';
    let cls = 'line';
    if (name === 'exp') cls += diff <= 0 ? ' badge err' : ' badge ok';
    if (name === 'nbf' && diff > 0) cls += ' badge warn';
    td.append(el('span', cls, t('jwt.rel.' + name + '.' + dir, { rel: fmtRel(diff) })));
    return td;
  }

  function renderClaims() {
    claimsEl.textContent = '';
    badgeEl.textContent = '';
    if (!decoded || !decoded.ok) return;
    const p = decoded.payload;
    const nowSec = Math.floor(Date.now() / 1000);
    const st = J.timeStatus(p, nowSec);
    const cls = { valid: 'ok', expired: 'err', notYet: 'warn', noExp: 'warn', invalid: 'err' }[st.state];
    const badge = el('span', 'badge ' + cls, t('jwt.state.' + st.state));
    badge.id = 'jwt-state';
    badge.dataset.state = st.state;
    badgeEl.append(badge);
    let any = false;
    for (const name of J.REGISTERED) {
      if (!Object.prototype.hasOwnProperty.call(p, name)) continue;
      any = true;
      const tr = el('tr');
      tr.dataset.claim = name;
      const th = el('th');
      th.append(el('code', '', name), el('span', 'meaning', t('jwt.claim.' + name)));
      let td;
      if (J.TIME_CLAIMS.includes(name)) td = timeCell(name, p[name], nowSec);
      else {
        td = el('td');
        const v = p[name];
        const text = Array.isArray(v) ? v.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join(', ') : (typeof v === 'string' ? v : JSON.stringify(v));
        td.append(el('code', '', text));
      }
      tr.append(th, td);
      claimsEl.append(tr);
    }
    if (!any) {
      const cap = el('caption', '', t('jwt.claims.none'));
      claimsEl.append(cap);
    }
  }

  function renderVerifyHint() {
    const alg = decoded && decoded.ok ? decoded.alg : '';
    const kind = decoded && decoded.ok ? J.keyKind(alg) : 'empty';
    hintEl.textContent = t('jwt.verify.hint.' + kind, { alg: alg || '?' });
    const secret = kind !== 'public';
    keyLabel.textContent = t(secret ? 'jwt.verify.key.secret' : 'jwt.verify.key.public');
    keyEl.placeholder = t(secret ? 'jwt.verify.placeholder.secret' : 'jwt.verify.placeholder.public');
    b64Wrap.hidden = kind !== 'secret';
    const disabled = kind === 'none' || kind === 'unsupported' || kind === 'empty';
    keyEl.disabled = disabled;
    document.querySelector('[data-act=verify]').disabled = disabled;
  }

  function renderVerifyResult() {
    resultEl.className = 'jwt-verify-result';
    resultEl.textContent = '';
    if (!verifyState) return;
    if (verifyState.error) {
      resultEl.classList.add(verifyState.error === 'noKey' ? 'warn' : 'err');
      resultEl.textContent = t('jwt.verify.err.' + verifyState.error);
    } else {
      resultEl.classList.add(verifyState.valid ? 'ok' : 'err');
      resultEl.textContent = t(verifyState.valid ? 'jwt.verify.ok' : 'jwt.verify.bad');
    }
    resultEl.dataset.result = verifyState.error || (verifyState.valid ? 'valid' : 'invalid');
  }

  function render() {
    headerEl.textContent = '';
    payloadEl.textContent = '';
    sigEl.textContent = '';
    sigBytesEl.textContent = '';
    const d = decoded;
    if (!d) { setStatus(''); renderClaims(); renderVerifyHint(); return; }
    if (d.ok) {
      headerEl.textContent = pretty(d.header);
      payloadEl.textContent = pretty(d.payload);
      sigEl.textContent = d.signature;
      sigBytesEl.textContent = t('jwt.sig.bytes', { n: d.signatureBytes });
      if (d.unsigned) setStatus(t('jwt.unsigned'), 'warn');
      else setStatus(t('jwt.ok', { alg: d.alg || '?' }), 'ok');
    } else {
      if (d.header) headerEl.textContent = pretty(d.header);
      const part = d.part ? t('jwt.part.' + d.part) : '';
      const msg = t('jwt.err.' + d.error, { n: d.count || 0, part });
      setStatus(msg.charAt(0).toUpperCase() + msg.slice(1), d.error === 'empty' ? '' : (d.error === 'jwe' ? 'warn' : 'err'));
    }
    renderClaims();
    renderVerifyHint();
    renderVerifyResult();
  }

  async function runVerify(force) {
    const seq = ++verifySeq;
    if (!decoded || !decoded.ok) { verifyState = null; renderVerifyResult(); return; }
    const kind = J.keyKind(decoded.alg);
    if (kind === 'none' || kind === 'unsupported') { verifyState = null; renderVerifyResult(); return; }
    if (!keyEl.value && !force) { verifyState = null; renderVerifyResult(); return; }
    const r = await J.verify(decoded, keyEl.value, subtle, { secretBase64: b64El.checked });
    if (seq !== verifySeq) return; // a newer check started meanwhile
    verifyState = r;
    renderVerifyResult();
  }

  let keyTimer;
  const verifySoon = () => { clearTimeout(keyTimer); keyTimer = setTimeout(() => runVerify(false), 200); };

  function decodeInput() {
    const raw = input.value;
    decoded = raw.trim() ? J.decode(raw) : null;
    renderColored(decoded && (decoded.ok || decoded.error !== 'empty') ? J.normalize(raw) : '');
    verifyState = null;
    render();
    if (decoded && decoded.ok && keyEl.value) runVerify(false);
  }

  async function loadSample() {
    if (!subtle) { toast(t('jwt.verify.err.noCrypto')); return; }
    const token = await J.sample(Math.floor(Date.now() / 1000), subtle);
    input.value = token;
    keyEl.value = J.SAMPLE_SECRET;
    b64El.checked = false;
    decodeInput();
    toast(t('jwt.sample.loaded'));
  }

  async function paste() {
    try {
      input.value = await navigator.clipboard.readText();
      decodeInput();
    } catch (e) {
      input.focus();
      toast(t('jwt.paste.failed'));
    }
  }

  document.addEventListener('click', (e) => {
    const act = e.target.closest('[data-act]');
    if (act) {
      if (act.dataset.act === 'sample') loadSample();
      if (act.dataset.act === 'paste') paste();
      if (act.dataset.act === 'clear') { input.value = ''; keyEl.value = ''; decodeInput(); input.focus(); }
      if (act.dataset.act === 'verify') runVerify(true);
      return;
    }
    const c = e.target.closest('[data-copy]');
    if (c && decoded && (decoded.ok || decoded.header)) {
      const which = c.dataset.copy;
      const text = which === 'header' ? headerEl.textContent : which === 'payload' ? payloadEl.textContent : sigEl.textContent;
      if (text) copy(text);
    }
  });
  input.addEventListener('input', decodeInput);
  keyEl.addEventListener('input', verifySoon);
  b64El.addEventListener('change', () => runVerify(false));
  window.addEventListener('jb:langchange', render);
  // Keep "expires in …" fresh while the page is open.
  setInterval(() => { if (decoded && decoded.ok) renderClaims(); }, 30000);
  document.addEventListener('DOMContentLoaded', () => { if (input.value) decodeInput(); else render(); });
})();
