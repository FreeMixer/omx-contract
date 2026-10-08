// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
/**
 * `omx-contract validate`: the schema, then the checks a schema cannot express (spec §3.3): every
 * reference resolves with no cycle; every default inside its travel; every C name the render spells
 * is unique; an item's `c.alias` names no other item. Each failure names file, item and rule.
 */
import { readFileSync } from 'node:fs';
import { posix } from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import { resolveData } from './data.mjs';
import { eqDefaultBands, eqDefaultParams } from './eq-defaults.mjs';
import { renderC } from '../render/c.mjs';
import { renderTs } from '../render/ts.mjs';

const SCHEMA = JSON.parse(readFileSync(new URL('../schema/omx-contract.schema.json', import.meta.url), 'utf8'));
let compiled;
/** The compiled schema validator. */
export function schemaValidator() {
  if (!compiled) compiled = new Ajv2020({ allErrors: true, strict: true, strictRequired: false, allowUnionTypes: true }).compile(SCHEMA);
  return compiled;
}

const constCase = (s) => s.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toUpperCase();

/**
 * The rules about the meaning of the numbers, not their shape (they live with the data they judge):
 * a set's default and labels; a travel's scale is a PARAM_SCALES id; the EQ band counts and budget; the
 * default EQ rule's inputs.
 */
function semanticRules(resolved, say) {
  const val = (name) => resolved.get(name)?.value;
  for (const r of resolved.values()) {
    if (r.kind === 'set') {
      if (r.default !== undefined && !r.value.includes(r.default)) say(r.rel, r.name, 'set-default', `default ${JSON.stringify(r.default)} is not one of ${JSON.stringify(r.value)}`);
      if (r.labels !== undefined && r.labels.length !== r.value.length) say(r.rel, r.name, 'set-labels', `${r.labels.length} labels for ${r.value.length} ids`);
    }
    const travels = r.kind === 'travels' ? (r.shape === 'table' ? Object.entries(r.value) : [['', r.value]]) : [];
    for (const [field, t] of travels) {
      if (t.scale !== undefined && !(val('PARAM_SCALES') ?? []).includes(t.scale)) say(r.rel, r.name, 'scale', `${field ? `${r.name}.${field}` : r.name}: scale ${JSON.stringify(t.scale)} is not an id of PARAM_SCALES`);
    }
  }

  // The EQ band budget (ruling 2026-10-08): what the operator keeps, what the feedback suppressor plants
  // and what the ring correction plants all fit in the band maximum.
  const reserve = val('OPERATOR_EQ_BANDS_RESERVE');
  if (reserve !== undefined) {
    const need = reserve + val('FBS_DEFAULT_MAX_AUTO_BANDS') + val('HRP_DEFAULT_MAX_AUTO_BANDS');
    const cap = val('EQ_MAX_BANDS');
    if (!(need <= cap)) say(resolved.get('OPERATOR_EQ_BANDS_RESERVE').rel, 'OPERATOR_EQ_BANDS_RESERVE', 'eq-band-budget',
      `OPERATOR_EQ_BANDS_RESERVE ${reserve} + FBS_DEFAULT_MAX_AUTO_BANDS ${val('FBS_DEFAULT_MAX_AUTO_BANDS')} + HRP_DEFAULT_MAX_AUTO_BANDS ${val('HRP_DEFAULT_MAX_AUTO_BANDS')} = ${need} exceeds EQ_MAX_BANDS ${cap}`);
  }
  const counts = val('EQ_BAND_COUNTS');
  if (counts) {
    const rel = resolved.get('EQ_BAND_COUNTS').rel;
    for (const [strip, c] of Object.entries(counts)) {
      for (const k of ['default', 'max']) if (!Number.isInteger(c[k]) || c[k] < 1) say(rel, 'EQ_BAND_COUNTS', 'eq-band-counts', `${strip}.${k} ${c[k]} is not a positive integer`);
      if (c.default > c.max) say(rel, 'EQ_BAND_COUNTS', 'eq-band-counts', `${strip}: default ${c.default} exceeds max ${c.max}`);
    }
  }

  // The default EQ rule: its inputs are consistent and it answers for every declared default count.
  if (resolved.has('EQ_DEFAULT_CENTRES_FOUR_BAND_HZ')) {
    const rel = resolved.get('EQ_DEFAULT_CENTRES_FOUR_BAND_HZ').rel;
    const bad = (rule, message) => say(rel, 'EQ_DEFAULT_CENTRES_FOUR_BAND_HZ', rule, message);
    let p;
    try { p = eqDefaultParams(resolved); } catch (e) { bad('eq-default-rule', e.message); return; }
    const [r10, r20] = p.series;
    if (p.four.length !== 4) bad('eq-default-rule', `the four-band set holds ${p.four.length} centres`);
    for (const [name, list] of [['four-band set', p.four], ['R10', r10], ['R20', r20]]) {
      if (!list.every((f, i) => f >= p.lo && f <= p.hi && (i === 0 || f > list[i - 1]))) bad('eq-default-rule', `the ${name} is not ascending inside [${p.lo}, ${p.hi}] Hz`);
    }
    for (const f of [...p.four, ...r10]) if (!r20.includes(f)) bad('eq-default-rule', `${f} Hz is not in the R20 series: R10 and the four-band set are preferred values of it`);
    const types = val('EQ_BAND_TYPES') ?? [];
    for (const id of ['bell', 'lowShelf', 'highShelf']) if (!types.includes(id)) bad('eq-default-rule', `EQ_BAND_TYPES lacks ${id}, which the default rule uses`);
    for (const [strip, c] of Object.entries(counts ?? {})) {
      try { eqDefaultBands(c.default, p); } catch (e) { bad('eq-default-rule', `${strip}: ${e.message}`); }
    }
  }
}

