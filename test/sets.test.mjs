// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
// The `set` kind (ordered ids, an optional default, labels), the travel scale it names, the ceilSum
// derivation (1.3.0), and the rules that judge a band budget and counts with no item named: a declared check, the
// count rule and the sheet-default rule (3.0.0, #1841). Over the invented kernels of test/fixtures/tool-kernels/.
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
const contour = 'data/kernels/contour.json';

test('a set renders as a C enum, a count and a default, a ts list of ids and a json item with its labels', () => {
  const t = texts();
  const h = header(t);
  assert.match(h, /^enum omx_contour_band_types \{\n {2}OMX_CONTOUR_BAND_TYPES_PEAK = 0,\n {2}OMX_CONTOUR_BAND_TYPES_LOW_SHELF = 1,\n {2}OMX_CONTOUR_BAND_TYPES_HIGH_SHELF = 2,\n {2}OMX_CONTOUR_BAND_TYPES_CUT = 3,\n\};$/m);
  assert.match(h, /^#define OMX_CONTOUR_BAND_TYPES_COUNT 4u$/m);
  assert.match(h, /^#define OMX_CONTOUR_BAND_TYPES_DEFAULT OMX_CONTOUR_BAND_TYPES_PEAK$/m);
  assert.match(h, /^ {2}OMX_CONTOUR_SLOPES_6 = 6,\n {2}OMX_CONTOUR_SLOPES_18 = 18,$/m, 'a numeric id is its value');
  assert.match(h, /^#define OMX_SWELL_KEY_SOURCES_COUNT 2u$/m, 'positive control: the set with no default renders');
  assert.doesNotMatch(h, /OMX_SWELL_KEY_SOURCES_DEFAULT/, 'a set with no default has no default');
  const r = resolvedOf(t);
  assert.deepEqual(r.get('CONTOUR_BAND_TYPES').value, ['peak', 'lowShelf', 'highShelf', 'cut']);
  assert.match(renderTs(r)[1].text, /export declare const CONTOUR_BAND_TYPES: readonly \["peak", "lowShelf", "highShelf", "cut"\];/);
  const j = JSON.parse(renderJson(r, '0.0.0')[0].text).items.CONTOUR_BAND_TYPES;
  assert.equal(j.default, 'peak');
  assert.deepEqual(j.labels.slice(0, 3), ['Peak', 'Low Shelf', 'High Shelf']);
});

test('a set must name a default among its ids, as many labels as ids, ids of one type, none twice', () => {
  assert.ok(problems(texts((d, at) => { at(contour, 'CONTOUR_BAND_TYPES').default = 'bell'; })).includes('CONTOUR_BAND_TYPES:set-default'));
  assert.ok(problems(texts((d, at) => { at(contour, 'CONTOUR_BAND_TYPES').labels.pop(); })).includes('CONTOUR_BAND_TYPES:set-labels'));
  assert.ok(problems(texts((d, at) => { at(contour, 'CONTOUR_BAND_TYPES').ids[1] = 3; })).includes('CONTOUR_BAND_TYPES:schema'));
  assert.ok(problems(texts((d, at) => { at(contour, 'CONTOUR_BAND_TYPES').ids[1] = 'peak'; })).includes('CONTOUR_BAND_TYPES:schema'));
  assert.ok(problems(texts((d, at) => { at(contour, 'CONTOUR_BAND_TYPES').ids[1] = 'low shelf'; })).includes('CONTOUR_BAND_TYPES:schema'));
});

test('two enumerators of one name are refused', () => {
  const t = texts((d) => { d[contour].controls.push({ name: 'band', kind: 'choice', global: 'CONTOUR_BAND', doc: 'collides', ids: ['typesPeak'] }); });
  // CONTOUR_BAND + typesPeak -> OMX_CONTOUR_BAND_TYPES_PEAK, which CONTOUR_BAND_TYPES already spells
  assert.ok(validateData(loadData(null, t)).some((p) => p.rule === 'c-name-unique' && /OMX_CONTOUR_BAND_TYPES_PEAK/.test(p.message)));
});

test('a travel names its scale by an id of PARAM_SCALES', () => {
  const r = resolvedOf(texts());
  assert.equal(r.get('CONTOUR_CONTINUOUS_TRAVELS').value.freqHz.scale, 'log');
  assert.ok(problems(texts((d) => { d[relOf('CONTOUR_CONTINUOUS_TRAVELS')].CONTOUR_CONTINUOUS_TRAVELS.fields.freqHz.scale = 'exp'; })).includes('CONTOUR_CONTINUOUS_TRAVELS:scale'));
});

test('ceilSum rounds the sum of its terms up, and follows a term that moves', () => {
  const wave = 'data/kernels/wave.json';
  assert.equal(resolvedOf(texts()).get('WAVE_MAX_MS').value, 10, '6.5 + 3 rounds up to 10');
  assert.equal(resolvedOf(texts((d, at) => { at(wave, 'WAVE_BASE_MS').value = 7.5; })).get('WAVE_MAX_MS').value, 11);
  assert.equal(resolvedOf(texts((d, at) => { at(wave, 'WAVE_BASE_MS').value = 6.9; })).get('WAVE_MAX_MS').value, 10, 'a term that moves within the ceiling leaves it');
  assert.match(problems(texts((d, at) => { at(wave, 'WAVE_MAX_MS').value.of = [{ ref: 'WAVE_BASE_MS' }]; })).join(), /WAVE_MAX_MS:schema/);
});

/** A band budget as an owner declares it (docs/contract-dir.md, `checks`), in a file of its own. */
const BUDGET = 'data/contour-budget.json';
const budget = (fn) => texts((d, at) => {
  d[BUDGET] = {
    $schema: '../schema/omx-contract.schema.json',
    checks: [{ name: 'contourBandBudget', doc: 'The reserve and both planters fit the tone\'s band maximum.',
      sum: ['CONTOUR_RESERVE', 'WAVE_PLANT_BANDS', 'SWELL_PLANT_BANDS'], atMost: 'CONTOUR_MAX_BANDS' }],
  };
  fn?.(d, at);
});

test('a declared check: a band budget, the reserve and both planters must fit CONTOUR_MAX_BANDS', () => {
  assert.deepEqual(problems(budget()), []);
  assert.deepEqual(problems(texts((d, at) => { at(contour, 'CONTOUR_RESERVE').value = 30; })), [], 'the tool judges no budget nobody declares');
  assert.deepEqual(problems(budget((d, at) => { at(contour, 'CONTOUR_RESERVE').value = 7; })), [], 'RESERVE 7: 7 + 3 + 2 = 12 still fits the 12');
  assert.ok(problems(budget((d, at) => { at(contour, 'CONTOUR_RESERVE').value = 8; })).includes('contourBandBudget:check'));
  assert.ok(problems(budget((d, at) => { at('data/kernels/swell.json', 'SWELL_PLANT_BANDS').value = 6; })).includes('contourBandBudget:check'));
  assert.ok(problems(budget((d, at) => { at(contour, 'CONTOUR_MAX_BANDS').value = 9; })).includes('contourBandBudget:check'));
  const said = validateData(loadData(null, budget((d, at) => { at(contour, 'CONTOUR_RESERVE').value = 8; }))).find((p) => p.rule === 'check');
  assert.deepEqual([said.file, said.message], [BUDGET, 'CONTOUR_RESERVE 8 + WAVE_PLANT_BANDS 3 + SWELL_PLANT_BANDS 2 = 13 exceeds CONTOUR_MAX_BANDS 12']);
  // a read without one of the terms (an owner not installed) skips the sum and says no NaN
  const without = problems(budget((d, at) => { dropDecl('data/kernels/wave.json', d['data/kernels/wave.json'], 'WAVE_PLANT_BANDS'); at(contour, 'CONTOUR_RESERVE').value = 30; }));
  assert.ok(!without.includes('contourBandBudget:check'), JSON.stringify(without));
  // a leaf by its path; a term that is no number is refused, never added
  assert.ok(problems(budget((d) => { d[BUDGET].checks[0].atMost = 'CONTOUR_BAND_COUNTS.small.max'; })).includes('contourBandBudget:check'), '5 + 3 + 2 exceeds 2');
  assert.deepEqual(problems(budget((d) => { d[BUDGET].checks[0].sum = ['CONTOUR_BAND_COUNTS.small.default']; d[BUDGET].checks[0].atMost = 'CONTOUR_BAND_COUNTS.desk.max'; })), []);
  assert.ok(problems(budget((d) => { d[BUDGET].checks[0].atMost = 'CONTOUR_BAND_COUNTS.desk'; })).includes('contourBandBudget:check'));
  assert.ok(problems(budget((d) => { d[BUDGET].checks[0].sum = []; })).some((p) => p.endsWith(':schema')), 'a check sums one term or more');
});

test('a variant never starts with more bands than it may hold: the generic count and sheet-default rules', () => {
  assert.ok(problems(texts((d, at) => { at(contour, 'CONTOUR_BAND_COUNTS').value.small.default = 3; })).includes('CONTOUR_BAND_COUNTS:sheet-default'));
  assert.ok(problems(texts((d, at) => { at(contour, 'CONTOUR_BAND_COUNTS').value.desk.default = 0; })).includes('CONTOUR_BAND_ONS:count'), 'a count that starts with no band');
  assert.ok(problems(texts((d, at) => { at(contour, 'CONTOUR_BAND_COUNTS').value.desk.default = 2.5; })).includes('CONTOUR_BAND_ONS:count'));
  assert.deepEqual(problems(texts((d, at) => { at(contour, 'CONTOUR_BAND_COUNTS').value.huge = { default: 62, max: 62 }; })), [], 'a variant above the maximum is the owner\'s to answer, no rule here');
  // any sheet, not a kernel's only: a group's default below its min
  assert.ok(problems(texts((d) => { d['data/limits.json'] = { $schema: '../schema/omx-contract.schema.json', ACME_SHEET: { kind: 'sheet', doc: 'A sheet.', value: { knob: { min: 2, default: 1, max: 4 } } } }; }))
    .includes('ACME_SHEET:sheet-default'));
});

test('a set\'s ids appended are MINOR, changed or removed MAJOR, its default added or removed MAJOR', () => {
  const base = resolvedOf(texts());
  const level = (fn) => classify(base, resolvedOf(texts(fn))).level;
  assert.equal(level((d, at) => { at(contour, 'CONTOUR_BAND_TYPES').ids.push('notch'); delete at(contour, 'CONTOUR_BAND_TYPES').labels; }), 'minor');
  assert.equal(level((d, at) => { at(contour, 'CONTOUR_BAND_TYPES').ids[0] = 'bell'; at(contour, 'CONTOUR_BAND_TYPES').default = 'bell'; }), 'major');
  assert.equal(level((d, at) => { at(contour, 'CONTOUR_BAND_TYPES').ids.pop(); at(contour, 'CONTOUR_BAND_TYPES').labels.pop(); }), 'major');
  assert.equal(level((d, at) => { delete at(contour, 'CONTOUR_BAND_TYPES').default; }), 'major');
  assert.equal(level((d, at) => { at(contour, 'CONTOUR_BAND_TYPES').labels[0] = 'Bell'; }), 'patch');
});

test('the union resolves: every item of every file, a sheet\'s reference followed', () => {
  const data = loadData(UNION);
  const r = resolveData(data);
  for (const n of data.items.keys()) assert.ok(r.has(n), n);
  assert.deepEqual(r.get('CONTOUR_BAND_COUNTS').value.desk, { default: 3, max: 12 });
});
