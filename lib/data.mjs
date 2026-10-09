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
    for (const [name, item] of entriesOf(rel, doc)) {
      if (items.has(name)) throw new Error(`${rel}: ${name}: already declared by ${items.get(name).rel}`);
      items.set(name, { name, rel, item });
    }
  }
  return { files, items };
}

const snakeOf = (n) => n.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toUpperCase();
const camelOf = (u) => u.toLowerCase().replace(/_([a-z0-9])/g, (_, x) => x.toUpperCase());

/** The four sections of a kernel file, in their order. */
export const KERNEL_SECTIONS = ['controls', 'tables', 'aggregates', 'constants'];

/** Whether a data file is a kernel file (`kernels/<kernel>.json`), which holds the four sections, never an item map. */
export const isKernelFile = (rel) => /(^|\/)kernels\/[^/]+\.json$/.test(rel);

/** The kernel's upper-case prefix, read off its file name: `kernels/band_dyn.json` is BAND_DYN. */
export const kernelPrefix = (rel) => rel.replace(/^.*\//, '').replace(/\.json$/, '').toUpperCase().replace(/-/g, '_');

/**
 * Whether a control is a USE: it declares no travel and no ids of its own and takes its values from the item its
 * `global` names, which another control of the same kernel declares (the EQ's lpfSlope takes FILTER_SLOPES, which
 * hpfSlope declares). A use adds no item; it is a control of the kernel all the same.
 */
export const isUse = (c) => c && !c.table && c.travel === undefined && c.ids === undefined && typeof c.global === 'string';

/** A control's item name: its `global`, else <KERNEL>_<NAME>_RANGE for a travel and <KERNEL>_<NAME>S for a choice. */
export const controlGlobal = (rel, c) => c.global ?? `${kernelPrefix(rel)}_${snakeOf(c.name)}${c.kind === 'choice' ? 'S' : '_RANGE'}`;

/**
 * A data file's items as [name, item] pairs. A kernel file's four sections are expanded into the items the renders
 * read: a travel control is a `travels` item named by controlGlobal, a choice a `set`; the controls of one `table`
 * regroup into that table's `travels` item with `fields`; an aggregate is regenerated as fields that reference its
 * controls; constants pass through. Any other top-level key of a kernel file is not read (validation names it).
 * rates.json and primitives.json are item maps, read as they are.
 */
export function entriesOf(rel, doc) {
  if (!isKernelFile(rel)) return Object.entries(doc).filter(([name]) => name !== '$schema');
  const out = [];
  const controls = Array.isArray(doc.controls) ? doc.controls : [];
  const tables = new Map(Object.entries(doc.tables ?? {}).map(([n, meta]) => [n, { kind: 'travels', ...meta, fields: {} }]));
  const placed = new Set();
  for (const c of controls) {
    const { name, kind, global, table, rearms, count, of, when, ...rest } = c;
    if (isUse(c)) continue;
    if (table) {
      if (!tables.has(table)) throw new Error(`${rel}: control ${name} names table ${table}, which is not declared`);
      // a table is an item where its first control stands, so a control after a table keeps its place
      if (!placed.has(table)) { placed.add(table); out.push([table, tables.get(table)]); }
      tables.get(table).fields[name] = rest.travel;
      continue;
    }
    out.push([controlGlobal(rel, c), kind === 'choice' ? { kind: 'set', ...rest } : { kind: 'travels', ...rest }]);
  }
  for (const [n, t] of tables) if (!placed.has(n)) out.push([n, t]);
  const byName = new Map(controls.map((c) => [c.name, c]));
  for (const [n, a] of Object.entries(doc.aggregates ?? {})) {
    const { fields, ...meta } = a;
    out.push([n, { kind: 'travels', ...meta, fields: Object.fromEntries((fields ?? []).map((f) => {
      if (!byName.has(f)) throw new Error(`${rel}: aggregate ${n} names control ${f}, which is not declared`);
      return [f, { ref: controlGlobal(rel, byName.get(f)) }];
    })) }]);
  }
  for (const [n, item] of Object.entries(doc.constants ?? {})) out.push([n, item]);
  return out;
}

/** A kernel's name, read off its file name: `kernels/band_dyn.json` is band_dyn. */
export const kernelName = (rel) => rel.replace(/^.*\//, '').replace(/\.json$/, '');

/**
 * Every kernel's controls, in its file's order: `{ <kernel>: { controls: [{ name, kind, global, table?, rearms?, count?, when? }] } }`,
 * kernels in file order. `global` is the item the control's value lives in: its own travel or set, or, for a field of
 * a table, the table (`table` names it too, and the field is the control's name). `rearms` is carried only when true:
 * changing the control re-arms the kernel's state, it is not a smooth parameter. `count` names the item that counts a
 * control the kernel takes once per band (a scalar, or a sheet whose every variant gives its count as `max`). A
 * control that declares `of` is no control of its own but the travel the control it names reaches while the choice
 * `when` names holds the id it names: it is listed under that control's `when` as `{ control, is, global }`.
 */
export function kernelControls(data) {
  const out = {};
  for (const f of data.files) {
    if (!isKernelFile(f.rel)) continue;
    const controls = Array.isArray(f.doc.controls) ? f.doc.controls : [];
    const global = (c) => c.table ?? controlGlobal(f.rel, c);
    out[kernelName(f.rel)] = {
      controls: controls.filter((c) => c.of === undefined).map((c) => {
        const when = controls.filter((x) => x.of === c.name).map((x) => ({ control: x.when.control, is: x.when.is, global: global(x) }));
        return {
          name: c.name,
          kind: c.kind,
          global: global(c),
          ...(c.table ? { table: c.table } : {}),
          ...(c.rearms === true ? { rearms: true } : {}),
          ...(c.count !== undefined ? { count: c.count } : {}),
          ...(when.length ? { when } : {}),
        };
      }),
    };
  }
  return out;
}

const isWholeRef = (v) => typeof v === 'object' && v !== null && Object.keys(v).length === 1 && typeof v.ref === 'string' && !v.ref.includes('.');

/**
 * The kernel file that declares `entries` ([name, item] pairs, the items entriesOf gives back), the inverse of
 * entriesOf: a single travel is a travel control and a set a choice; a fields table whose every field IS a single
 * travel of the kernel (`{ ref }`) is an aggregate, and its field names name those controls; any other fields table
 * is a table whose fields are its controls; every other item is a constant. A control's `global` is written only
 * when its name does not derive it. `kept`, a kernel file already written, is extended: its declarations stay as
 * they are and the entries it lacks are added. Empty sections are left out.
 * @throws naming the item: a fields table that mixes references and travels, an aggregate field whose name is not
 * its control's.
 */
export function kernelDocOf(rel, entries, kept) {
  const K = kernelPrefix(rel);
  const doc = kept ? JSON.parse(JSON.stringify(kept)) : {};
  doc.controls ??= [];
  for (const s of KERNEL_SECTIONS.slice(1)) doc[s] ??= {};
  const declared = new Set(entriesOf(rel, kept ?? {}).map(([n]) => n));
  const singles = new Map(entries.filter(([, it]) => (it.kind === 'travels' && it.travel) || it.kind === 'set'));
  for (const c of doc.controls) if (!c.table) singles.set(controlGlobal(rel, c), c);
  const isAggregate = (it) => it.kind === 'travels' && it.fields && Object.values(it.fields).length > 0 && Object.values(it.fields).every((f) => isWholeRef(f) && singles.get(f.ref)?.travel);
  // an aggregate's field names are its controls' names
  const named = new Map();
  for (const [n, it] of entries) if (isAggregate(it)) for (const [f, t] of Object.entries(it.fields)) named.set(t.ref, f);
  for (const [n, it] of entries) {
    if (declared.has(n)) continue;
    if ((it.kind === 'travels' && it.travel) || it.kind === 'set') {
      const { kind, ...rest } = it;
      const ck = kind === 'set' ? 'choice' : 'travel';
      const suffix = ck === 'choice' ? 'S' : '_RANGE';
      const derived = n.startsWith(`${K}_`) && n.endsWith(suffix) && n.length > K.length + 1 + suffix.length ? camelOf(n.slice(K.length + 1, -suffix.length)) : undefined;
      const c = { name: named.get(n) ?? derived ?? camelOf(n.endsWith(suffix) ? n.slice(0, -suffix.length) : n), kind: ck };
      if (controlGlobal(rel, c) !== n) c.global = n;
      doc.controls.push({ ...c, ...rest });
    } else if (it.kind === 'travels' && it.fields && isAggregate(it)) {
      const { kind, fields, ...meta } = it;
      doc.aggregates[n] = { ...meta, fields: Object.entries(fields).map(([f, t]) => {
        const c = doc.controls.find((x) => !x.table && controlGlobal(rel, x) === t.ref) ?? { name: named.get(t.ref) };
        if (c.name !== f) throw new Error(`${rel}: ${n}.${f} refers to ${t.ref}, whose control is named ${c.name}: an aggregate's field is named by its control`);
        return f;
      }) };
    } else if (it.kind === 'travels' && it.fields) {
      const { kind, fields, ...meta } = it;
      if (Object.values(fields).some(isWholeRef)) throw new Error(`${rel}: ${n} mixes fields that refer to single travels with travels of its own: declare it as an aggregate of controls, or as a table`);
      doc.tables[n] = meta;
      for (const [f, travel] of Object.entries(fields)) doc.controls.push({ name: f, kind: 'travel', table: n, travel });
    } else {
      doc.constants[n] = it;
    }
  }
  for (const s of KERNEL_SECTIONS) if (s === 'controls' ? !doc[s].length : !Object.keys(doc[s]).length) delete doc[s];
  return doc;
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
 * every `{ref}` and `{derive}` evaluated. The returned map also carries `kernels`, every kernel's ordered controls
 * (kernelControls), which the json render publishes beside the items.
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
      if (item.default !== undefined) r.default = setDefault(item, (v) => val(v, name), name);
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
  out.kernels = kernelControls(data);
  return out;
}

/**
 * A set's default, resolved: an id as written, or `{ ref }` to the scalar that states it. A boolean scalar names the
 * second id of a two-id switch when true and the first when false (FX_DELAY_PINGPONG_DEFAULT is the delay's
 * DELAY_PINGPONG_SWITCH default, so the come-up value keeps one home).
 * @throws naming the set: a boolean default of a set that is not two ids.
 */
export function setDefault(item, val, name) {
  if (!isObj(item.default)) return item.default;
  const v = val(item.default);
  if (typeof v !== 'boolean') return v;
  if (item.ids.length !== 2) throw new Error(`${name}: a boolean default needs a two-id switch, not ${item.ids.length} ids`);
  return item.ids[v ? 1 : 0];
}

/** The package version (package.json), which names the tag, the release and the npm version. */
export function packageVersion(root) {
  return JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version;
}
