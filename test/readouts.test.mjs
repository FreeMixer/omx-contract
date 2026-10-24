// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
// A kernel's readouts (docs/readouts.md): the shape the schema holds them to, the rules about their numbers, the
// one formatting, the c, ts and json renders, and how semver classifies a change to one.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { loadData } from '../lib/data.mjs';
import { formatDoc } from '../lib/fmt.mjs';
import { classify } from '../lib/semver.mjs';
import { validateData } from '../lib/validate.mjs';
import { renderC } from '../render/c.mjs';
import { renderJson } from '../render/json.mjs';
import { renderTs } from '../render/ts.mjs';
import { DATA, ROOT, UNION, resolvedOf, texts } from './helpers.mjs';

const gate = 'data/kernels/gate.json';
const readout = (over = {}) => ({ name: 'gainReductionDb', doc: 'The gate gain reduction.', unit: 'dB', min: { ref: 'GATE_LIMITS.rangeDb.min' }, max: 0, scale: 'linear', rateHz: 50, ...over });
const second = readout({ name: 'keyLevelDb', doc: 'The key level.', unit: 'dBFS', min: -80, rateHz: 12.5 });
/** The data with no kernel declaring readouts. */
const bare = () => texts((d) => { for (const doc of Object.values(d)) delete doc.readouts; });
/** The data with only the gate declaring readouts, `list` (and `fn` applied after). */
const withReadouts = (list, fn) => texts((d, at) => { for (const doc of Object.values(d)) delete doc.readouts; d[gate].readouts = list; fn?.(d, at); });
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
  const plain = loadData(null, bare());
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
  assert.doesNotMatch(renderC(resolvedOf(bare()))[0].text, /enum omx_\w+_readouts/, 'no readout, no readout block');
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
  const plain = resolvedOf(bare());
  assert.equal(JSON.parse(renderJson(plain, '0.0.0')[0].text).kernels.gate.readouts, undefined, 'a kernel with none carries no readouts');
  assert.doesNotMatch(renderTs(plain)[0].text, /READOUTS/);
});

