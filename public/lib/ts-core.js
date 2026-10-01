// JSON -> TypeScript declarations. Pure functions; unit-tested in tests/ts.test.js.
(function (root) {
  'use strict';

  const IDENT_RE = /^[\p{ID_Start}$_][\p{ID_Continue}$‌‍]*$/u;
  // Global names a generated nested type should not shadow.
  const GLOBALS = ['Array', 'Object', 'Record', 'Date', 'Map', 'Set', 'Promise', 'String', 'Number', 'Boolean', 'Symbol', 'Partial', 'Readonly', 'Function', 'Error', 'RegExp'];
  const RANK = { string: 0, number: 1, boolean: 2, object: 3, array: 4, null: 5 };

  // ---- inference -------------------------------------------------------------------
  // Node shapes: {k:'string'|'number'|'boolean'|'null'}, {k:'array', el: node|null},
  // {k:'object', props: Map<key,{node,opt}>}, {k:'union', m:[node...]} (never nested).
  // `opt` (merge objects into one type with optional keys) is threaded through explicitly.

  function keySig(o) { return [...o.props.keys()].sort().join('\u0000'); }

  function infer(v, opt) {
    if (v === null) return { k: 'null' };
    if (Array.isArray(v)) {
      let el = null;
      for (const item of v) el = el === null ? infer(item, opt) : merge(el, infer(item, opt), opt);
      return { k: 'array', el };
    }
    switch (typeof v) {
      case 'string': return { k: 'string' };
      case 'number': return { k: 'number' };
      case 'boolean': return { k: 'boolean' };
    }
    const props = new Map();
    for (const key of Object.keys(v)) props.set(key, { node: infer(v[key], opt), opt: false });
    return { k: 'object', props };
  }

  const members = (n) => (n.k === 'union' ? n.m : [n]);
  const mergeEl = (a, b, opt) => (a === null ? b : b === null ? a : merge(a, b, opt));

  function mergeObj(a, b, opt) {
    const props = new Map();
    for (const [key, p] of a.props) {
      const q = b.props.get(key);
      props.set(key, q ? { node: merge(p.node, q.node, opt), opt: p.opt || q.opt } : { node: p.node, opt: true });
    }
    for (const [key, q] of b.props) if (!a.props.has(key)) props.set(key, { node: q.node, opt: true });
    return { k: 'object', props };
  }

  function addMember(list, x, opt) {
    const i = list.findIndex((y) => y.k === x.k && (x.k !== 'object' || opt || keySig(y) === keySig(x)));
    if (i < 0) list.push(x);
    else if (x.k === 'array') list[i] = { k: 'array', el: mergeEl(list[i].el, x.el, opt) };
    else if (x.k === 'object') list[i] = mergeObj(list[i], x, opt);
  }

  function merge(a, b, opt) {
    const list = members(a).slice();
    for (const x of members(b)) addMember(list, x, opt);
    return list.length === 1 ? list[0] : { k: 'union', m: list };
  }

  // ---- naming ----------------------------------------------------------------------
  const isIdent = (s) => IDENT_RE.test(s);
  const propKey = (k) => (isIdent(k) ? k : JSON.stringify(k));

  // "user_name" / "userName" / "user-name" -> "UserName"; Unicode letters (e.g. Bangla) are kept.
  function pascal(s) {
    const parts = String(s).match(/[\p{L}\p{N}\p{M}]+/gu) || [];
    let out = parts.map((p) => p[0].toUpperCase() + p.slice(1)).join('');
    if (/^\p{N}/u.test(out)) out = '_' + out;
    return out;
  }

  // Naive English singular for array element names: "addresses" -> "Address", "categories" -> "Category".
  function singular(name) {
    if (/[^s]ies$/.test(name)) return name.slice(0, -3) + 'y';
    if (/(sses|xes|zes|ches|shes)$/.test(name)) return name.slice(0, -2);
    if (/[^s]s$/.test(name) && !/(us|is)$/.test(name)) return name.slice(0, -1);
    return name;
  }

  // ---- rendering -------------------------------------------------------------------
  function generate(value, options) {
    const o = Object.assign({ rootName: 'Root', style: 'interface', exportTypes: true, optional: true, readonly: false }, options);
    const rootName = pascal(o.rootName) || 'Root';
    const exp = o.exportTypes ? 'export ' : '';
    const ro = o.readonly ? 'readonly ' : '';
    const tree = infer(value, o.optional);

    const taken = new Set([rootName, ...GLOBALS]);
    const bySig = new Map();
    const decls = [];

    function uniqueName(hint) {
      const base = pascal(hint) || 'Type';
      let name = base;
      for (let n = 2; taken.has(name); n++) name = base + n;
      taken.add(name);
      return name;
    }

    function body(node) {
      const lines = [];
      for (const [key, p] of node.props) {
        lines.push('  ' + ro + propKey(key) + (p.opt ? '?' : '') + ': ' + render(p.node, key) + ';');
      }
      return lines.join('\n');
    }

    function declare(name, b) {
      return o.style === 'type'
        ? exp + 'type ' + name + ' = {\n' + b + '\n};'
        : exp + 'interface ' + name + ' {\n' + b + '\n}';
    }

    // mode: undefined (nested), 'decl' (the root object), 'rootArray' (hint is already the element name)
    function render(node, hint, mode) {
      switch (node.k) {
        case 'string': case 'number': case 'boolean': case 'null': return node.k;
        case 'array': {
          if (node.el === null) return ro + 'unknown[]';
          const inner = render(node.el, mode === 'rootArray' ? hint : singular(pascal(hint)));
          return ro + (node.el.k === 'union' ? '(' + inner + ')' : inner) + '[]';
        }
        case 'union': {
          const parts = [...node.m].sort((a, b) => RANK[a.k] - RANK[b.k]).map((m) => render(m, hint, mode));
          return [...new Set(parts)].join(' | ');
        }
        default: {
          if (node.props.size === 0) return 'Record<string, unknown>';
          const b = body(node);
          if (mode === 'decl') { decls.unshift(declare(rootName, b)); return rootName; }
          if (bySig.has(b)) return bySig.get(b);
          const name = uniqueName(hint);
          bySig.set(b, name);
          decls.push(declare(name, b));
          return name;
        }
      }
    }

    if (tree.k === 'object' && tree.props.size > 0) {
      render(tree, rootName, 'decl');
    } else if (tree.k === 'array') {
      const ty = render(tree, rootName + 'Item', 'rootArray');
      decls.unshift(exp + 'type ' + rootName + ' = ' + ty + ';');
    } else {
      decls.unshift(exp + 'type ' + rootName + ' = ' + render(tree, rootName) + ';');
    }
    return decls.join('\n\n') + '\n';
  }

  // ---- text entry point --------------------------------------------------------------
  function errorLocation(err, text) {
    const msg = String((err && err.message) || '');
    let m = msg.match(/line (\d+) column (\d+)/);
    if (m) return { line: +m[1], col: +m[2] };
    m = msg.match(/position (\d+)/);
    if (m) {
      const before = text.slice(0, +m[1]).split('\n');
      return { line: before.length, col: before[before.length - 1].length + 1 };
    }
    return null;
  }

  // Returns { ok:true, code } or { ok:false, empty?:true, message, line?, col? }.
  function fromText(text, options) {
    if (!String(text).trim()) return { ok: false, empty: true, message: '' };
    let value;
    try {
      value = JSON.parse(text);
    } catch (err) {
      const loc = errorLocation(err, text);
      return Object.assign({ ok: false, message: err.message }, loc || {});
    }
    return { ok: true, code: generate(value, options) };
  }

  const api = { generate, fromText, errorLocation, isIdent, pascal, singular };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.JBTS = api;
})(typeof self !== 'undefined' ? self : this);
