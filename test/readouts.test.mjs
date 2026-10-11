// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
// A kernel's readouts (docs/readouts.md): the shape the schema holds them to, the rules about their numbers, the
// one formatting, the c, ts and json renders, and how semver classifies a change to one.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadData } from '../lib/data.mjs';
import { formatDoc } from '../lib/fmt.mjs';
import { classify } from '../lib/semver.mjs';
import { validateData } from '../lib/validate.mjs';
import { renderC } from '../render/c.mjs';
import { renderJson } from '../render/json.mjs';
import { renderTs } from '../render/ts.mjs';
import { resolvedOf, texts } from './helpers.mjs';

const gate = 'data/kernels/gate.json';
const readout = (over = {}) => ({ name: 'gainReductionDb', doc: 'The gate gain reduction.', unit: 'dB', min: { ref: 'GATE_LIMITS.rangeDb.min' }, max: 0, scale: 'linear', rateHz: 50, ...over });
const second = readout({ name: 'keyLevelDb', doc: 'The key level.', unit: 'dBFS', min: -80, rateHz: 12.5 });
/** The data with the gate's readouts set to `list` (and `fn` applied after). */
const withReadouts = (list, fn) => texts((d, at) => { d[gate].readouts = list; fn?.(d, at); });
const problems = (t) => validateData(loadData(null, t)).map((p) => `${p.item}:${p.rule}:${p.message}`).join('\n');

test('readouts are valid beside the controls, and refused by shape, schema and meaning', () => {
  assert.equal(problems(withReadouts([readout(), second])), '');
  assert.match(problems(withReadouts({ gainReductionDb: readout() })), /readouts must be a list/);
  assert.match(problems(withReadouts([readout(), readout()])), /readouts\[1\]: name gainReductionDb declared twice/);
  assert.match(problems(withReadouts([readout({ scale: undefined })])), /readouts\[0\]:schema:\/readouts\/0 must have required property 'scale'/);
  assert.match(problems(withReadouts([readout({ unit: 'volts' })])), /readouts\[0\]:schema:\/readouts\/0\/unit must be equal to one of the allowed values/);
  assert.match(problems(withReadouts([readout({ colour: 'red' })])), /readouts\[0\]:schema:\/readouts\/0 must NOT have additional properties/);
  assert.match(problems(withReadouts([readout({ name: 'GR' })])), /readouts\[0\]:schema:\/readouts\/0\/name must match pattern/);
  assert.match(problems(withReadouts([readout({ scale: 'exp' })])), /gate\.readouts\.gainReductionDb:scale:.*scale "exp" is not an id of PARAM_SCALES/);
  assert.match(problems(withReadouts([readout({ min: 0 })])), /gate\.readouts\.gainReductionDb:readout-range:.*min 0 is not below max 0/);
  assert.match(problems(withReadouts([readout({ rateHz: 0 })])), /gate\.readouts\.gainReductionDb:readout-rate:.*rateHz 0 is not positive/);
  assert.match(problems(withReadouts([readout({ max: { ref: 'GATE_LIMITS.nothing' } })])), /reference GATE_LIMITS\.nothing: GATE_LIMITS has no nothing/);
  assert.match(problems(withReadouts([readout()], (d) => { d['data/rates.json'].READOUTS = { kind: 'scalar', doc: 'x', unit: '', value: 1 }; })), /READOUTS:readouts-name/);
});

test('a readout declares no item, and fmt spells it in its one key order after the controls', () => {
  const plain = loadData(null, texts());
  const t = withReadouts([readout()]);
  assert.deepEqual([...loadData(null, t).items.keys()], [...plain.items.keys()], 'the items are those of the data without readouts');
  const doc = JSON.parse(t[gate]);
  const { controls, ...rest } = doc;
  const shuffled = { ...rest, readouts: [{ rateHz: 50, scale: 'linear', max: 0, min: -90, unit: 'dB', doc: 'x', name: 'gainReductionDb' }], controls };
  const out = JSON.parse(formatDoc(shuffled));
  assert.deepEqual(Object.keys(out).slice(0, 3), ['$schema', 'controls', 'readouts']);
  assert.deepEqual(Object.keys(out.readouts[0]), ['name', 'doc', 'unit', 'min', 'max', 'scale', 'rateHz']);
});

