// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
/**
 * The one formatting of a data file: two-space indent, one key per line, keys in schema
 * order, a trailing newline. Names (items, fields, sheet keys) keep the order the author gave them:
 * a travels table's field order is its C block order. A kernel file's sections come in their order (controls,
 * readouts, tables, aggregates, constants), its controls and readouts in the author's order, each one's keys in
 * schema order.
 */

import { FILE_KEYS } from './data.mjs';

const ORDER = {
  control: ['name', 'kind', 'global', 'table', 'rearms', 'since', 'source', 'doc', 'why', 'unit', 'ids', 'default', 'labels', 'travel', 'c'],
  sections: ['controls', 'readouts', 'tables', 'aggregates', 'constants'],
  readout: ['name', 'doc', 'unit', 'min', 'max', 'scale', 'rateHz'],
  item: ['kind', 'since', 'source', 'doc', 'why', 'format', 'spec', 'version', 'deprecated', 'groups', 'axes', 'unit', 'value', 'docs', 'values', 'ids', 'default', 'labels', 'fields', 'travel', 'codes', 'words', 'terms', 'rows', 'c'],
  word: ['word', 'group', 'x', 'y', 'unit', 'scale', 'from', 'doc'],
  row: ['term', 'from', 'word', 'extension', 'dropped', 'doc'],
  rowWord: ['word', 'transform', 'values', 'factor'],
  term: ['uri', 'id', 'value', 'kind', 'status', 'by', 'issue', 'ruling', 'word', 'deprecated'],
  travel: ['min', 'max', 'step', 'unit', 'default', 'defaultFrom', 'scale', 'byKind', 'doc', 'why'],
  c: ['render'],
  number: ['ref', 'derive', 'of', 'order'],
  source: ['from', 'impl', 'at'],
  renderHeader: ['header', 'guard', 'project', 'banner', 'brief', 'includes', 'scope', 'numbers', 'codes', 'scalars', 'limits'],
  renderSection: ['comment', 'prefix', 'omit', 'levels'],
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
  if (isObj(o.source)) o.source = ordered(o.source, ORDER.source);
  if ('value' in o) o.value = o.kind === 'sheet' ? sheet(o.value) : number(o.value);
  if (isObj(o.codes)) o.codes = Object.fromEntries(Object.entries(o.codes).map(([k, c]) => [k, ordered(c, ['code', 'doc'])]));
  // a vocabulary's words keep their declared order, which is part of the contract (a rating's severity, a band's
  // ascent); a format's terms are sorted by name, the order a reviewer reads them against the format one at a time
  if (o.kind === 'words' && isObj(o.words)) o.words = Object.fromEntries(Object.entries(o.words).map(([k, w]) => [k, isObj(w) ? ordered(w, ORDER.word) : w]));
  if (o.kind === 'terms' && isObj(o.terms)) o.terms = Object.fromEntries(Object.keys(o.terms).sort().map((k) => [k, isObj(o.terms[k]) ? ordered(o.terms[k], ORDER.term) : o.terms[k]]));
  // a format map's rows are sorted by source field, as a format's terms are
  if (o.kind === 'formatMap' && isObj(o.rows)) {
    o.rows = Object.fromEntries(Object.keys(o.rows).sort().map((k) => {
      const row = isObj(o.rows[k]) ? ordered(o.rows[k], ORDER.row) : o.rows[k];
      if (isObj(row?.word)) row.word = ordered(row.word, ORDER.rowWord);
      return [k, row];
    }));
  }
  if (isObj(o.fields)) o.fields = Object.fromEntries(Object.entries(o.fields).map(([k, t]) => [k, isObj(t) ? travel(t) : t]));
  if (isObj(o.travel)) o.travel = travel(o.travel);
  if (isObj(o.c)) o.c = ordered(o.c, ORDER.c);
  return o;
}

function control(c) {
  if (!isObj(c)) return c;
  const o = ordered(c, ORDER.control);
  if (isObj(o.source)) o.source = ordered(o.source, ORDER.source);
  if (isObj(o.travel)) o.travel = travel(o.travel);
  if (isObj(o.c)) o.c = item({ c: o.c }).c;
  return o;
}

function readout(r) {
  if (!isObj(r)) return r;
  const o = ordered(r, ORDER.readout);
  for (const k of ['min', 'max', 'rateHz']) if (k in o) o[k] = number(o[k]);
  return o;
}

function render(r) {
  if (!isObj(r)) return r;
  const out = ordered(r, ['c', 'ts']);
  if (Array.isArray(out.c)) {
    out.c = out.c.map((h) => {
      if (!isObj(h)) return h;
      const o = ordered(h, ORDER.renderHeader);
      for (const k of ['numbers', 'codes', 'scalars', 'limits']) if (isObj(o[k])) o[k] = ordered(o[k], ORDER.renderSection);
      return o;
    });
  }
  return out;
}

const items = (m) => (isObj(m) ? Object.fromEntries(Object.entries(m).map(([k, v]) => [k, item(v)])) : m);

/** The canonical text of a parsed data file. */
export function formatDoc(doc) {
  const out = {};
  // the file keys first: $schema, then what the file requires and where its definitions come from
  for (const k of FILE_KEYS) if (k in doc) out[k] = k === 'source' && isObj(doc.source) ? ordered(doc.source, ORDER.source) : k === 'render' ? render(doc.render) : doc[k];
  if (ORDER.sections.some((k) => k in doc)) {
    for (const [k, v] of Object.entries(ordered(doc, ORDER.sections))) {
      if (FILE_KEYS.includes(k)) continue;
      if (k === 'controls' && Array.isArray(v)) out[k] = v.map(control);
      else if (k === 'readouts' && Array.isArray(v)) out[k] = v.map(readout);
      else out[k] = ORDER.sections.includes(k) ? items(v) : item(v);
    }
  } else {
    for (const [k, v] of Object.entries(doc)) if (!FILE_KEYS.includes(k)) out[k] = item(v);
  }
  return `${JSON.stringify(out, null, 2)}\n`;
}
