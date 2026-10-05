// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadData } from '../lib/data.mjs';
import { validateData } from '../lib/validate.mjs';
import { DATA, texts } from './helpers.mjs';

const rules = (t) => validateData(loadData(null, t)).map((p) => `${p.item}:${p.rule}`);

test('the shipped data is valid', () => {
  assert.deepEqual(validateData(loadData(DATA)), []);
});

test('the shipped data holds exactly the spec §4.1 items', () => {
  const want = ['GATE_LIMITS', 'COMP_LIMITS', 'LIMITER_LIMITS', 'TRANSIENT_LIMITS', 'PITCH_LIMITS', 'TRANSIENT_FAST_ATTACK_MS',
    'TRANSIENT_FAST_RELEASE_MS', 'TRANSIENT_REF_DB', 'TRANSIENT_FLOOR_LIN', 'PROGRAM_RELEASE', 'PITCH_KERNEL', 'BUTTERWORTH_Q',
    'ALLPASS_LIMITS', 'XOVER_LIMITS', 'FDELAY_MOD_READ_ORDER', 'FDELAY_READ_L1_NORM', 'FX_DELAY_TIME_RANGE', 'FX_DELAY_FEEDBACK_RANGE',
    'DELAY_TONE_RANGE', 'DELAY_MIX_RANGE', 'FX_DELAY_PINGPONG_DEFAULT', 'CHORUS_SPREAD_RANGE', 'REVERB_PLATE_MOD_DEPTH_RANGE',
    'DRIVE_BIAS_MAX', 'DSP_KNOB_REFERENCE_RATE', 'EQ_MAX_BANDS', 'ISO_THIRD_OCTAVE_CENTRES_HZ', 'GEQ_BANDS', 'STANDARD_SAMPLE_RATES',
    'RT_HARD_TARGET', 'DELAY_PLUGIN'];
  assert.deepEqual([...loadData(DATA).items.keys()].sort(), want.sort());
});

test('a unit outside the closed list is refused', () => {
  assert.ok(rules(texts((d) => { d['data/kernels/gate.json'].GATE_LIMITS.fields.thresholdDb.unit = 'decibel'; })).includes('GATE_LIMITS:schema'));
});

test('a sixth kind is refused', () => {
  assert.ok(rules(texts((d) => { d['data/kernels/eq.json'].EQ_MAX_BANDS.kind = 'expression'; })).includes('EQ_MAX_BANDS:schema'));
});

test('a derivation outside the closed list is refused', () => {
  assert.ok(rules(texts((d) => { d['data/kernels/drive.json'].DRIVE_BIAS_MAX.value = { derive: 'eval', of: '1/sqrt(2)' }; })).includes('DRIVE_BIAS_MAX:schema'));
});

test('an unknown key, a missing doc and a lower-case name are refused', () => {
  assert.ok(rules(texts((d) => { d['data/rates.json'].RT_HARD_TARGET.colour = 'red'; })).includes('RT_HARD_TARGET:schema'));
  assert.ok(rules(texts((d) => { delete d['data/rates.json'].DSP_KNOB_REFERENCE_RATE.doc; })).includes('DSP_KNOB_REFERENCE_RATE:schema'));
  assert.ok(rules(texts((d) => { d['data/rates.json'].lowerName = d['data/rates.json'].DSP_KNOB_REFERENCE_RATE; })).length > 0);
});

test('a travels item carries fields or one travel, never both', () => {
  assert.ok(rules(texts((d) => { const t = d['data/kernels/chorus.json'].CHORUS_SPREAD_RANGE; t.fields = { a: t.travel }; })).includes('CHORUS_SPREAD_RANGE:schema'));
});

test('a file names the schema by its relative path', () => {
  assert.ok(rules(texts((d) => { d['data/kernels/eq.json'].$schema = 'omx-contract.schema.json'; })).includes('-:schema-path'));
});
