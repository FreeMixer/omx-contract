// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
/**
 * The rules of a plugin descriptor (docs/descriptors.md) that the schema cannot state. Each problem carries the
 * CONTRACT_CODES code it is refused with; nothing classifies a problem by its text. The schema holds the words, so
 * these run on a descriptor the schema has passed.
 */
import { readFileSync } from 'node:fs';
import { CONTRACT_CODES } from './codes.mjs';

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
