// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
/**
 * The one formatting of a data file (spec §3.2): two-space indent, one key per line, keys in schema
 * order, a trailing newline. Names (items, fields, sheet keys) keep the order the author gave them:
 * a travels table's field order is its C block order.
 */

const ORDER = {
  item: ['kind', 'doc', 'why', 'unit', 'plugin', 'header', 'prefix', 'source', 'value', 'values', 'fields', 'travel', 'params', 'c'],
  travel: ['min', 'max', 'step', 'unit', 'default', 'defaultFrom', 'byKind', 'doc', 'why'],
  param: ['symbol', 'from', 'forKind', 'flags', 'scale', 'since', 'doc'],
  c: ['alias', 'render'],
  alias: ['fact', 'field'],
  number: ['ref', 'derive', 'of', 'order'],
};

function ordered(obj, order) {
  const known = order.filter((k) => k in obj);
  const rest = Object.keys(obj).filter((k) => !order.includes(k));
  return Object.fromEntries([...known, ...rest].map((k) => [k, obj[k]]));
}

const isObj = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);

function number(v) {
  if (!isObj(v)) return v;
  return Object.fromEntries(Object.entries(ordered(v, ORDER.number)).map(([k, x]) => [k, number(x)]));
}

function sheet(v) {
  if (!isObj(v) || 'ref' in v || 'derive' in v) return number(v);
  return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, sheet(x)]));
}

function travel(t) {
  const o = ordered(t, ORDER.travel);
  for (const k of ['min', 'max', 'step', 'default']) if (k in o) o[k] = number(o[k]);
  if (isObj(o.byKind)) o.byKind = Object.fromEntries(Object.entries(o.byKind).map(([k, x]) => [k, number(x)]));
  return o;
}

function item(it) {
  if (!isObj(it)) return it;
  const o = ordered(it, ORDER.item);
  if ('value' in o) o.value = o.kind === 'sheet' ? sheet(o.value) : number(o.value);
  if (isObj(o.fields)) o.fields = Object.fromEntries(Object.entries(o.fields).map(([k, t]) => [k, isObj(t) ? travel(t) : t]));
  if (isObj(o.travel)) o.travel = travel(o.travel);
  if (Array.isArray(o.params)) o.params = o.params.map((p) => (isObj(p) ? ordered(p, ORDER.param) : p));
  if (isObj(o.c)) {
    o.c = ordered(o.c, ORDER.c);
    if (isObj(o.c.alias)) o.c.alias = ordered(o.c.alias, ORDER.alias);
  }
  return o;
}

/** The canonical text of a parsed data file. */
export function formatDoc(doc) {
  const out = {};
  if ('$schema' in doc) out.$schema = doc.$schema;
  for (const [k, v] of Object.entries(doc)) if (k !== '$schema') out[k] = item(v);
  return `${JSON.stringify(out, null, 2)}\n`;
}
