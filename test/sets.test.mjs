// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
// The `set` kind (ordered ids, an optional default, labels), the travel scale it names, the ceilSum
// derivation (1.3.0), and the rules that judge the EQ band budget and counts with no item named: a declared check, the
// count rule and the sheet-default rule (3.0.0, #1841).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadData, resolveData } from '../lib/data.mjs';
import { classify } from '../lib/semver.mjs';
import { validateData } from '../lib/validate.mjs';
import { renderC } from '../render/c.mjs';
import { renderJson } from '../render/json.mjs';
import { renderTs } from '../render/ts.mjs';
import { DATA, UNION, dropDecl, relOf, resolvedOf, texts } from './helpers.mjs';

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
  assert.ok(problems(texts((d) => { d[relOf('EQ_CONTINUOUS_TRAVELS')].EQ_CONTINUOUS_TRAVELS.fields.freqHz.scale = 'exp'; })).includes('EQ_CONTINUOUS_TRAVELS:scale'));
});

test('ceilSum rounds the sum of its terms up, and follows a term that moves', () => {
  const r = resolvedOf(texts());
  assert.equal(r.get('CHORUS_MAX_MS').value, 22);
  assert.equal(r.get('FLANGER_MAX_MS').value, 6);
  assert.equal(resolvedOf(texts((d, at) => { at('data/kernels/chorus.json', 'CHORUS_BASE_MS').value = 11; })).get('CHORUS_MAX_MS').value, 23);
  assert.equal(resolvedOf(texts((d, at) => { at('data/kernels/flanger.json', 'FLANGER_BASE_MS').value = 0.25; })).get('FLANGER_MAX_MS').value, 6);
  assert.match(problems(texts((d, at) => { at('data/kernels/chorus.json', 'CHORUS_MAX_MS').value.of = [{ ref: 'CHORUS_BASE_MS' }]; })).join(), /CHORUS_MAX_MS:schema/);
});

/** The EQ band budget as its owner declares it (docs/contract-dir.md, `checks`), in a file of its own. */
const BUDGET = 'data/eq-budget.json';
const budget = (fn) => texts((d, at) => {
  d[BUDGET] = {
    $schema: '../schema/omx-contract.schema.json',
    checks: [{ name: 'eqBandBudget', doc: 'The operator\'s reserve and both planters fit the EQ\'s band maximum.',
      sum: ['OPERATOR_EQ_BANDS_RESERVE', 'FBS_DEFAULT_MAX_AUTO_BANDS', 'HRP_DEFAULT_MAX_AUTO_BANDS'], atMost: 'EQ_MAX_BANDS' }],
  };
  fn?.(d, at);
});

