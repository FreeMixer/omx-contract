// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
/**
 * The FX delay's read taps: the tap-count travel (FX_DELAY_TAPS_RANGE, rendered as OMX_DELAY_TAPS_MAX for the
 * kernel's tap arrays) and the flat DELAY_TAP_LIMITS sheet keyed by the delay row's own field. Moving a value in
 * the data moves every render and turns `render --check` red.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { main } from '../bin/omx-contract.mjs';
import { loadData, resolveData } from '../lib/data.mjs';
import { validateData } from '../lib/validate.mjs';
import { renderC } from '../render/c.mjs';
import { renderJson } from '../render/json.mjs';
import { renderTs } from '../render/ts.mjs';
import { DATA, ROOT, editData, scratchData, texts } from './helpers.mjs';

const items = (dir = DATA) => JSON.parse(renderJson(resolveData(loadData(dir)), '0.0.0')[0].text).items;
const header = (dir = DATA) => renderC(resolveData(loadData(dir)))[0].text;

test('the tap count travels 1..4 step 1 and comes up at 1, and the kernel reads its ceiling as OMX_DELAY_TAPS_MAX', () => {
  assert.deepEqual(items().FX_DELAY_TAPS_RANGE.value, { min: 1, max: 4, step: 1, unit: '', default: 1, defaultFrom: 'desk' });
  assert.match(header(), /^#define OMX_DELAY_TAPS_MAX 4\.0f$/m);
  assert.match(header(), /^#define OMX_FX_DELAY_TAPS_RANGE_MAX 4$/m);
});

test('each tap carries its own gain and pan limit, keyed by the delay row field', () => {
  const t = items().DELAY_TAP_LIMITS.value;
  assert.deepEqual(Object.keys(t), ['tap0Gain', 'tap0Pan', 'tap1Gain', 'tap1Pan', 'tap2Gain', 'tap2Pan', 'tap3Gain', 'tap3Pan']);
  const defaults = Object.fromEntries(Object.entries(t).map(([k, v]) => [k, v.default]));
  assert.deepEqual(defaults, { tap0Gain: 1, tap0Pan: 0, tap1Gain: 0.7, tap1Pan: -0.5, tap2Gain: 0.5, tap2Pan: 0.5, tap3Gain: 0.35, tap3Pan: 0 });
  for (const [k, v] of Object.entries(t)) {
    const gain = k.endsWith('Gain');
    assert.deepEqual([v.min, v.max, v.step], gain ? [0, 1, 0.01] : [-1, 1, 0.01], k);
  }
  assert.match(header(), /^#define OMX_DELAY_TAP_TAP1_PAN_DEFAULT -0\.5f$/m);
});

test('perturbation: move the tap ceiling, every render follows and --check goes red', () => {
  const dir = scratchData();
  editData(dir, 'kernels/delay.json', (d, at) => { at('FX_DELAY_TAPS_RANGE').travel.max = 6; });
  const r = resolveData(loadData(dir));
  assert.match(header(dir), /^#define OMX_DELAY_TAPS_MAX 6\.0f$/m);
  assert.match(renderTs(r)[0].text, /^export const FX_DELAY_TAPS_RANGE = \{[^}]*"max": 6/m);
  assert.equal(items(dir).FX_DELAY_TAPS_RANGE.value.max, 6);
  assert.doesNotMatch(header(dir), /OMX_DELAY_TAPS_MAX 4/);
  assert.equal(main(['render', '--target', 'c', '--out', `${ROOT}/include`, '--check', '--data', dir]), 1);
  assert.equal(main(['render', '--target', 'json', '--out', `${ROOT}/share/omx-contract`, '--check', '--data', dir]), 1);
});

test('perturbation: move a tap pan come-up value, the header and the json follow', () => {
  const dir = scratchData();
  editData(dir, 'kernels/delay.json', (d, at) => { at('DELAY_TAP_LIMITS.tap2Pan').default = 0.25; });
  assert.match(header(dir), /^#define OMX_DELAY_TAP_TAP2_PAN_DEFAULT 0\.25f$/m);
  assert.equal(items(dir).DELAY_TAP_LIMITS.value.tap2Pan.default, 0.25);
  assert.equal(main(['render', '--target', 'c', '--out', `${ROOT}/include`, '--check', '--data', dir]), 1);
});

// A tap factor such as '1/2' is a fraction, not a C identifier: rendered as an enumerator or a macro name it
// would emit `OMX_..._1/2`. The schema refuses such a set id, so a factor set cannot reach the C render.
test('a set id that is no C identifier, like the tap factor \'1/2\', is refused before it can be rendered as a macro name', () => {
  const problems = validateData(loadData(null, texts((d, at) => { const s = at('data/kernels/comp.json', 'COMP_KINDS'); s.ids = ['1/2', '3/4']; delete s.values; delete s.default; })));
  assert.ok(problems.some((p) => p.item === 'COMP_KINDS' && p.rule === 'schema' && /ids\/0 must match pattern/.test(p.message)));
});
