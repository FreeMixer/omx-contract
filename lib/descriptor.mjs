// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
/**
 * The rules of a plugin descriptor (docs/descriptors.md) that the schema cannot state. Each problem carries the
 * CONTRACT_CODES code it is refused with; nothing classifies a problem by its text. The schema holds the words, so
 * these run on a descriptor the schema has passed.
 */
import { readFileSync } from 'node:fs';
import { CONTRACT_CODES } from './codes.mjs';
import { validate as validateSchema } from './schema-validate.mjs';

/** The ids of PARAM_SCALES, the scales a travel may name, read from omx-contract's own data. */
export const PARAM_SCALE_IDS = JSON.parse(readFileSync(new URL('../data/primitives.json', import.meta.url), 'utf8')).PARAM_SCALES.ids;

/** The value a descriptor writes for a unit, a scale or a meaning the plugin does not state. */
export const UNKNOWN = 'unknown';

/**
 * The words a plugin's author may reach for that the contract does not take: one word per meaning, no synonyms
 * (FreeMixer/omx-contract#100). Each maps to the meaning that already says it; the validator names it.
 */
export const MEANING_SYNONYMS = Object.freeze({ on: 'enabled', speed: 'rate' });

/** The channel counts a layout admits. */
const LAYOUT_CHANNELS = { mono: (n) => n === 1, stereo: (n) => n === 2, surround: (n) => n > 2 };

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

/**
 * Every problem of descriptor `doc` (file `rel`) beyond the schema: `[{ file, item, rule, code, name, message }]`, `rule`
 * and `code` the CONTRACT_CODES code, `name` its key. `scales` are the ids a travel's scale may name besides unknown.
 */