test('the c render: an enum of the readouts at their position, the count, and each one\'s range, rate, scale and unit', () => {
  const h = renderC(resolvedOf(withReadouts([readout(), second])))[0].text;
  assert.match(h, /^enum omx_gate_readouts \{\n {2}OMX_GATE_READOUT_GAIN_REDUCTION_DB = 0,\n {2}OMX_GATE_READOUT_KEY_LEVEL_DB = 1,\n\};\n#define OMX_GATE_READOUT_COUNT 2u$/m);
  assert.match(h, /^#define OMX_GATE_READOUT_GAIN_REDUCTION_DB_MIN -90\.0f\n#define OMX_GATE_READOUT_GAIN_REDUCTION_DB_MAX 0\.0f\n#define OMX_GATE_READOUT_GAIN_REDUCTION_DB_RATE_HZ 50\n#define OMX_GATE_READOUT_GAIN_REDUCTION_DB_SCALE OMX_PARAM_SCALES_LINEAR\n#define OMX_GATE_READOUT_GAIN_REDUCTION_DB_UNIT "dB"$/m);
  assert.match(h, /^#define OMX_GATE_READOUT_KEY_LEVEL_DB_MIN -80\.0f$/m);
  assert.match(h, /^#define OMX_GATE_READOUT_KEY_LEVEL_DB_RATE_HZ 12\.5f$/m);
  assert.match(h, /^#define OMX_GATE_READOUT_KEY_LEVEL_DB_UNIT "dBFS"$/m);
  assert.ok(h.indexOf('enum omx_param_scales') < h.indexOf('enum omx_gate_readouts'), 'the scale enum is declared before a readout names it');
  assert.doesNotMatch(renderC(resolvedOf(texts()))[0].text, /READOUT_/, 'no readout, no readout block');
});

test('the ts and json renders: every readout resolved, by kernel, in order', () => {
  const r = resolvedOf(withReadouts([readout(), second]));
  const want = [
    { name: 'gainReductionDb', doc: 'The gate gain reduction.', unit: 'dB', min: -90, max: 0, scale: 'linear', rateHz: 50 },
    { name: 'keyLevelDb', doc: 'The key level.', unit: 'dBFS', min: -80, max: 0, scale: 'linear', rateHz: 12.5 },
  ];
  assert.deepEqual(JSON.parse(renderJson(r, '0.0.0')[0].text).kernels.gate.readouts, want);
  const [js, dts] = renderTs(r).map((f) => f.text);
  assert.deepEqual(JSON.parse(/^export const READOUTS = ([\s\S]*?);$/m.exec(js)[1]), { gate: want });
  assert.match(dts, /^export declare const READOUTS: \{\n {2}readonly gate: readonly \[\{\n {4}readonly name: "gainReductionDb";[\s\S]*readonly rateHz: 12\.5;\n {2}\}\];\n\};$/m);
  const plain = resolvedOf(texts());
  assert.equal(JSON.parse(renderJson(plain, '0.0.0')[0].text).kernels.gate.readouts, undefined, 'a kernel with none carries no readouts');
  assert.doesNotMatch(renderTs(plain)[0].text, /READOUTS/);
});

test('semver: a readout appended is MINOR; removed is MINOR in the development phase, MAJOR after; moved or its unit changed is MAJOR', () => {
  const one = resolvedOf(withReadouts([readout()]));
  const cls = (list, opts) => classify(one, resolvedOf(withReadouts(list)), opts);
  assert.equal(classify(one, one).level, 'none');
  assert.equal(classify(resolvedOf(texts()), one).level, 'minor');
  assert.equal(cls([readout(), second]).level, 'minor');
  assert.equal(cls([second, readout()]).level, 'major');
  assert.match(cls([second, readout()]).changes.map((c) => c.what).join('\n'), /readout moved \(id 0 -> 1\)/);
  assert.equal(cls([]).level, 'minor');
  assert.equal(cls([], { developmentPhase: null }).level, 'major');
  assert.equal(cls([readout({ unit: 'dBFS' })]).level, 'major');
  assert.equal(cls([readout({ min: -60 })]).level, 'minor');
  assert.equal(cls([readout({ scale: 'log' })]).level, 'minor');
  assert.equal(cls([readout({ rateHz: 25 })]).level, 'minor');
  assert.equal(cls([readout({ doc: 'Reworded.' })]).level, 'patch');
});
