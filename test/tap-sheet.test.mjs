// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
/**
 * An integer travel, a flat table keyed by its kernel's own fields, and a ratio set as two integer lists in member order,
 * over the invented echo kernel (test/fixtures/tool-kernels/): the integer ceiling renders as an integer literal a kernel
 * can size an array by, every tap field renders its own block, the lists render as an initialiser and a count, and
 * moving a value in the data moves every render and turns `render --check` red.
 */
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { main } from '../bin/omx-contract.mjs';
import { loadData, resolveData } from '../lib/data.mjs';
import { validateData } from '../lib/validate.mjs';
import { renderC } from '../render/c.mjs';
import { renderJson } from '../render/json.mjs';
import { renderTs } from '../render/ts.mjs';
import { RENDERS, UNION, editData, scratchData, scratchDir, texts } from './helpers.mjs';

const items = (dir = UNION) => JSON.parse(renderJson(resolveData(loadData(dir)), '0.0.0')[0].text).items;
const header = (dir = UNION) => renderC(resolveData(loadData(dir)))[0].text;

test('an integer travel renders its ceiling as an integer literal', () => {
  assert.deepEqual(items().ECHO_TAPS_RANGE.value, { min: 1, max: 3, step: 1, unit: '', default: 1, defaultFrom: 'desk' });
  assert.match(header(), /^#define OMX_ECHO_TAPS_RANGE_MAX 3$/m);
});

const cc = (process.env.CC ?? 'cc').split(' ');
test('the integer ceiling sizes a C array', { skip: spawnSync(cc[0], [...cc.slice(1), '--version']).status !== 0 && 'no cc' }, () => {
  const dir = scratchDir('omx-tap-sheet-');
  mkdirSync(join(dir, 'omxcontract'));
  writeFileSync(join(dir, 'omxcontract/omx_contract_limits.h'), header());
  writeFileSync(join(dir, 'main.c'), [
    '#include <omxcontract/omx_contract_limits.h>',
    'static float taps[OMX_ECHO_TAPS_RANGE_MAX];',
    'int main(void) { return (int)(sizeof taps / sizeof taps[0]) == 3 ? 0 : 1; }',
  ].join('\n'));
  execFileSync(cc[0], [...cc.slice(1), '-std=c11', '-Wall', '-Wextra', '-Werror', '-Wno-unused-function', `-I${dir}`, join(dir, 'main.c'), '-o', join(dir, 'main'), '-lm']);
  execFileSync(join(dir, 'main'));
});

test('each tap carries its own gain and pan limit, keyed by the kernel\'s field', () => {
  const t = items().ECHO_TAP_LIMITS.value;
  assert.deepEqual(Object.keys(t), ['tap0Gain', 'tap0Pan', 'tap1Gain', 'tap1Pan', 'tap2Gain', 'tap2Pan']);
  const defaults = Object.fromEntries(Object.entries(t).map(([k, v]) => [k, v.default]));
  assert.deepEqual(defaults, { tap0Gain: 1, tap0Pan: 0, tap1Gain: 0.6, tap1Pan: -0.4, tap2Gain: 0.3, tap2Pan: 0.4 });
  for (const [k, v] of Object.entries(t)) assert.deepEqual([v.min, v.max, v.step], k.endsWith('Gain') ? [0, 1, 0.01] : [-1, 1, 0.01], k);
  assert.match(header(), /^#define OMX_ECHO_TAP_TAP1_PAN_DEFAULT -0\.4f$/m);
});

test('perturbation: move the tap ceiling, every render follows and --check goes red', () => {
  const dir = scratchData();
  editData(dir, 'kernels/echo.json', (d, at) => { at('ECHO_TAPS_RANGE').travel.max = 6; });
  const r = resolveData(loadData(dir));
  assert.match(header(dir), /^#define OMX_ECHO_TAPS_RANGE_MAX 6$/m);
  assert.match(renderTs(r)[0].text, /^export const ECHO_TAPS_RANGE = \{[^}]*"max": 6/m);
  assert.equal(items(dir).ECHO_TAPS_RANGE.value.max, 6);
  assert.doesNotMatch(header(dir), /OMX_ECHO_TAPS_RANGE_MAX 3$/m);
  assert.equal(main(['render', '--target', 'c', '--out', `${RENDERS}/include`, '--check', '--data', dir]), 1);
  assert.equal(main(['render', '--target', 'json', '--out', `${RENDERS}/share/omx-contract`, '--check', '--data', dir]), 1);
});

test('perturbation: move a tap pan come-up value, the header and the json follow', () => {
  const dir = scratchData();
  editData(dir, 'kernels/echo.json', (d, at) => { at('ECHO_TAP_LIMITS.tap2Pan').default = 0.25; });
  assert.match(header(dir), /^#define OMX_ECHO_TAP_TAP2_PAN_DEFAULT 0\.25f$/m);
  assert.equal(items(dir).ECHO_TAP_LIMITS.value.tap2Pan.default, 0.25);
  assert.equal(main(['render', '--target', 'c', '--out', `${RENDERS}/include`, '--check', '--data', dir]), 1);
});

// A ratio such as '1/2' is a fraction, not a C identifier: rendered as an enumerator or a macro name it would emit
// `OMX_..._1/2`. The schema refuses such a set id, so a ratio set cannot reach the C render as ids; it is two lists.
test('a set id that is no C identifier, like the ratio \'1/2\', is refused before it can be rendered as a macro name', () => {
  const problems = validateData(loadData(null, texts((d, at) => { const s = at('data/kernels/swell.json', 'SWELL_KINDS'); s.ids = ['1/2', '3/4']; delete s.values; delete s.default; })));
  assert.ok(problems.some((p) => p.item === 'SWELL_KINDS' && p.rule === 'schema' && /ids\/0 must match pattern/.test(p.message)));
});

test('a ratio set is two integer lists in member order: each renders its initialiser and its count', () => {
  const h = header();
  assert.match(h, /^#define OMX_ECHO_TAP_NUMS_COUNT 3u$/m);
  assert.match(h, /^#define OMX_ECHO_TAP_NUMS_INIT \{ 1, 2, 3 \}$/m);
  assert.match(h, /^#define OMX_ECHO_TAP_DENS_INIT \{ 3, 3, 2 \}$/m);
  const it = items();
  assert.deepEqual(it.ECHO_TAP_NUMS.value.map((n, i) => `${n}/${it.ECHO_TAP_DENS.value[i]}`), ['1/3', '2/3', '3/2']);
});

test('perturbation: move a numerator, then a denominator: the initialiser follows and render --check goes red', () => {
  for (const [name, edit, want] of [['ECHO_TAP_NUMS', (at) => { at('ECHO_TAP_NUMS').values[1] = 4; }, '1, 4, 3'],
    ['ECHO_TAP_DENS', (at) => { at('ECHO_TAP_DENS').values[2] = 16; }, '3, 3, 16']]) {
    const dir = scratchData();
    editData(dir, 'kernels/echo.json', (d, at) => edit(at));
    assert.match(header(dir), new RegExp(`^#define OMX_${name}_INIT \\{ ${want} \\}$`, 'm'));
    assert.equal(main(['render', '--target', 'c', '--out', `${RENDERS}/include`, '--check', '--data', dir]), 1);
  }
});
