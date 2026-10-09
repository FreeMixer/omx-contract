// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
// The `set` kind (ordered ids, an optional default, labels), the travel scale it names, the ceilSum
// derivation and the rules about the EQ band budget and counts (1.3.0).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadData, resolveData } from '../lib/data.mjs';
import { classify } from '../lib/semver.mjs';
import { validateData } from '../lib/validate.mjs';
import { renderC } from '../render/c.mjs';
import { renderJson } from '../render/json.mjs';
import { renderTs } from '../render/ts.mjs';
import { DATA, resolvedOf, texts } from './helpers.mjs';

const problems = (t) => validateData(loadData(null, t)).map((p) => `${p.item}:${p.rule}`);
const header = (t) => renderC(resolvedOf(t))[0].text;
const eq = 'data/kernels/eq.json';

test('a set renders as a C enum, a count and a default, a ts list of ids and a json item with its labels', () => {
  const t = texts();
  const h = header(t);
  assert.match(h, /^enum omx_eq_band_types \{\n {2}OMX_EQ_BAND_TYPES_BELL = 0,\n {2}OMX_EQ_BAND_TYPES_LOW_SHELF = 1,\n {2}OMX_EQ_BAND_TYPES_HIGH_SHELF = 2,\n {2}OMX_EQ_BAND_TYPES_NOTCH = 3,\n {2}OMX_EQ_BAND_TYPES_ALLPASS1 = 4,\n {2}OMX_EQ_BAND_TYPES_ALLPASS2 = 5,\n\};$/m);
  assert.match(h, /^#define OMX_EQ_BAND_TYPES_COUNT 6u$/m);
  assert.match(h, /^#define OMX_EQ_BAND_TYPES_DEFAULT OMX_EQ_BAND_TYPES_BELL$/m);
  assert.match(h, /^ {2}OMX_FILTER_SLOPES_12 = 12,\n {2}OMX_FILTER_SLOPES_24 = 24,$/m, 'a numeric id is its value');
  assert.doesNotMatch(h, /OMX_DEESS_MODES_DEFAULT/, 'a set with no default has no default');
  const r = resolvedOf(t);
  assert.deepEqual(r.get('EQ_BAND_TYPES').value, ['bell', 'lowShelf', 'highShelf', 'notch', 'allpass1', 'allpass2']);
  assert.match(renderTs(r)[1].text, /export declare const EQ_BAND_TYPES: readonly \["bell", "lowShelf", "highShelf", "notch", "allpass1", "allpass2"\];/);
  const j = JSON.parse(renderJson(r, '0.0.0')[0].text).items.EQ_BAND_TYPES;
  assert.equal(j.default, 'bell');
  assert.deepEqual(j.labels.slice(0, 3), ['Bell', 'Low Shelf', 'High Shelf']);
});

test('a set must name a default among its ids, as many labels as ids, ids of one type, none twice', () => {
  assert.ok(problems(texts((d, at) => { at(eq, 'EQ_BAND_TYPES').default = 'peak'; })).includes('EQ_BAND_TYPES:set-default'));
  assert.ok(problems(texts((d, at) => { at(eq, 'EQ_BAND_TYPES').labels.pop(); })).includes('EQ_BAND_TYPES:set-labels'));
  assert.ok(problems(texts((d, at) => { at(eq, 'EQ_BAND_TYPES').ids[1] = 3; })).includes('EQ_BAND_TYPES:schema'));
  assert.ok(problems(texts((d, at) => { at(eq, 'EQ_BAND_TYPES').ids[1] = 'bell'; })).includes('EQ_BAND_TYPES:schema'));
  assert.ok(problems(texts((d, at) => { at(eq, 'EQ_BAND_TYPES').ids[1] = 'low shelf'; })).includes('EQ_BAND_TYPES:schema'));
});

test('two enumerators of one name are refused', () => {
  const t = texts((d) => { d[eq].controls.push({ name: 'band', kind: 'choice', global: 'EQ_BAND', doc: 'collides', ids: ['types_bell'.replace('_b', 'B')] }); });
  // EQ_BAND + typesBell -> OMX_EQ_BAND_TYPES_BELL, which EQ_BAND_TYPES already spells
  assert.ok(validateData(loadData(null, t)).some((p) => p.rule === 'c-name-unique' && /OMX_EQ_BAND_TYPES_BELL/.test(p.message)));
});

test('a travel names its scale by an id of PARAM_SCALES', () => {
  const r = resolvedOf(texts());
  assert.deepEqual(['freqHz', 'hpfFreqHz', 'lpfFreqHz'].map((f) => r.get('EQ_CONTINUOUS_TRAVELS').value[f].scale), ['log', 'log', 'log']);
  assert.ok(problems(texts((d) => { d['data/primitives.json'].EQ_CONTINUOUS_TRAVELS.fields.freqHz.scale = 'exp'; })).includes('EQ_CONTINUOUS_TRAVELS:scale'));
});

test('ceilSum rounds the sum of its terms up, and follows a term that moves', () => {
  const r = resolvedOf(texts());
  assert.equal(r.get('CHORUS_MAX_MS').value, 22);
  assert.equal(r.get('FLANGER_MAX_MS').value, 6);
  assert.equal(resolvedOf(texts((d, at) => { at('data/kernels/chorus.json', 'CHORUS_BASE_MS').value = 11; })).get('CHORUS_MAX_MS').value, 23);
  assert.equal(resolvedOf(texts((d, at) => { at('data/kernels/flanger.json', 'FLANGER_BASE_MS').value = 0.25; })).get('FLANGER_MAX_MS').value, 6);
  assert.match(problems(texts((d, at) => { at('data/kernels/chorus.json', 'CHORUS_MAX_MS').value.of = [{ ref: 'CHORUS_BASE_MS' }]; })).join(), /CHORUS_MAX_MS:schema/);
});

test('the EQ band budget: the reserve and both planters must fit EQ_MAX_BANDS', () => {
  assert.deepEqual(problems(texts()), []);
  assert.deepEqual(problems(texts((d, at) => { at(eq, 'OPERATOR_EQ_BANDS_RESERVE').value = 10; })), [], 'RESERVE 10: 10 + 6 + 8 = 24 still fits the 24');
  assert.ok(problems(texts((d, at) => { at(eq, 'OPERATOR_EQ_BANDS_RESERVE').value = 11; })).includes('OPERATOR_EQ_BANDS_RESERVE:eq-band-budget'));
  assert.ok(problems(texts((d, at) => { at('data/kernels/hrp.json', 'HRP_DEFAULT_MAX_AUTO_BANDS').value = 12; })).includes('OPERATOR_EQ_BANDS_RESERVE:eq-band-budget'));
  assert.ok(problems(texts((d, at) => { at(eq, 'EQ_MAX_BANDS').value = 22; })).includes('OPERATOR_EQ_BANDS_RESERVE:eq-band-budget'));
});

test('a strip type never starts with more bands than it may hold, and the rule answers for its count', () => {
  assert.ok(problems(texts((d, at) => { at(eq, 'EQ_BAND_COUNTS').value.eq8.default = 9; })).includes('EQ_BAND_COUNTS:eq-band-counts'));
  assert.ok(problems(texts((d, at) => { at(eq, 'EQ_BAND_COUNTS').value.channel.default = 0; })).includes('EQ_BAND_COUNTS:eq-band-counts'));
  assert.ok(problems(texts((d, at) => { at(eq, 'EQ_BAND_COUNTS').value.eq32 = { default: 62, max: 62 }; })).includes('EQ_DEFAULT_CENTRES_FOUR_BAND_HZ:eq-default-rule'));
});

test('the default rule\'s inputs must agree', () => {
  assert.ok(problems(texts((d, at) => { at(eq, 'EQ_DEFAULT_CENTRES_FOUR_BAND_HZ').values = [100, 400, 2000]; })).includes('EQ_DEFAULT_CENTRES_FOUR_BAND_HZ:eq-default-rule'));
  assert.ok(problems(texts((d, at) => { at(eq, 'EQ_DEFAULT_CENTRES_FOUR_BAND_HZ').values = [100, 400, 2000, 8100]; })).includes('EQ_DEFAULT_CENTRES_FOUR_BAND_HZ:eq-default-rule'), 'a preferred value of the series only');
  assert.ok(problems(texts((d, at) => { at(eq, 'EQ_BAND_TYPES').ids = ['bell', 'highShelf', 'notch']; delete at(eq, 'EQ_BAND_TYPES').labels; })).includes('EQ_DEFAULT_CENTRES_FOUR_BAND_HZ:eq-default-rule'));
});

test('a set\'s ids appended are MINOR, changed or removed MAJOR, its default added or removed MAJOR', () => {
  const base = resolvedOf(texts());
  const level = (fn) => classify(base, resolvedOf(texts(fn))).level;
  assert.equal(level((d, at) => { at(eq, 'EQ_BAND_TYPES').ids.push('peaking'); delete at(eq, 'EQ_BAND_TYPES').labels; }), 'minor');
  assert.equal(level((d, at) => { at(eq, 'EQ_BAND_TYPES').ids[0] = 'peak'; at(eq, 'EQ_BAND_TYPES').default = 'peak'; }), 'major');
  assert.equal(level((d, at) => { at(eq, 'EQ_BAND_TYPES').ids.pop(); at(eq, 'EQ_BAND_TYPES').labels.pop(); }), 'major');
  assert.equal(level((d, at) => { delete at(eq, 'EQ_BAND_TYPES').default; }), 'major');
  assert.equal(level((d, at) => { at(eq, 'EQ_BAND_TYPES').labels[0] = 'Peak'; }), 'patch');
});

test('the shipped data resolves, and the 1.3.0 items are all there', () => {
  const r = resolveData(loadData(DATA));
  for (const n of ['FBS_TRACK_SLOTS', 'DEFAULT_THRESHOLDS', 'HRP_MAX_VOICES', 'HRP_AMOUNT_RANGE', 'RTA_FFT_SIZE_MAX', 'BUS_INPUT_CAP', 'OPERATOR_EQ_BANDS_RESERVE',
    'EQ_BAND_TYPES', 'FILTER_SLOPES', 'EQ_BAND_COUNTS', 'DEESS_MODES', 'DRIVE_CURVES', 'DRIVE_BANDS', 'REVERB_ALGORITHMS', 'ROTARY_SPEEDS', 'TREMOLO_MODES',
    'GATE_KEY_SOURCES', 'PARAM_SCALES', 'ORACLE_FLOOR_RATES', 'RME_RATES', 'CHORUS_BASE_MS', 'FLANGER_BASE_MS', 'PHASER_F_TOP_HZ', 'REVERB_GATE_ATTACK_MS']) {
    assert.ok(r.has(n), n);
  }
  assert.deepEqual(r.get('EQ_BAND_COUNTS').value.channel, { default: 4, max: 24 });
});