export function descriptorProblems(rel, doc, { scales = PARAM_SCALE_IDS } = {}) {
  const out = [];
  const say = (name, item, message) => out.push({ file: rel, item, rule: CONTRACT_CODES[name], code: CONTRACT_CODES[name], name, message });
  const controls = doc.controls ?? [];
  const ports = doc.ports ?? [];
  const at = (i, c) => `controls[${i}] ${c.name}`;

  // The links an origin needs: an authored file names the code that implements it; a built or scanned one says, for
  // every control, where the scan read it.
  if (doc.origin === 'authored') {
    const impl = doc.source?.impl ?? controls.find((c) => c.source?.impl)?.source.impl ?? ports.find((p) => p.source?.impl)?.source.impl;
    if (!impl) say('descriptorOriginSource', '-', 'an authored descriptor carries no impl link, on the file or on a control');
  } else if (!doc.source?.from) {
    if (!controls.length) say('descriptorOriginSource', '-', `a ${doc.origin} descriptor carries no from link`);
    controls.forEach((c, i) => { if (!c.source?.from) say('descriptorOriginSource', at(i, c), `a ${doc.origin} control with no from link, its own or the file's`); });
  }

  const ids = new Map();
  const names = new Map();
  const symbols = new Map();
  controls.forEach((c, i) => {
    const key = JSON.stringify(c.id);
    if (ids.has(key)) say('descriptorControlDuplicate', at(i, c), `id ${key} is also the id of ${ids.get(key)}`);
    else ids.set(key, at(i, c));
    if (names.has(c.name)) say('descriptorControlDuplicate', at(i, c), `name ${JSON.stringify(c.name)} is also the name of ${names.get(c.name)}`);
    else names.set(c.name, at(i, c));
    if (c.symbol !== undefined) {
      if (symbols.has(c.symbol)) say('descriptorControlDuplicate', at(i, c), `symbol ${JSON.stringify(c.symbol)} is also the symbol of ${symbols.get(c.symbol)}`);
      else symbols.set(c.symbol, at(i, c));
    }

    const t = c.travel;
    if (doc.origin === 'authored') {
      for (const [word, v] of [['travel.unit', t?.unit], ['travel.scale', t?.scale], ['meaning', c.meaning]]) {
        if (v === UNKNOWN) say('descriptorUnknownAuthored', at(i, c), `${word} is unknown: an authored descriptor states what its author declared`);
      }
    }
    if (t) {
      if (t.scale !== UNKNOWN && !scales.includes(t.scale)) say('descriptorScale', at(i, c), `scale ${JSON.stringify(t.scale)} is neither an id of PARAM_SCALES (${scales.join(', ')}) nor unknown`);
      if (isNum(t.min) && isNum(t.max) && t.min > t.max) say('descriptorRange', at(i, c), `min ${t.min} is above max ${t.max}`);
      if (isNum(t.step) && t.step < 0) say('descriptorRange', at(i, c), `step ${t.step} is negative`);
      if (isNum(t.default) && ((isNum(t.min) && t.default < t.min) || (isNum(t.max) && t.default > t.max))) say('descriptorRange', at(i, c), `default ${t.default} lies outside [${t.min}, ${t.max}]`);
    }
    if (c.kind === 'choice') {
      if (c.default !== undefined && !c.ids.includes(c.default)) say('descriptorChoice', at(i, c), `default ${JSON.stringify(c.default)} is not one of ${JSON.stringify(c.ids)}`);
      for (const k of ['labels', 'values']) if (c[k] && c[k].length !== c.ids.length) say('descriptorChoice', at(i, c), `${c[k].length} ${k} for ${c.ids.length} ids`);
    }
  });

  controls.forEach((c, i) => {
    if (!c.when) return;
    const chooser = controls.find((x) => x !== c && x.name === c.when.control);
    if (!chooser || chooser.kind !== 'choice') say('descriptorWhen', at(i, c), `when.control ${JSON.stringify(c.when.control)} names no choice of this descriptor`);
    else if (!chooser.ids.includes(c.when.is)) say('descriptorWhen', at(i, c), `when.is ${JSON.stringify(c.when.is)} is not an id of ${chooser.name}`);
  });

  const portIds = new Map();
  ports.forEach((p, i) => {
    const where = `ports[${i}] ${p.id}`;
    // CLAP numbers its audio and note ports apart, inputs apart from outputs: an id is one port's within its kind and direction.
    const key = `${p.kind} ${p.direction} ${JSON.stringify(p.id)}`;
    if (portIds.has(key)) say('descriptorPortDuplicate', where, `the ${p.kind} ${p.direction}put id ${JSON.stringify(p.id)} is also the id of ${portIds.get(key)}`);
    else portIds.set(key, where);
    if (p.kind !== 'audio') for (const k of ['role', 'channels', 'layout']) if (k in p) say('descriptorPortWords', where, `${k} on a ${p.kind} port: only an audio port has a layout`);
    if (p.kind === 'note' && !p.dialects) say('descriptorPortWords', where, 'a note port states the dialects it accepts or emits');
    if (p.kind !== 'note' && p.dialects) say('descriptorPortWords', where, `dialects on a ${p.kind} port: only a note port has them`);
    if (p.kind === 'audio' && p.layout && p.channels !== undefined && !LAYOUT_CHANNELS[p.layout](p.channels)) say('descriptorPortWords', where, `layout ${p.layout} with ${p.channels} channels`);
  });

  const isInstrument = doc.plugin?.features?.includes('instrument') ?? false;
  if (isInstrument && !doc.instrument) say('descriptorInstrument', '-', 'the instrument feature without an instrument block');
  if (!isInstrument && doc.instrument) say('descriptorInstrument', '-', 'an instrument block without the instrument feature');
  if (isInstrument) {
    if (!ports.some((p) => (p.kind === 'note' || p.kind === 'midi') && p.direction === 'in')) say('descriptorInstrument', '-', 'an instrument with no note or MIDI input');
    if (!ports.some((p) => p.kind === 'audio' && p.direction === 'out')) say('descriptorInstrument', '-', 'an instrument with no audio output');
  }
  return out;
}

/* ---- The override module, step O1 (docs/overrides.md) ---- */

