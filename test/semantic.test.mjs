// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { lagrangeReadL1, loadData } from '../lib/data.mjs';
import { validateData } from '../lib/validate.mjs';
import { resolvedOf, texts } from './helpers.mjs';

const problems = (t) => validateData(loadData(null, t));
const has = (t, item, rule) => problems(t).some((p) => p.item === item && p.rule === rule);

test('a default outside its travel is refused, by item and field', () => {
  const t = texts((d) => { d['data/kernels/gate.json'].GATE_LIMITS.fields.ratio.default = 101; });
  assert.ok(has(t, 'GATE_LIMITS', 'default-inside'));
  assert.match(problems(t)[0].message, /GATE_LIMITS\.ratio: default 101 outside \[1, 100\]/);
});

test('a byKind default outside its travel is refused', () => {
  assert.ok(has(texts((d) => { d['data/kernels/delay.json'].DELAY_MIX_RANGE.travel.byKind.fxReturn = 2; }), 'DELAY_MIX_RANGE', 'default-inside'));
});

test('a reference that does not resolve is refused', () => {
  assert.ok(has(texts((d) => { d['data/primitives.json'].XOVER_LIMITS.value.lr4SectionQ = { ref: 'BUTTERWORTH_QQ' }; }), 'XOVER_LIMITS', 'reference'));
});

test('a reference cycle is refused', () => {
  const t = texts((d) => {
    d['data/primitives.json'].BUTTERWORTH_Q.value = { ref: 'XOVER_LIMITS.lr4SectionQ' };
  });
  assert.ok(problems(t).some((p) => p.rule === 'reference' && /cycle/.test(p.message)));
});

test('a c.alias that spells another item is refused', () => {
  assert.ok(has(texts((d) => { d['data/kernels/delay.json'].FX_DELAY_TIME_RANGE.c.alias = { fact: 'delay', field: 'toneRange' }; }), 'FX_DELAY_TIME_RANGE', 'alias'));
});

test('two items rendering one C name are refused', () => {
  const t = texts((d) => { d['data/kernels/eq.json'].XOVER_LR2_SECTION = { kind: 'sheet', doc: 'collides', value: { q: 1 } }; });
  assert.ok(problems(t).some((p) => p.rule === 'render-c' && /OMX_XOVER_LR2_SECTION_Q/.test(p.message)));
});

test("a plugin's parameters only grow at the end", () => {
  const t = texts((d) => { d['data/plugins/delay.json'].DELAY_PLUGIN.params[1].since = '1.1.0'; });
  assert.ok(has(t, 'DELAY_PLUGIN', 'append-only'));
});

test('a toggle must read a boolean, a travel must read a travel', () => {
  assert.ok(problems(texts((d) => { d['data/plugins/delay.json'].DELAY_PLUGIN.params[4].from = 'EQ_MAX_BANDS'; })).length > 0);
  assert.ok(problems(texts((d) => { d['data/plugins/delay.json'].DELAY_PLUGIN.params[0].from = 'EQ_MAX_BANDS'; })).length > 0);
});

test('the derivations evaluate to the built values openmixer computes', () => {
  const r = resolvedOf(texts());
  assert.equal(r.get('BUTTERWORTH_Q').value, Math.SQRT1_2);
  assert.equal(r.get('DRIVE_BIAS_MAX').value, Math.SQRT1_2);
  assert.equal(r.get('XOVER_LIMITS').value.lr4SectionQ, Math.SQRT1_2);
  assert.equal(r.get('PITCH_KERNEL').value.prefilterQ, Math.SQRT1_2);
  assert.equal(r.get('FDELAY_READ_L1_NORM').value, 1.25);
  assert.equal(lagrangeReadL1(1), 1);
  assert.equal(r.get('GEQ_BANDS').value, r.get('ISO_THIRD_OCTAVE_CENTRES_HZ').value.length);
});

test('a reference follows its target: move BUTTERWORTH_Q and both readers move', () => {
  const r = resolvedOf(texts((d) => { d['data/primitives.json'].BUTTERWORTH_Q.value = { derive: 'sqrt', of: 0.49 }; }));
  assert.equal(r.get('XOVER_LIMITS').value.lr4SectionQ, 0.7);
  assert.equal(r.get('PITCH_KERNEL').value.prefilterQ, 0.7);
});