test('a declared check: the EQ band budget, the reserve and both planters must fit EQ_MAX_BANDS', () => {
  assert.deepEqual(problems(budget()), []);
  assert.deepEqual(problems(texts((d, at) => { at(eq, 'OPERATOR_EQ_BANDS_RESERVE').value = 30; })), [], 'the tool judges no budget nobody declares');
  assert.deepEqual(problems(budget((d, at) => { at(eq, 'OPERATOR_EQ_BANDS_RESERVE').value = 10; })), [], 'RESERVE 10: 10 + 6 + 8 = 24 still fits the 24');
  assert.ok(problems(budget((d, at) => { at(eq, 'OPERATOR_EQ_BANDS_RESERVE').value = 11; })).includes('eqBandBudget:check'));
  assert.ok(problems(budget((d, at) => { at('data/kernels/hrp.json', 'HRP_DEFAULT_MAX_AUTO_BANDS').value = 12; })).includes('eqBandBudget:check'));
  assert.ok(problems(budget((d, at) => { at(eq, 'EQ_MAX_BANDS').value = 22; })).includes('eqBandBudget:check'));
  const said = validateData(loadData(null, budget((d, at) => { at(eq, 'OPERATOR_EQ_BANDS_RESERVE').value = 11; }))).find((p) => p.rule === 'check');
  assert.deepEqual([said.file, said.message], [BUDGET, 'OPERATOR_EQ_BANDS_RESERVE 11 + FBS_DEFAULT_MAX_AUTO_BANDS 6 + HRP_DEFAULT_MAX_AUTO_BANDS 8 = 25 exceeds EQ_MAX_BANDS 24']);
  // a read without one of the terms (the console's FBS default is not installed) skips the sum and says no NaN
  const without = problems(budget((d, at) => { dropDecl('data/kernels/fbs.json', d['data/kernels/fbs.json'], 'FBS_DEFAULT_MAX_AUTO_BANDS'); at(eq, 'OPERATOR_EQ_BANDS_RESERVE').value = 30; }));
  assert.ok(!without.includes('eqBandBudget:check'), JSON.stringify(without));
  // a leaf by its path; a term that is no number is refused, never added
  assert.ok(problems(budget((d) => { d[BUDGET].checks[0].atMost = 'EQ_BAND_COUNTS.eq8.max'; })).includes('eqBandBudget:check'), '9 + 6 + 8 exceeds 8');
  assert.deepEqual(problems(budget((d) => { d[BUDGET].checks[0].sum = ['EQ_BAND_COUNTS.strip.default']; d[BUDGET].checks[0].atMost = 'EQ_BAND_COUNTS.channel.max'; })), []);
  assert.ok(problems(budget((d) => { d[BUDGET].checks[0].atMost = 'EQ_BAND_COUNTS.channel'; })).includes('eqBandBudget:check'));
  assert.ok(problems(budget((d) => { d[BUDGET].checks[0].sum = []; })).some((p) => p.endsWith(':schema')), 'a check sums one term or more');
});

test('a strip type never starts with more bands than it may hold: the generic count and sheet-default rules', () => {
  assert.ok(problems(texts((d, at) => { at(eq, 'EQ_BAND_COUNTS').value.eq8.default = 9; })).includes('EQ_BAND_COUNTS:sheet-default'));
  assert.ok(problems(texts((d, at) => { at(eq, 'EQ_BAND_COUNTS').value.channel.default = 0; })).includes('EQ_BAND_ONS:count'), 'a count that starts with no band');
  assert.ok(problems(texts((d, at) => { at(eq, 'EQ_BAND_COUNTS').value.channel.default = 2.5; })).includes('EQ_BAND_ONS:count'));
  assert.deepEqual(problems(texts((d, at) => { at(eq, 'EQ_BAND_COUNTS').value.eq32 = { default: 62, max: 62 }; })), [], 'the default centres are omx-dsp\'s to answer, no rule here');
  // any sheet, not the EQ's only: a group's default below its min
  assert.ok(problems(texts((d) => { d['data/limits.json'] = { $schema: '../schema/omx-contract.schema.json', ACME_SHEET: { kind: 'sheet', doc: 'A sheet.', value: { knob: { min: 2, default: 1, max: 4 } } } }; }))
    .includes('ACME_SHEET:sheet-default'));
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
  const r = resolveData(loadData(UNION));
  for (const n of ['FBS_TRACK_SLOTS', 'DEFAULT_THRESHOLDS', 'HRP_MAX_VOICES', 'HRP_AMOUNT_RANGE', 'RTA_FFT_SIZE_MAX', 'BUS_INPUT_CAP', 'OPERATOR_EQ_BANDS_RESERVE',
    'EQ_BAND_TYPES', 'FILTER_SLOPES', 'EQ_BAND_COUNTS', 'DEESS_MODES', 'DRIVE_CURVES', 'DRIVE_BANDS', 'REVERB_ALGORITHMS', 'ROTARY_SPEEDS', 'TREMOLO_MODES',
    'GATE_KEY_SOURCES', 'PARAM_SCALES', 'ORACLE_FLOOR_RATES', 'ORACLE_FULL_RATES', 'CHORUS_BASE_MS', 'FLANGER_BASE_MS', 'PHASER_F_TOP_HZ', 'REVERB_GATE_ATTACK_MS']) {
    assert.ok(r.has(n), n);
  }
  assert.deepEqual(r.get('EQ_BAND_COUNTS').value.channel, { default: 4, max: 24 });
});