const OVERRIDE_SCHEMA = JSON.parse(readFileSync(new URL('../schema/omx-contract.schema.json', import.meta.url), 'utf8'));

/** The meanings an EQ band control may carry. */
const EQ_MEANINGS = ['frequency', 'gain', 'q', 'slope', 'enabled'];

const isObject = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);

/** The schema's problems of an override file `doc`: `[{ path, message }]`, none when it is well formed. */
export function overrideSchemaProblems(doc) {
  const wrapper = { $schema: 'https://json-schema.org/draft/2020-12/schema', $defs: OVERRIDE_SCHEMA.$defs, $ref: '#/$defs/override' };
  const { errors } = validateSchema(wrapper, doc);
  return errors.map((e) => ({ path: e.path || '/', message: `${e.path || '/'} ${e.message}` }));
}

/** The problems one override entry `e` has against its control `c`, `[{ name, message }]`; `family` is the file's effective family. */
function entryProblems(e, c, family) {
  const out = [];
  const say = (name, message) => out.push({ name, message });
  const t = c.travel;
  const hasTravel = c.kind === 'travel' && isObject(t);
  if ((e.travel || e.map) && !hasTravel) say('overrideKindMismatch', `${e.travel ? 'travel' : 'map'} on a ${c.kind} control`);
  if (e.band !== undefined) {
    const meaning = e.meaning ?? c.meaning;
    if (family !== 'eq') say('overrideKindMismatch', `band ${e.band} without family eq`);
    else if (!EQ_MEANINGS.includes(meaning)) say('overrideKindMismatch', `band ${e.band} on a control of meaning ${meaning ?? 'unknown'}, not an EQ one`);
  }
  if ((e.basis === 'measured') !== (e.evidence !== undefined)) {
    say('overrideBasisEvidence', e.basis === 'measured' ? 'basis measured without evidence' : `evidence with basis ${e.basis}`);
  }
  if (hasTravel) {
    const min = e.travel?.min ?? t.min;
    const max = e.travel?.max ?? t.max;
    const dflt = e.travel?.default ?? t.default;
    if (isNum(e.travel?.min) && isNum(t.min) && e.travel.min < t.min) say('overrideWidens', `min ${e.travel.min} is below the plugin's ${t.min}`);
    if (isNum(e.travel?.max) && isNum(t.max) && e.travel.max > t.max) say('overrideWidens', `max ${e.travel.max} is above the plugin's ${t.max}`);
    if (isNum(min) && isNum(max) && min > max) say('overrideWidens', `min ${min} is above max ${max}`);
    if (e.travel?.default !== undefined && ((isNum(min) && dflt < min) || (isNum(max) && dflt > max))) say('overrideWidens', `default ${dflt} lies outside [${min}, ${max}]`);
    const scale = e.travel?.scale ?? t.scale;
    if (scale === 'log' && e.travel !== undefined && !(isNum(min) && min > 0)) say('overrideScaleFloor', `a log scale over a floor of ${min}`);
  }
  if (e.map && hasTravel) {
    const pts = e.map.points;
    const plain = pts.map((p) => p[0]);
    const quantity = pts.map((p) => p[1]);
    const strictly = (xs) => xs.every((x, i) => i === 0 || x > xs[i - 1]);
    const monotonic = strictly(plain) && (strictly(quantity) || strictly(quantity.map((x) => -x)));
    const lo = e.travel?.min ?? t.min;
    const hi = e.travel?.max ?? t.max;
    if (!monotonic) say('overrideMapInvalid', 'the points are not strictly monotonic');
    else if (plain[0] !== t.min || plain[plain.length - 1] !== t.max) say('overrideMapInvalid', `the points run from ${plain[0]} to ${plain[plain.length - 1]}, not the plugin's ${t.min} to ${t.max}`);
    else if (plain.some((x) => x < Math.min(lo, t.min) || x > Math.max(hi, t.max))) say('overrideMapInvalid', 'a point lies outside the plugin\'s ends');
    if (e.map.scale === 'log' && quantity.some((x) => !(x > 0))) say('overrideScaleFloor', 'a log map over a quantity that is not positive');
  }
  return out;
}

