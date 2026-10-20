// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
/**
 * The words and terms kinds (docs/data-layout.md): the validator's rules over them, each with a red arm, and their
 * generic renders.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadData, resolveData } from '../lib/data.mjs';
import { validateData } from '../lib/validate.mjs';
import { renderC } from '../render/c.mjs';
import { renderJson } from '../render/json.mjs';
import { renderTs } from '../render/ts.mjs';
import { DATA, texts } from './helpers.mjs';

const problems = (t) => validateData(loadData(null, t));
const has = (t, item, rule) => problems(t).some((p) => p.item === item && p.rule === rule);
const R = 'data/resource-profile.json';
const M = 'data/measurement.json';

test('the vocabulary is valid', () => {
  assert.deepEqual(problems(texts()), []);
});

test('a word two names carry is refused', () => {
  assert.ok(has(texts((d) => { d[R].RESOURCE_BASES.words.again = { word: 'probe' }; }), 'RESOURCE_BASES', 'word-unique'));
});

test('a group that is no word of the item groups names, or a group with no groups, is refused', () => {
  assert.ok(has(texts((d) => { d[M].MEASUREMENT_UNMEASURED_REASONS.words.noAudioIn.group = 'nothing-at-all'; }), 'MEASUREMENT_UNMEASURED_REASONS', 'word-group'));
  assert.ok(has(texts((d) => { d[M].MEASUREMENT_VOICE_BASES.words.probe.group = 'probe-failed'; }), 'MEASUREMENT_VOICE_BASES', 'word-group'));
  assert.ok(has(texts((d) => { d[M].MEASUREMENT_UNMEASURED_REASONS.groups = 'RT_HARD_TARGET'; }), 'MEASUREMENT_UNMEASURED_REASONS', 'word-group'));
});

test('a from that names no term, or no terms item, is refused', () => {
  assert.ok(has(texts((d) => { d[R].RESOURCE_KINDS.words.tail.from = ['CLAP_EXT_TAIL_TERMS#tails']; }), 'RESOURCE_KINDS', 'word-from'));
  assert.ok(has(texts((d) => { d[R].RESOURCE_KINDS.words.tail.from = ['RT_HARD_TARGET#tail']; }), 'RESOURCE_KINDS', 'word-from'));
});

test('a term of the wrong format\'s shape, or without the citation its status asks for, is refused', () => {
  const f = 'data/formats/lv2/urid.json';
  assert.ok(has(texts((d) => { const t = d[f].LV2_URID_TERMS.terms.map; delete t.uri; t.id = 'CLAP_X'; }), 'LV2_URID_TERMS', 'term-format'));
  assert.ok(has(texts((d) => { delete d[f].LV2_URID_TERMS.terms.map.by; }), 'LV2_URID_TERMS', 'schema'));
  assert.ok(has(texts((d) => { const t = d[f].LV2_URID_TERMS.terms.map; t.status = 'supported-later'; delete t.by; }), 'LV2_URID_TERMS', 'schema'));
  assert.ok(has(texts((d) => { const t = d[f].LV2_URID_TERMS.terms.map; t.status = 'out-of-scope'; }), 'LV2_URID_TERMS', 'schema'));
  assert.ok(has(texts((d) => { delete d[f].LV2_URID_TERMS.terms.map.status; }), 'LV2_URID_TERMS', 'schema'));
});

test('an item named as a words item\'s ts export is refused', () => {
  assert.ok(problems(texts((d) => { d[R].RESOURCE_BASES_WORDS = { kind: 'scalar', doc: 'x', unit: '', value: 1 }; })).some((p) => p.rule === 'words-export'));
});

test('a word whose C name meets a words item\'s _COUNT is refused', () => {
  assert.ok(problems(texts((d) => { d[R].RESOURCE_BASES.words.count = { word: 'counted' }; })).some((p) => p.rule === 'c-name-unique' && /OMX_RESOURCE_BASES_COUNT/.test(p.message)));
});

const resolved = resolveData(loadData(DATA));

test('the C render defines every code and word once, by its code and by its item', () => {
  const h = renderC(resolved).find((f) => f.path === 'omxcontract/omx_vocabulary.h').text;
  assert.match(h, /^#define OMX_HOSTING_RT_SAFETY_UNMEASURED "hosting\.rt-safety\.unmeasured"$/m);
  assert.match(h, /^#define OMX_HOSTING_NO_REALISATION "hosting\.no-realisation"$/m);
  assert.match(h, /^#define OMX_MEASUREMENT_LATENCY_METHODS_NOTE_ONSET "note-onset" \/\/\/< /m);
  assert.match(h, /^#define OMX_MACHINE_CLOCK_BANDS_INIT \{ "<1\.5GHz", "1\.5-2\.5GHz", "2\.5-3\.5GHz", "3\.5-4\.5GHz", "4\.5GHz\+" \}$/m);
  assert.match(h, /^#define OMX_MEASUREMENT_VOICE_BASES_COUNT 2u$/m);
  assert.doesNotMatch(h, /TERMS/, 'a terms item has no C render');
});

test('the JSON Schema fragment gives one enum per codes and words item, in order', () => {
  const f = JSON.parse(renderJson(resolved, '0.0.0').find((x) => x.path === 'omx-vocabulary.schema.json').text);
  assert.deepEqual(f.$defs.MEASUREMENT_LATENCY_METHODS.enum, ['impulse-onset', 'declared-port', 'note-onset']);
  assert.deepEqual(f.$defs.MEASUREMENT_VOICE_BASES.enum, ['declared', 'probe']);
  assert.deepEqual(f.$defs.MACHINE_CORE_BANDS.enum, ['1-2', '3-4', '5-8', '9-16', '17-32', '33+']);
  assert.ok(f.$defs.HOSTING_TOPOLOGY_CODES.enum.includes('hosting.topology.wider-than-strip'));
  assert.equal(f.$defs.LV2_CORE_TERMS, undefined);
});

test('the ts render exports each words item\'s words in order', () => {
  const js = renderTs(resolved).find((f) => f.path === 'omx-contract.js').text;
  assert.match(js, /export const MEASUREMENT_VERDICT_RATINGS_WORDS = \[\n {2}"suitable",\n {2}"conditional",\n {2}"unknown",\n {2}"unsuitable"\n\];/);
});

test('an owner\'s codes item, in a file with its own render word, stays out of the vocabulary renders', () => {
  const union = resolveData(loadData(null, texts()));
  assert.ok(union.has('HOSTING_CODES'), 'the owners\' fixture carries omx-clap-core\'s HOSTING_CODES');
  const h = renderC(union).find((f) => f.path === 'omxcontract/omx_vocabulary.h').text;
  assert.doesNotMatch(h, /HOSTING_CODES \(/);
  assert.equal(JSON.parse(renderJson(union, '0.0.0').find((x) => x.path === 'omx-vocabulary.schema.json').text).$defs.HOSTING_CODES, undefined);
});
