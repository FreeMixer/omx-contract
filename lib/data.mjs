// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
/**
 * The declaration as data: load every `data/**.json` file, then resolve each item's references
 * and derivations into plain values. The renderers are pure functions of the resolved items.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/** Every `.json` file under `dir`, sorted by its path relative to `dir`. */
export function dataFiles(dir) {
  const out = [];
  const walk = (d) => {
    for (const f of readdirSync(d).sort()) {
      const p = join(d, f);
      if (statSync(p).isDirectory()) walk(p);
      else if (f.endsWith('.json')) out.push(p);
    }
  };
  walk(dir);
  return out.sort((a, b) => (relative(dir, a) < relative(dir, b) ? -1 : 1));
}

/**
 * The raw data: `{ files: [{ path, rel, doc }], items: Map<name, { name, rel, item }> }`, items in
 * file order then key order. `files` may be handed in as `{ rel: text }` (a tag's data, a test).
 * @throws naming the file when one is not JSON, and an item declared by two files.
 */
export function loadData(dir, texts) {
  const files = [];
  const entries = texts ? Object.entries(texts).sort(([a], [b]) => (a < b ? -1 : 1)) : dataFiles(dir).map((p) => [relative(join(dir, '..'), p), readFileSync(p, 'utf8')]);
  const items = new Map();
  for (const [rel, text] of entries) {
    let doc;
    try { doc = JSON.parse(text); } catch (e) { throw new Error(`${rel}: not JSON: ${e.message}`); }
    files.push({ rel, text, doc });
    for (const [name, item] of Object.entries(doc)) {
      if (name === '$schema') continue;
      if (items.has(name)) throw new Error(`${rel}: ${name}: already declared by ${items.get(name).rel}`);
      items.set(name, { name, rel, item });
    }
  }
  return { files, items };
}

/** An item's own value before resolution, by kind. */
export function rawValue(item) {
  switch (item.kind) {
    case 'scalar': return item.value;
    case 'travels': return item.fields ?? item.travel;
    case 'sheet': return item.value;
    case 'list': return item.values;
    case 'set': return item.ids;
    default: return undefined;
  }
}

/** The closed list of derivations (spec §3.3). A new one is a change here with its own test. */
export const DERIVATIONS = {
  count: (d, val) => {
    const v = val(typeof d.of === 'string' ? { ref: d.of } : d.of);
    if (!Array.isArray(v)) throw new Error(`count: ${JSON.stringify(d.of)} is not a list`);
    return v.length;
  },
  sqrt: (d, val) => {
    const v = val(d.of);
    if (typeof v !== 'number' || v < 0) throw new Error(`sqrt: ${JSON.stringify(d.of)} is not a non-negative number`);
    return Math.sqrt(v);
  },
  ceilSum: (d, val) => {
    const terms = d.of.map((x) => val(x));
    if (!terms.every((t) => typeof t === 'number' && Number.isFinite(t))) throw new Error(`ceilSum: ${JSON.stringify(d.of)} holds a term that is not a finite number`);
    return Math.ceil(terms.reduce((a, t) => a + t, 0));
  },
  lagrangeReadL1: (d, val) => {
    const order = val(d.order);
    if (!Number.isInteger(order) || order < 1) throw new Error(`lagrangeReadL1: order ${order} is not a positive integer`);
    return lagrangeReadL1(order);
  },
};

/** The taps of the order-`order` Lagrange fractional read at fraction `f` (the fdelay kernel's read). */
export function lagrangeReadTaps(order, f) {
  const off = Math.floor((order - 1) / 2);
  const c = [];
  for (let k = 0; k <= order; k++) {
    let num = 1;
    let den = 1;
    for (let j = 0; j <= order; j++) {
      if (j === k) continue;
      num *= f - (j - off);
      den *= k - j;
    }
    c.push(num / den);
  }
  return c;
}

/** The worst L1 norm of the read over 1024 fractions, rounded to 1e-9 (core's readKernelL1Norm). */
export function lagrangeReadL1(order) {
  const FRACTION_STEPS = 1024;
  let worst = 0;
  for (let i = 0; i < FRACTION_STEPS; i++) {
    const l1 = lagrangeReadTaps(order, i / FRACTION_STEPS).reduce((a, c) => a + Math.abs(c), 0);
    if (l1 > worst) worst = l1;
  }
  return Math.round(worst * 1e9) / 1e9;
}

const isObj = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Resolve every item: `{ name, rel, kind, doc, why?, unit?, c?, shape?, default?, labels?, value }` (default and labels: a set's), where `value` has
 * every `{ref}` and `{derive}` evaluated.
 * @throws naming the item: a reference that does not resolve, a cycle, an unknown derivation.
 */
export function resolveData(data) {
  const done = new Map();
  const busy = new Set();
  const lookup = (path, from) => {
    const [head, ...rest] = path.split('.');
    const entry = data.items.get(head);
    if (!entry) throw new Error(`${from}: reference ${path}: no item ${head}`);
    let v = resolveItem(head).value;
    for (const k of rest) {
      if (!isObj(v) || !(k in v)) throw new Error(`${from}: reference ${path}: ${head} has no ${k}`);
      v = v[k];
    }
    return v;
  };
  const val = (v, from) => {
    if (Array.isArray(v)) return v.map((x) => val(x, from));
    if (!isObj(v)) return v;
    if ('ref' in v) return lookup(v.ref, from);
    if ('derive' in v) {
      const fn = DERIVATIONS[v.derive];
      if (!fn) throw new Error(`${from}: unknown derivation ${v.derive}`);
      try { return fn(v, (x) => val(x, from)); } catch (e) { throw new Error(`${from}: ${e.message}`); }
    }
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, val(x, from)]));
  };
  function resolveItem(name) {
    if (done.has(name)) return done.get(name);
    if (busy.has(name)) throw new Error(`${name}: reference cycle through ${[...busy].join(' -> ')} -> ${name}`);
    busy.add(name);
    const { rel, item } = data.items.get(name);
    const r = { name, rel, kind: item.kind, doc: item.doc };
    if (item.why !== undefined) r.why = item.why;
    if (item.unit !== undefined) r.unit = item.unit;
    if (item.c !== undefined) r.c = item.c;
    if (item.kind === 'set') {
      if (item.default !== undefined) r.default = item.default;
      if (item.labels !== undefined) r.labels = item.labels;
    }
    if (item.kind === 'travels') r.shape = item.fields ? 'table' : 'travel';
    r.value = val(rawValue(item), name);
    busy.delete(name);
    done.set(name, r);
    return r;
  }
  const out = new Map();
  for (const name of data.items.keys()) out.set(name, resolveItem(name));
  return out;
}

/** The package version (package.json), which names the tag, the release and the npm version. */
export function packageVersion(root) {
  return JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version;
}