/** A copy of control `c` with the winning entry `e` laid over it. */
function laidOver(c, e) {
  const out = structuredClone(c);
  for (const k of ['label', 'group', 'meaning', 'hidden', 'band', 'basis', 'evidence', 'map']) if (e[k] !== undefined) out[k] = structuredClone(e[k]);
  if (e.travel) {
    const corrected = [];
    for (const k of ['unit', 'scale']) {
      if (e.travel[k] !== undefined && c.travel?.[k] !== undefined && c.travel[k] !== UNKNOWN && c.travel[k] !== e.travel[k]) corrected.push(k);
    }
    out.travel = { ...out.travel, ...e.travel };
    if (corrected.length) out.corrected = corrected;
  }
  return out;
}

/**
 * The effective descriptor of `descriptor` under the override files `layers`, lowest first (docs/overrides.md). For
 * each control id the highest layer's entry wins whole, and so does `family`; each winning entry is checked against
 * the descriptor, and an entry that fails is dropped with its code while the rest stands. A file that fails the schema
 * (`contract.file.invalid`) or names another plugin (`contract.override.plugin-mismatch`) is refused whole. A file
 * written against another `paramsFingerprint` than `opts.paramsFingerprint` (the scan's) is a warning, never a refusal.
 * An override never changes the scan's fingerprint, and never widens or changes a kind.
 *
 * @returns {{ descriptor: object, family: string|undefined, answered: Record<string, number>,
 *   dropped: {layer: number, control: string, code: string, name: string, message: string}[],
 *   warnings: {layer: number, code: string, name: string, message: string}[],
 *   refused: {layer: number, code: string, name: string, message: string}[] }}
 */
export function applyOverride(descriptor, layers, opts = {}) {
  const result = { descriptor: structuredClone(descriptor), family: undefined, answered: {}, dropped: [], warnings: [], refused: [] };
  const refuse = (layer, name, message) => result.refused.push({ layer, code: CONTRACT_CODES[name], name, message });
  const wins = new Map();
  layers.forEach((doc, layer) => {
    const bad = overrideSchemaProblems(doc);
    if (bad.length) { refuse(layer, 'fileInvalid', bad.map((p) => p.message).join('; ')); return; }
    if (doc.plugin.id !== descriptor.plugin.id || doc.plugin.format !== descriptor.plugin.format) {
      refuse(layer, 'overridePluginMismatch', `the file describes ${doc.plugin.format} ${doc.plugin.id}, the plugin is ${descriptor.plugin.format} ${descriptor.plugin.id}`);
      return;
    }
    if (opts.paramsFingerprint !== undefined && doc.against && doc.against.paramsFingerprint !== opts.paramsFingerprint) {
      result.warnings.push({ layer, code: CONTRACT_CODES.overrideFingerprintDiffers, name: 'overrideFingerprintDiffers', message: `written against ${doc.against.paramsFingerprint}, the plugin is ${opts.paramsFingerprint}` });
    }
    if (doc.family !== undefined) result.family = doc.family;
    for (const [id, entry] of Object.entries(doc.controls ?? {})) wins.set(id, { layer, entry });
  });
  const byId = new Map(result.descriptor.controls.map((c, i) => [String(c.id), i]));
  for (const [id, { layer, entry }] of wins) {
    const drop = (name, message) => result.dropped.push({ layer, control: id, code: CONTRACT_CODES[name], name, message });
    if (!byId.has(id)) { drop('overrideControlAbsent', `the descriptor has no control ${id}`); continue; }
    const i = byId.get(id);
    const problems = entryProblems(entry, result.descriptor.controls[i], result.family);
    if (problems.length) { for (const p of problems) drop(p.name, p.message); continue; }
    result.descriptor.controls[i] = laidOver(result.descriptor.controls[i], entry);
    result.answered[id] = layer;
  }
  return result;
}
