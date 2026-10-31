// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadData } from '../lib/data.mjs';
import { validateData } from '../lib/validate.mjs';
import { DATA, ROOT, UNION, VOCABULARY, relOf, texts } from './helpers.mjs';
import { addedAfterFirstRelease } from '../tools/proof/round-trip.mjs';

const rules = (t) => validateData(loadData(null, t)).map((p) => `${p.item}:${p.rule}`);

test('the shipped data is valid, alone and with the owners\' files', () => {
  assert.deepEqual(validateData(loadData(DATA)), []);
  assert.deepEqual(validateData(loadData(UNION)), []);
});

test('data/ holds the union less the files their owners install: 8 of the 229 items of 2.14.0, the quanta and the param-contract units, none of them twice, and the vocabulary', () => {
  const own = [...loadData(DATA).items.keys()].filter((n) => !VOCABULARY.has(n));
  const owners = new Set([...loadData(UNION).items.keys()].filter((n) => !own.includes(n) && !VOCABULARY.has(n)));
  assert.deepEqual(own.sort(), ['OMX_PARAM_CONTRACT_UNITS', 'ORACLE_FLOOR_RATES', 'ORACLE_FULL_RATES', 'PARAM_SCALES', 'READOUT_RATE_HZ', 'RT_HARD_TARGET', 'STANDARD_QUANTA', 'STANDARD_SAMPLE_RATES']);
  assert.equal(owners.size, 222);
  assert.equal(loadData(UNION).items.size, 229 + VOCABULARY.size);
  for (const n of ['GATE_LIMITS', 'HOSTED_STAGE_LIMITS', 'HOSTING_CODES', 'FX_DELAY_TIME_RANGE', 'PAN_RANGE', 'EQ_MAX_BANDS', 'BUTTERWORTH_Q', 'OUTPUT_DELAY_RANGE']) assert.ok(owners.has(n), `${n} is an owner's`);
});

test('the shipped data holds exactly the specified items and the items of the kernels added since', () => {
  const want = ['GATE_LIMITS', 'COMP_LIMITS', 'LIMITER_LIMITS', 'TRANSIENT_LIMITS', 'PITCH_LIMITS', 'TRANSIENT_FAST_ATTACK_MS',
    'TRANSIENT_FAST_RELEASE_MS', 'TRANSIENT_REF_DB', 'TRANSIENT_FLOOR_LIN', 'PROGRAM_RELEASE', 'PITCH_KERNEL', 'BUTTERWORTH_Q',
    'ALLPASS_LIMITS', 'XOVER_LIMITS', 'FDELAY_MOD_READ_ORDER', 'FDELAY_READ_L1_NORM', 'FX_DELAY_TIME_RANGE', 'FX_DELAY_FEEDBACK_RANGE',
    'DELAY_TONE_RANGE', 'DELAY_MIX_RANGE', 'FX_DELAY_PINGPONG_DEFAULT', 'CHORUS_SPREAD_RANGE', 'REVERB_PLATE_MOD_DEPTH_RANGE',
    'DRIVE_BIAS_MAX', 'DSP_KNOB_REFERENCE_RATE', 'EQ_MAX_BANDS', 'ISO_THIRD_OCTAVE_CENTRES_HZ', 'GEQ_BANDS', 'STANDARD_SAMPLE_RATES',
    'RT_HARD_TARGET'];
  const later = [...addedAfterFirstRelease(ROOT)];
  // the one 1.0.0 item counted as added later is the list whose C render 1.3.0 switched on (`renderedSince`)
  assert.deepEqual(later.filter((n) => want.includes(n)), ['ISO_THIRD_OCTAVE_CENTRES_HZ'], 'no other 1.0.0 item is counted as added later');
  for (const n of later) if (!want.includes(n)) want.push(n);
  // the shared items added since, which no kernel answers and that carry no release of their own:
  // 1.2.0's plugin-face travels in primitives.json (TRIM_TRAVELS moved to the trim kernel in 2.3.0)
  want.push('GATE_CONTINUOUS_TRAVELS', 'COMP_CONTINUOUS_TRAVELS');
  assert.deepEqual([...loadData(UNION).items.keys()].filter((n) => !VOCABULARY.has(n)).sort(), want.filter((n) => !VOCABULARY.has(n)).sort());
});

