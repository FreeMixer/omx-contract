// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
/**
 * `omx-contract semver`: classify every change between two resolved declarations (spec §3.6) and
 * refuse a version whose bump is shorter than the largest class found.
 *
 *   major  an item, field, parameter or alias removed; a unit or kind changed; a travel narrowed; a
 *          plugin's parameters reordered or changed; a constant a kernel computes with changed (a
 *          scalar, sheet leaf or derived value that is not a travel bound or default; a list member
 *          changed or removed)
 *   minor  an item, field, sheet leaf, parameter or list member added (appended); a travel widened;
 *          a default moved inside its travel; a step changed
 *   patch  doc and why text
 */

const RANK = { none: 0, patch: 1, minor: 2, major: 3 };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function travelChanges(at, a, b, say) {
  if (b.min > a.min) say('major', `${at}: travel narrowed (min ${a.min} -> ${b.min})`);
  if (b.max < a.max) say('major', `${at}: travel narrowed (max ${a.max} -> ${b.max})`);
  if (b.min < a.min || b.max > a.max) say('minor', `${at}: travel widened ([${a.min}, ${a.max}] -> [${b.min}, ${b.max}])`);
  if (a.unit !== b.unit) say('major', `${at}: unit ${JSON.stringify(a.unit)} -> ${JSON.stringify(b.unit)}`);
  if (a.default !== b.default) say(a.default === undefined || b.default === undefined ? 'major' : 'minor', `${at}: default ${a.default} -> ${b.default}`);
  if (a.step !== b.step) say('minor', `${at}: step ${a.step} -> ${b.step}`);
  if (a.defaultFrom !== b.defaultFrom) say('minor', `${at}: defaultFrom ${a.defaultFrom} -> ${b.defaultFrom}`);
  const ka = a.byKind ?? {};
  const kb = b.byKind ?? {};
  for (const k of Object.keys(ka)) if (!(k in kb)) say('major', `${at}.byKind.${k} removed`);
  for (const k of Object.keys(kb)) {
    if (!(k in ka)) say('minor', `${at}.byKind.${k} added`);
    else if (ka[k] !== kb[k]) say('minor', `${at}.byKind.${k}: ${ka[k]} -> ${kb[k]}`);
  }
  if ((a.doc ?? '') !== (b.doc ?? '') || (a.why ?? '') !== (b.why ?? '')) say('patch', `${at}: doc`);
}

function leafChanges(at, a, b, say) {
  if (typeof a === 'object' && a !== null && typeof b === 'object' && b !== null) {
    for (const k of Object.keys(a)) {
      if (!(k in b)) say('major', `${at}.${k} removed`);
      else leafChanges(`${at}.${k}`, a[k], b[k], say);
    }
    for (const k of Object.keys(b)) if (!(k in a)) say('minor', `${at}.${k} added`);
  } else if (a !== b) {
    say('major', `${at}: ${JSON.stringify(a)} -> ${JSON.stringify(b)} (a constant a kernel computes with)`);
  }
}

/** `{ level, changes: [{ level, item, what }] }` from `prev` to `next` (Maps name -> resolved item). */
export function classify(prev, next) {
  const changes = [];
  for (const [name, a] of prev) {
    const say = (level, what) => changes.push({ level, item: name, what });
    const b = next.get(name);
    if (!b) { say('major', 'item removed or renamed'); continue; }
    if (a.kind !== b.kind || (a.shape ?? '') !== (b.shape ?? '')) { say('major', `kind ${a.kind} -> ${b.kind}`); continue; }
    if ((a.unit ?? '') !== (b.unit ?? '')) say('major', `unit ${JSON.stringify(a.unit)} -> ${JSON.stringify(b.unit)}`);
    if (a.doc !== b.doc || (a.why ?? '') !== (b.why ?? '')) say('patch', 'doc');
    if (!same(a.c?.alias, b.c?.alias)) say(a.c?.alias ? 'major' : 'minor', a.c?.alias ? 'c.alias removed or renamed' : 'c.alias added');
    if (!same(a.c?.render, b.c?.render)) say(b.c?.render === false ? 'major' : 'minor', 'C render of the list changed');
    switch (a.kind) {
      case 'travels':
        if (a.shape === 'travel') travelChanges(name, a.value, b.value, say);
        else {
          for (const f of Object.keys(a.value)) {
            if (!(f in b.value)) say('major', `${name}.${f} removed`);
            else travelChanges(`${name}.${f}`, a.value[f], b.value[f], say);
          }
          for (const f of Object.keys(b.value)) if (!(f in a.value)) say('minor', `${name}.${f} added`);
        }
        break;
      case 'scalar':
      case 'sheet':
        leafChanges(name, a.value, b.value, say);
        break;
      case 'list':
        a.value.forEach((v, i) => {
          if (i >= b.value.length) say('major', `${name}[${i}] removed`);
          else if (b.value[i] !== v) say('major', `${name}[${i}]: ${v} -> ${b.value[i]}`);
        });
        if (b.value.length > a.value.length) say('minor', `${name}: ${b.value.length - a.value.length} member(s) appended`);
        break;
      case 'plugin':
        for (const k of ['plugin', 'header', 'prefix']) if (a[k] !== b[k]) say('major', `${k} ${a[k]} -> ${b[k]}`);
        if (a.source !== b.source) say('patch', 'source text');
        a.value.forEach((p, i) => {
          const q = b.value[i];
          if (!q) say('major', `parameter ${p.symbol} removed`);
          else if (q.symbol !== p.symbol) say('major', `parameter ${i} ${p.symbol} -> ${q.symbol} (reordered or renamed)`);
          else if (!same(p, q)) say(p.min < q.min || p.max > q.max || p.unit !== q.unit || p.toggle !== q.toggle ? 'major' : 'minor', `parameter ${p.symbol} changed`);
        });
        if (b.value.length > a.value.length) say('minor', `${b.value.length - a.value.length} parameter(s) appended`);
        break;
      default:
        break;
    }
  }
  for (const name of next.keys()) if (!prev.has(name)) changes.push({ level: 'minor', item: name, what: 'item added' });
  const level = changes.reduce((m, c) => (RANK[c.level] > RANK[m] ? c.level : m), 'none');
  return { level, changes };
}

const parse = (v) => {
  const m = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(v);
  if (!m) throw new Error(`not a version: ${v}`);
  return m.slice(1).map(Number);
};

/** The class of the bump from version `from` to `to`: 'major' | 'minor' | 'patch' | 'none'; throws if `to` is lower. */
export function bumpOf(from, to) {
  const [a, b] = [parse(from), parse(to)];
  for (let i = 0; i < 3; i++) {
    if (b[i] > a[i]) return ['major', 'minor', 'patch'][i];
    if (b[i] < a[i]) throw new Error(`version ${to} is lower than ${from}`);
  }
  return 'none';
}

/** null when bumping `from` -> `to` covers `level`, else the refusal. */
export function refusal(level, from, to) {
  let bump;
  try { bump = bumpOf(from, to); } catch (e) { return e.message; }
  return RANK[bump] >= RANK[level] ? null : `the changes since ${from} are ${level.toUpperCase()}, and ${from} -> ${to} is a ${bump} bump`;
}