/** Every problem of the loaded data: `[{ file, item, rule, message }]`; empty is valid. */
export function validateData(data) {
  const problems = [];
  const say = (file, item, rule, message) => problems.push({ file, item, rule, message });
  const validate = schemaValidator();
  for (const f of data.files) {
    const depth = f.rel.split('/').length - 1;
    const want = posix.join(...Array(depth).fill('..'), 'schema/omx-contract.schema.json');
    if (f.doc.$schema !== want) say(f.rel, '-', 'schema-path', `"$schema" must be "${want}"`);
    if (!validate(f.doc)) {
      for (const e of validate.errors) {
        const item = e.instancePath.split('/')[1] || '-';
        say(f.rel, item, 'schema', `${e.instancePath || '/'} ${e.message}${e.params?.allowedValues ? ` (${e.params.allowedValues.join(', ')})` : ''}`);
      }
    }
  }
  if (problems.length) return problems;

  let resolved;
  try {
    resolved = resolveData(data);
  } catch (e) {
    const name = /^(\w+)/.exec(e.message)?.[1] ?? '-';
    say(data.items.get(name)?.rel ?? '-', name, 'reference', e.message);
    return problems;
  }

  for (const r of resolved.values()) {
    const travels = r.kind === 'travels' ? (r.shape === 'table' ? Object.entries(r.value) : [['', r.value]]) : [];
    for (const [field, t] of travels) {
      const at = field ? `${r.name}.${field}` : r.name;
      for (const k of ['min', 'max', 'step', 'default']) {
        if (t[k] !== undefined && (typeof t[k] !== 'number' || !Number.isFinite(t[k]))) say(r.rel, r.name, 'finite', `${at}.${k} resolves to ${JSON.stringify(t[k])}`);
      }
      if (!(t.min <= t.max)) say(r.rel, r.name, 'travel-order', `${at}: min ${t.min} > max ${t.max}`);
      if (t.step !== undefined && t.step < 0) say(r.rel, r.name, 'step', `${at}: step ${t.step} < 0`);
      if (t.default !== undefined && !(t.default >= t.min && t.default <= t.max)) say(r.rel, r.name, 'default-inside', `${at}: default ${t.default} outside [${t.min}, ${t.max}]`);
      for (const [kind, v] of Object.entries(t.byKind ?? {})) {
        if (!(v >= t.min && v <= t.max)) say(r.rel, r.name, 'default-inside', `${at}.byKind.${kind}: ${v} outside [${t.min}, ${t.max}]`);
      }
    }
    if (r.c?.alias) {
      const spelled = `${r.c.alias.fact.toUpperCase()}_${constCase(r.c.alias.field)}`;
      if (resolved.has(spelled)) say(r.rel, r.name, 'alias', `c.alias spells ${spelled}, which is another item`);
      if (r.shape !== 'travel') say(r.rel, r.name, 'alias', 'c.alias is for a single travel');
    }
    if (typeof r.doc !== 'string' || !r.doc.trim()) say(r.rel, r.name, 'doc', 'every item carries its doc');
  }

  semanticRules(resolved, say);

  for (const [target, files] of [['c', () => renderC(resolved)], ['ts', () => renderTs(resolved)]]) {
    let out;
    try {
      out = files();
    } catch (e) {
      say('-', '-', `render-${target}`, e.message);
      continue;
    }
    if (target !== 'c') continue;
    for (const f of out) {
      const seen = new Map();
      for (const m of f.text.matchAll(/^(?:#define |  )(OMX_\w+)(?= = |\s)/gm)) {
        if (seen.has(m[1])) say('-', m[1], 'c-name-unique', `${f.path} defines ${m[1]} twice`);
        seen.set(m[1], true);
      }
    }
  }
  return problems;
}
