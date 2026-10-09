// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { main } from '../bin/omx-contract.mjs';
import { bumpOf, classify, refusal } from '../lib/semver.mjs';
import { DATA, dropDecl, editData, resolvedOf, scratchData, texts } from './helpers.mjs';

const base = resolvedOf(texts());
const level = (fn) => classify(base, resolvedOf(texts(fn))).level;

test('no change is none', () => assert.equal(classify(base, base).level, 'none'));
test('doc text is PATCH', () => assert.equal(level((d) => { d['data/rates.json'].RT_HARD_TARGET.doc = 'reworded'; }), 'patch'));
test('a default moved inside its travel is MINOR', () => assert.equal(level((d, at) => { at('data/kernels/gate.json', 'GATE_LIMITS.ratio').default = 10; }), 'minor'));
test('a travel widened is MINOR', () => assert.equal(level((d, at) => { at('data/kernels/gate.json', 'GATE_LIMITS.ratio').max = 200; }), 'minor'));
test('a travel narrowed is MAJOR', () => assert.equal(level((d, at) => { at('data/kernels/gate.json', 'GATE_LIMITS.ratio').max = 50; }), 'major'));
test('a unit changed is MAJOR', () => assert.equal(level((d, at) => { at('data/kernels/gate.json', 'GATE_LIMITS.ratio').unit = '%'; }), 'major'));
test('a kernel constant changed is MAJOR', () => assert.equal(level((d, at) => { at('data/kernels/transient.json', 'TRANSIENT_REF_DB').value = 7; }), 'major'));
test('a derived constant changed is MAJOR', () => assert.equal(level((d) => { d['data/primitives.json'].FDELAY_MOD_READ_ORDER.value = 5; }), 'major'));
test('an item added is MINOR, removed is MINOR in the development phase and MAJOR after it', () => {
  assert.equal(level((d) => { d['data/rates.json'].NEW_RATE = { kind: 'scalar', doc: 'new', unit: 'Hz', value: 1 }; }), 'minor');
  const gone = texts((d) => { dropDecl('data/kernels/chorus.json', d['data/kernels/chorus.json'], 'CHORUS_SPREAD_RANGE'); });
  const r = classify(resolvedOf(texts()), resolvedOf(gone));
  assert.equal(r.level, 'minor');
  assert.match(r.changes[0].what, /development phase: every consumer is omx-dsp, omx-plugins, openmixer/);
  assert.equal(classify(resolvedOf(texts()), resolvedOf(gone), { developmentPhase: null }).level, 'major');
});
test('a list member appended is MINOR, changed is MAJOR', () => {
  assert.equal(level((d) => { d['data/rates.json'].STANDARD_SAMPLE_RATES.values.push(384000); }), 'minor');
  assert.equal(level((d) => { d['data/rates.json'].STANDARD_SAMPLE_RATES.values[0] = 32000; }), 'major');
});
test('an alias removed is MAJOR', () => assert.equal(level((d, at) => { delete at('data/kernels/delay.json', 'FX_DELAY_TIME_RANGE').c; }), 'major'));

test('the bump must cover the class', () => {
  assert.equal(bumpOf('1.0.0', '1.1.0'), 'minor');
  assert.equal(refusal('minor', '1.0.0', '1.0.1'), 'the changes since 1.0.0 are MINOR, and 1.0.0 -> 1.0.1 is a patch bump');
  assert.equal(refusal('major', 'v1.2.3', '2.0.0'), null);
  assert.match(refusal('patch', '1.2.0', '1.1.0'), /lower/);
});

test('the CLI refuses a short bump and passes a sufficient one', () => {
  const dir = scratchData();
  editData(dir, 'kernels/gate.json', (d, at) => { at('GATE_LIMITS.ratio').max = 50; });
  assert.equal(main(['semver', '--from-dir', DATA, '--from-version', '1.0.0', '--data', dir, '--version', '1.1.0']), 1);
  assert.equal(main(['semver', '--from-dir', DATA, '--from-version', '1.0.0', '--data', dir, '--version', '2.0.0']), 0);
});
