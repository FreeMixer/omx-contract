// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
/**
 * `omx-contract semver`: classify every change between two resolved declarations (spec §3.6) and
 * refuse a version whose bump is shorter than the largest class found.
 *
 *   major  a field or alias removed; an item removed (MINOR in the development phase, below); a
 *          unit or kind changed; a travel narrowed; a constant a kernel computes with changed (a
 *          scalar, sheet leaf or derived value that is not a travel bound or default; a list member
 *          or set id changed or removed; a set's default added, removed; a value an id carries changed
 *          or removed)
 *   minor  an item, field, sheet leaf, list member or set id added (appended); a travel widened;
 *          a default moved inside its travel; a step changed; a set's values added
 *   patch  doc and why text
 *
 * A kernel's readouts (docs/readouts.md): one removed, renamed or moved, or its unit changed, is major (a removal is
 * minor in the development phase, as an item's is); one appended, or its range, scale or rate changed, is minor; its
 * doc is patch.
 */

const RANK = { none: 0, patch: 1, minor: 2, major: 3 };

/**
 * The development-phase rule (omx-contract spec §3.6): while every consumer of
 * omx-contract is a FreeMixer repository named here, removing an item is MINOR. The rule ends, and
 * this becomes null so a removal is MAJOR again, in the release that names the first consumer
 * outside the list. Until then a MAJOR class is released as a minor bump (see refusal).
 */
export const DEVELOPMENT_PHASE = Object.freeze({ consumers: Object.freeze(['omx-dsp', 'omx-plugins', 'openmixer']) });
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function travelChanges(at, a, b, say) {
  if (b.min > a.min) say('major', `${at}: travel narrowed (min ${a.min} -> ${b.min})`);
  if (b.max < a.max) say('major', `${at}: travel narrowed (max ${a.max} -> ${b.max})`);
  if (b.min < a.min || b.max > a.max) say('minor', `${at}: travel widened ([${a.min}, ${a.max}] -> [${b.min}, ${b.max}])`);
  if (a.unit !== b.unit) say('major', `${at}: unit ${JSON.stringify(a.unit)} -> ${JSON.stringify(b.unit)}`);
  if (a.default !== b.default) say(a.default === undefined || b.default === undefined ? 'major' : 'minor', `${at}: default ${a.default} -> ${b.default}`);
  if (a.step !== b.step) say('minor', `${at}: step ${a.step} -> ${b.step}`);
  if (a.defaultFrom !== b.defaultFrom) say('minor', `${at}: defaultFrom ${a.defaultFrom} -> ${b.defaultFrom}`);
  if (a.scale !== b.scale) say('minor', `${at}: scale ${a.scale} -> ${b.scale}`);
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

function readoutChanges(prev, next, developmentPhase, say) {
  for (const k of new Set([...Object.keys(prev), ...Object.keys(next)])) {
    const a = prev[k]?.readouts ?? [];
    const b = next[k]?.readouts ?? [];
    a.forEach((x, i) => {
      const at = `${k}.readouts.${x.name}`;
      const j = b.findIndex((y) => y.name === x.name);
      if (j < 0) {
        say(developmentPhase ? 'minor' : 'major', at, `readout removed or renamed${developmentPhase ? ' (MINOR in the development phase)' : ''}`);
        return;
      }
      const y = b[j];
      if (j !== i) say('major', at, `readout moved (id ${i} -> ${j})`);
      if (x.unit !== y.unit) say('major', at, `unit ${JSON.stringify(x.unit)} -> ${JSON.stringify(y.unit)}`);
      if (x.min !== y.min || x.max !== y.max) say('minor', at, `range [${x.min}, ${x.max}] -> [${y.min}, ${y.max}]`);
      if (x.scale !== y.scale) say('minor', at, `scale ${x.scale} -> ${y.scale}`);
      if (x.rateHz !== y.rateHz) say('minor', at, `rateHz ${x.rateHz} -> ${y.rateHz}`);
      if (x.doc !== y.doc) say('patch', at, 'doc');
    });
    for (const y of b) if (!a.some((x) => x.name === y.name)) say('minor', `${k}.readouts.${y.name}`, 'readout added');
  }
}

/** `{ level, changes: [{ level, item, what }] }` from `prev` to `next` (Maps name -> resolved item). */
export function classify(prev, next, { developmentPhase = DEVELOPMENT_PHASE } = {}) {
  const changes = [];
  for (const [name, a] of prev) {
    const say = (level, what) => changes.push({ level, item: name, what });
    const b = next.get(name);
    if (!b) {
      if (developmentPhase) say('minor', `item removed or renamed (MINOR in the development phase: every consumer is ${developmentPhase.consumers.join(', ')})`);
      else say('major', 'item removed or renamed');
      continue;
    }
    if (a.kind !== b.kind || (a.shape ?? '') !== (b.shape ?? '')) { say('major', `kind ${a.kind} -> ${b.kind}`); continue; }
    // a set that gains values gains their unit with them (minor, below); any other unit change is major
    if ((a.unit ?? '') !== (b.unit ?? '') && !(a.kind === 'set' && a.values === undefined)) say('major', `unit ${JSON.stringify(a.unit)} -> ${JSON.stringify(b.unit)}`);
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
      case 'set':
        a.value.forEach((v, i) => {
          if (i >= b.value.length) say('major', `${name}[${i}] removed`);
          else if (b.value[i] !== v) say('major', `${name}[${i}]: ${JSON.stringify(v)} -> ${JSON.stringify(b.value[i])}`);
        });
        if (b.value.length > a.value.length) say('minor', `${name}: ${b.value.length - a.value.length} id(s) appended`);
        if (a.default !== b.default) say(a.default === undefined || b.default === undefined ? 'major' : 'minor', `${name}: default ${a.default} -> ${b.default}`);
        if (!same(a.labels, b.labels)) say('patch', `${name}: labels`);
        if (a.values === undefined && b.values !== undefined) say('minor', `${name}: values added`);
        else if (a.values !== undefined && b.values === undefined) say('major', `${name}: values removed`);
        else if (a.values !== undefined) {
          a.values.forEach((v, i) => {
            if (i < b.values.length && b.values[i] !== v) say('major', `${name}: the value of ${a.value[i]}: ${v} -> ${b.values[i]} (a constant a kernel computes with)`);
          });
        }
        break;
      default:
        break;
    }
  }
  for (const name of next.keys()) if (!prev.has(name)) changes.push({ level: 'minor', item: name, what: 'item added' });
  readoutChanges(prev.kernels ?? {}, next.kernels ?? {}, developmentPhase, (level, item, what) => changes.push({ level, item, what }));
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

/**
 * null when bumping `from` -> `to` covers `level`, else the refusal. In the development phase no
 * release takes a major bump (operator ruling 2026-10-13: majors wait for the first public
 * release), so a MAJOR class is covered by a minor bump; the classes are still reported as found.
 */
export function refusal(level, from, to, { developmentPhase = DEVELOPMENT_PHASE } = {}) {
  let bump;
  try { bump = bumpOf(from, to); } catch (e) { return e.message; }
  const need = developmentPhase && level === 'major' ? 'minor' : level;
  if (RANK[bump] >= RANK[need]) return null;
  const phase = need === level ? '' : ' (at least a minor in the development phase)';
  return `the changes since ${from} are ${level.toUpperCase()}, and ${from} -> ${to} is a ${bump} bump${phase}`;
}