test('a unit outside the closed list is refused', () => {
  assert.ok(rules(texts((d, at) => { at('data/kernels/gate.json', 'GATE_LIMITS.thresholdDb').unit = 'decibel'; })).includes('GATE_LIMITS:schema'));
});

test('a sixth kind is refused', () => {
  assert.ok(rules(texts((d, at) => { at('data/kernels/eq.json', 'EQ_MAX_BANDS').kind = 'expression'; })).includes('EQ_MAX_BANDS:schema'));
});

test('a derivation outside the closed list is refused', () => {
  assert.ok(rules(texts((d, at) => { at('data/kernels/drive.json', 'DRIVE_BIAS_MAX').value = { derive: 'eval', of: '1/sqrt(2)' }; })).includes('DRIVE_BIAS_MAX:schema'));
});

test('an unknown key, a missing doc and a lower-case name are refused', () => {
  assert.ok(rules(texts((d) => { d['data/rates.json'].RT_HARD_TARGET.colour = 'red'; })).includes('RT_HARD_TARGET:schema'));
  assert.ok(rules(texts((d) => { delete d[relOf('DSP_KNOB_REFERENCE_RATE')].DSP_KNOB_REFERENCE_RATE.doc; })).includes('DSP_KNOB_REFERENCE_RATE:schema'));
  assert.ok(rules(texts((d) => { d['data/rates.json'].lowerName = d[relOf('DSP_KNOB_REFERENCE_RATE')].DSP_KNOB_REFERENCE_RATE; })).length > 0);
});

test('a travels item carries fields or one travel, never both', () => {
  assert.ok(rules(texts((d, at) => { const t = at('data/kernels/chorus.json', 'CHORUS_SPREAD_RANGE'); t.fields = { a: t.travel }; })).includes('CHORUS_SPREAD_RANGE:schema'));
});

test('a file names the schema by its relative path', () => {
  assert.ok(rules(texts((d) => { d['data/kernels/eq.json'].$schema = 'omx-contract.schema.json'; })).includes('-:schema-path'));
});

test('a set id is letters and digits, and may start with a digit (#28)', () => {
  const ovs = (id) => rules(texts((d, at) => { const s = at('data/kernels/comp.json', 'DETECTOR_OVERSAMPLINGS'); s.ids[2] = id; s.default = id; }));
  assert.ok(!ovs('4x').includes('DETECTOR_OVERSAMPLINGS:schema'), 'an id that starts with a digit is accepted');
  for (const bad of ['4-x', '4 x', '']) assert.ok(ovs(bad).includes('DETECTOR_OVERSAMPLINGS:schema'), `${JSON.stringify(bad)} is refused`);
});

test('a set\'s ids may carry a value each, in a unit, null for none (#29)', () => {
  // a set of named ids, so a value can be planted on it: the comp's kinds
  const kinds = (fn) => rules(texts((d, at) => fn(at('data/kernels/comp.json', 'COMP_KINDS'))));
  assert.deepEqual(kinds((s) => { s.values = [null, 4]; s.unit = 'x'; }), [], 'a value per id, null for none, is valid');
  assert.ok(kinds((s) => { s.values = [null, 4]; }).includes('COMP_KINDS:schema'), 'values without a unit');
  assert.ok(kinds((s) => { s.unit = 'Hz'; }).includes('COMP_KINDS:schema'), 'a unit without values');
  assert.ok(kinds((s) => { s.values = [null, 'fast']; s.unit = 'x'; }).includes('COMP_KINDS:schema'), 'a value that is no number');
  assert.ok(kinds((s) => { s.values = [4]; s.unit = 'x'; }).includes('COMP_KINDS:set-values'), 'fewer values than ids');
  assert.ok(kinds((s) => { s.values = [null, null]; s.unit = 'x'; }).includes('COMP_KINDS:set-values'), 'no id carries a value');
  assert.ok(rules(texts((d, at) => { const s = at('data/kernels/drive.json', 'DRIVE_OVERSAMPLES'); s.values = [1, 2, 4]; s.unit = 'x'; }))
    .includes('DRIVE_OVERSAMPLES:set-values'), 'a numeric id is its own value');
});