test('semver: a readout appended is MINOR; removed is MINOR in the development phase, MAJOR after; moved or its unit changed is MAJOR', () => {
  const one = resolvedOf(withReadouts([readout()]));
  const cls = (list, opts) => classify(one, resolvedOf(withReadouts(list)), opts);
  assert.equal(classify(one, one).level, 'none');
  assert.equal(classify(resolvedOf(bare()), one).level, 'minor');
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

test('the readouts declared: the gain reduction of the four dynamics kernels, each range read off the travel that bounds it', () => {
  const data = loadData(UNION);
  // the gain reductions; the graphic EQ's designClamped flag (#71) is held by test/geq-mode.test.mjs
  const declared = Object.fromEntries(data.files.filter((f) => f.doc.readouts?.some((x) => x.name === 'gainReductionDb')).map((f) => [f.rel, f.doc.readouts]));
  const bound = {
    'data/kernels/comp.json': 'COMP_LIMITS.thresholdDb.min',
    'data/kernels/deesser.json': 'DEESS_RANGE_RANGE.min',
    'data/kernels/gate.json': 'GATE_LIMITS.rangeDb.min',
    'data/kernels/limiter.json': 'LIMITER_LIMITS.ceilingDb.min',
  };
  assert.deepEqual(Object.keys(declared), Object.keys(bound));
  const r = resolvedOf(texts());
  const at = (path) => path.split('.').slice(1).reduce((v, k) => v[k], r.get(path.split('.')[0]).value);
  for (const [rel, list] of Object.entries(declared)) {
    assert.deepEqual(list.map((x) => x.name), ['gainReductionDb'], rel);
    const [gr] = list;
    assert.deepEqual([gr.unit, gr.min, gr.max, gr.scale, gr.rateHz], ['dB', { ref: bound[rel] }, 0, 'linear', { ref: 'READOUT_RATE_HZ' }], `${rel}: stated once, by reference`);
    const k = rel.replace(/^.*\/|\.json$/g, '');
    assert.deepEqual([r.kernels[k].readouts[0].min, r.kernels[k].readouts[0].rateHz], [at(bound[rel]), r.get('READOUT_RATE_HZ').value], k);
    assert.ok(at(bound[rel]) < 0, `${k}: a reduction runs below 0 dB`);
  }
  assert.equal(r.get('READOUT_RATE_HZ').value, 50);
});

test('the C render keeps every 2.3.0 line, byte for byte and in order, and adds only READOUT_RATE_HZ and the readouts', () => {
  const old = readFileSync(join(ROOT, 'test/fixtures/omx-contract-2.3.0/omx_contract_limits.h'), 'utf8').split('\n');
  // the released 2.4.0 header: the release the readouts came in (later releases add their own, test/comp-topology.test.mjs)
  const now = readFileSync(join(ROOT, 'test/fixtures/omx-contract-2.4.0/omx_contract_limits.h'), 'utf8').split('\n');
  let i = 0;
  const added = [];
  for (const line of now) {
    if (i < old.length && line === old[i]) i++;
    else added.push(line);
  }
  assert.equal(i, old.length, `2.3.0 line ${i + 1} is not in the render: ${old[i]}`);
  const block = (kernel, min) => [
    `enum omx_${kernel}_readouts {`,
    `  OMX_${kernel.toUpperCase()}_READOUT_GAIN_REDUCTION_DB = 0,`,
    '};',
    `#define OMX_${kernel.toUpperCase()}_READOUT_COUNT 1u`,
    `#define OMX_${kernel.toUpperCase()}_READOUT_GAIN_REDUCTION_DB_MIN ${min}`,
    `#define OMX_${kernel.toUpperCase()}_READOUT_GAIN_REDUCTION_DB_MAX 0.0f`,
    `#define OMX_${kernel.toUpperCase()}_READOUT_GAIN_REDUCTION_DB_RATE_HZ 50`,
    `#define OMX_${kernel.toUpperCase()}_READOUT_GAIN_REDUCTION_DB_SCALE OMX_PARAM_SCALES_LINEAR`,
    `#define OMX_${kernel.toUpperCase()}_READOUT_GAIN_REDUCTION_DB_UNIT "dB"`,
  ];
  assert.deepEqual(added, [
    '#define OMX_READOUT_RATE_HZ 50',
    '/* Every kernel\'s readouts, the meters a host draws (docs/readouts.md): an enum of the readouts at their position,',
    ' * `OMX_<KERNEL>_READOUT_COUNT`, and per readout its display range (_MIN, _MAX), _RATE_HZ, _SCALE (an OMX_PARAM_SCALES_*',
    ' * member) and _UNIT. */',
    ...block('comp', '-60.0f'),
    ...block('deesser', '-24.0f'),
    ...block('gate', '-90.0f'),
    ...block('limiter', '-12.0f'),
    '',
  ]);
});

// The per-band readouts of the remaining-FX wave (docs/readouts.md, #107): the dynamic EQ's band gain (FX-1) and the
// multiband's band gain reduction (FX-3), in the grammar the single-band readouts use.
const bands = (n, stem, over = {}) => Array.from({ length: n }, (_, i) => readout({ name: `band${i + 1}${stem}`, doc: `Band ${i + 1}.`, min: -24, max: 12, rateHz: 50, ...over }));
const dyneq = () => bands(6, 'GainDb');
const multiband = () => bands(5, 'GainReductionDb', { min: -60, max: 0 });

test('per-band readouts: the dynamic EQ\'s six band gains and the multiband\'s five reductions are valid and render at their positions', () => {
  assert.equal(problems(withReadouts(dyneq())), '');
  assert.equal(problems(withReadouts(multiband())), '');
  assert.equal(problems(withReadouts([readout(), ...multiband()])), '', 'a band run after a single-band readout');
  const h = renderC(resolvedOf(withReadouts(dyneq())))[0].text;
  assert.match(h, /^ {2}OMX_GATE_READOUT_BAND1_GAIN_DB = 0,\n {2}OMX_GATE_READOUT_BAND2_GAIN_DB = 1,\n {2}OMX_GATE_READOUT_BAND3_GAIN_DB = 2,\n {2}OMX_GATE_READOUT_BAND4_GAIN_DB = 3,\n {2}OMX_GATE_READOUT_BAND5_GAIN_DB = 4,\n {2}OMX_GATE_READOUT_BAND6_GAIN_DB = 5,\n\};\n#define OMX_GATE_READOUT_COUNT 6u$/m);
  assert.match(h, /^#define OMX_GATE_READOUT_BAND6_GAIN_DB_MIN -24\.0f\n#define OMX_GATE_READOUT_BAND6_GAIN_DB_MAX 12\.0f\n#define OMX_GATE_READOUT_BAND6_GAIN_DB_RATE_HZ 50\n#define OMX_GATE_READOUT_BAND6_GAIN_DB_SCALE OMX_PARAM_SCALES_LINEAR\n#define OMX_GATE_READOUT_BAND6_GAIN_DB_UNIT "dB"$/m);
  const m = renderC(resolvedOf(withReadouts([readout(), ...multiband()])))[0].text;
  assert.match(m, /^ {2}OMX_GATE_READOUT_BAND1_GAIN_REDUCTION_DB = 1,$/m);
  assert.match(m, /^ {2}OMX_GATE_READOUT_BAND5_GAIN_REDUCTION_DB = 5,$/m);
  assert.match(m, /^#define OMX_GATE_READOUT_BAND5_GAIN_REDUCTION_DB_MIN -60\.0f$/m);
});

test('per-band readouts: a gap, a band out of order, a band 0, a zero-padded band, a readout between bands or a band drawn unlike the others is refused', () => {
  const list = dyneq();
  assert.match(problems(withReadouts([list[0], list[2]])), /readout-band:.*the bands run 1, 3, not 1 to 2 in order/);
  assert.match(problems(withReadouts([list[1], list[0]])), /readout-band:.*the bands run 2, 1/);
  assert.match(problems(withReadouts([readout({ name: 'band0GainDb', min: -24, max: 12 }), ...list])), /readout-band:.*band0GainDb: a band is numbered from 1 with no leading zero/);
  assert.match(problems(withReadouts([...list.slice(0, 5), { ...list[5], max: 18 }])), /readout-band:.*band 6 is drawn \["dB",-24,18,"linear",50\], band 1 \["dB",-24,12,"linear",50\]/);
  assert.match(problems(withReadouts([...list.slice(0, 5), { ...list[5], unit: 'dBFS' }])), /readout-band:.*band 6 is drawn/);
  assert.equal(problems(withReadouts([...dyneq(), ...multiband()])), '', 'two stems are two runs');
  assert.match(problems(withReadouts([list[0], second, list[1]])), /readout-band:.*the bands sit at ids 0, 2, not side by side/);
  assert.match(problems(withReadouts([readout({ name: 'band01GainDb', min: -24, max: 12 })])), /readout-band:.*band01GainDb: a band is numbered from 1 with no leading zero/);
});
