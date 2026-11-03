// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadData } from '../lib/data.mjs';
import { validateData } from '../lib/validate.mjs';
import { DATA, DATA_ITEMS, ROOT, UNION, VOCABULARY, relOf, texts } from './helpers.mjs';

const rules = (t) => validateData(loadData(null, t)).map((p) => `${p.item}:${p.rule}`);

test('the shipped data is valid, alone and with the invented kernels and the hosting file', () => {
  assert.deepEqual(validateData(loadData(DATA)), []);
  assert.deepEqual(validateData(loadData(UNION)), []);
});

test('data/ holds the quanta, the rates, the scales, the readout rate, the param-contract units and the vocabulary; every kernel and primitive is its owner\'s', () => {
  const own = [...loadData(DATA).items.keys()].filter((n) => !VOCABULARY.has(n));
  const owners = new Set([...loadData(UNION).items.keys()].filter((n) => !own.includes(n) && !VOCABULARY.has(n)));
  assert.deepEqual(own.sort(), ['OMX_PARAM_CONTRACT_UNITS', 'ORACLE_FLOOR_RATES', 'ORACLE_FULL_RATES', 'PARAM_SCALES', 'READOUT_RATE_HZ', 'RT_HARD_TARGET', 'STANDARD_QUANTA', 'STANDARD_SAMPLE_RATES']);
  assert.equal(loadData(UNION).items.size, DATA_ITEMS + owners.size, 'the files beside data/ shadow none of its items');
  for (const n of ['SWELL_LIMITS', 'HOSTED_STAGE_LIMITS', 'HOSTING_CODES', 'ECHO_TIME_RANGE', 'CONTOUR_MAX_BANDS', 'TOOL_Q']) assert.ok(owners.has(n), `${n} is beside data/`);
  assert.ok(![...owners].some((n) => loadData(DATA).items.has(n)));
});

test('a unit outside the closed list is refused', () => {
  assert.ok(rules(texts((d, at) => { at('data/kernels/swell.json', 'SWELL_LIMITS.thresholdDb').unit = 'decibel'; })).includes('SWELL_LIMITS:schema'));
});

test('a sixth kind is refused', () => {
  assert.ok(rules(texts((d, at) => { at('data/kernels/contour.json', 'CONTOUR_MAX_BANDS').kind = 'expression'; })).includes('CONTOUR_MAX_BANDS:schema'));
});

test('a derivation outside the closed list is refused', () => {
  assert.ok(rules(texts((d, at) => { at('data/kernels/contour.json', 'CONTOUR_CENTRE_COUNT').value = { derive: 'eval', of: 'len(CONTOUR_CENTRES_HZ)' }; })).includes('CONTOUR_CENTRE_COUNT:schema'));
});

test('an unknown key, a missing doc and a lower-case name are refused', () => {
  assert.ok(rules(texts((d) => { d['data/rates.json'].RT_HARD_TARGET.colour = 'red'; })).includes('RT_HARD_TARGET:schema'));
  assert.ok(rules(texts((d) => { delete d[relOf('TOOL_READ_ORDER')].TOOL_READ_ORDER.doc; })).includes('TOOL_READ_ORDER:schema'));
  assert.ok(rules(texts((d) => { d['data/rates.json'].lowerName = d[relOf('TOOL_READ_ORDER')].TOOL_READ_ORDER; })).length > 0);
});

test('a travels item carries fields or one travel, never both', () => {
  assert.ok(rules(texts((d, at) => { const t = at('data/kernels/echo.json', 'ECHO_FEEDBACK_RANGE'); t.fields = { a: t.travel }; })).includes('ECHO_FEEDBACK_RANGE:schema'));
});

test('a file names the schema by its relative path', () => {
  assert.ok(rules(texts((d) => { d['data/kernels/contour.json'].$schema = 'omx-contract.schema.json'; })).includes('-:schema-path'));
});

test('a set id is letters and digits, and may start with a digit (#28)', () => {
  const ovs = (id) => rules(texts((d, at) => { const s = at('data/kernels/swell.json', 'SWELL_OVERSAMPLINGS'); s.ids[2] = id; s.default = id; }));
  assert.ok(!ovs('4x').includes('SWELL_OVERSAMPLINGS:schema'), 'an id that starts with a digit is accepted');
  for (const bad of ['4-x', '4 x', '']) assert.ok(ovs(bad).includes('SWELL_OVERSAMPLINGS:schema'), `${JSON.stringify(bad)} is refused`);
});

test('a set\'s ids may carry a value each, in a unit, null for none (#29)', () => {
  // a set of named ids, so a value can be planted on it: the swell's kinds
  const kinds = (fn) => rules(texts((d, at) => fn(at('data/kernels/swell.json', 'SWELL_KINDS'))));
  assert.deepEqual(kinds((s) => { s.values = [null, 4]; s.unit = 'x'; }), [], 'a value per id, null for none, is valid');
  assert.ok(kinds((s) => { s.values = [null, 4]; }).includes('SWELL_KINDS:schema'), 'values without a unit');
  assert.ok(kinds((s) => { s.unit = 'Hz'; }).includes('SWELL_KINDS:schema'), 'a unit without values');
  assert.ok(kinds((s) => { s.values = [null, 'fast']; s.unit = 'x'; }).includes('SWELL_KINDS:schema'), 'a value that is no number');
  assert.ok(kinds((s) => { s.values = [4]; s.unit = 'x'; }).includes('SWELL_KINDS:set-values'), 'fewer values than ids');
  assert.ok(kinds((s) => { s.values = [null, null]; s.unit = 'x'; }).includes('SWELL_KINDS:set-values'), 'no id carries a value');
  assert.ok(rules(texts((d, at) => { const s = at('data/kernels/contour.json', 'CONTOUR_OVERSAMPLES'); s.values = [1, 2, 8]; s.unit = 'x'; }))
    .includes('CONTOUR_OVERSAMPLES:set-values'), 'a numeric id is its own value');
});
