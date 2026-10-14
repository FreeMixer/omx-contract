// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
// 2.9.0 (#29): a set's ids may carry a value each, in a unit, null for an id that carries none. Every render carries
// them: json as `values` and `unit`, ts as `<SET>_VALUES`, C as `OMX_<SET>_UNIT`, `OMX_<SET>_<ID>_VALUE` and
// `omx_<set>_value(id, &out)`, so a kernel reads the number from the id it is handed.
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { loadData, resolveData } from '../lib/data.mjs';
import { validateData } from '../lib/validate.mjs';
import { renderC } from '../render/c.mjs';
import { renderJson } from '../render/json.mjs';
import { renderTs } from '../render/ts.mjs';
import { texts } from './helpers.mjs';

// the comp's kinds (comp, limiter) planted with values: the limiter carries 4, the comp none
const planted = () => resolveData(loadData(null, texts((d, at) => { const s = at('data/kernels/comp.json', 'COMP_KINDS'); s.values = [null, 4]; s.unit = 'x'; })));

test('json: the set carries its values and unit', () => {
  const it = JSON.parse(renderJson(planted(), '0.0.0')[0].text).items.COMP_KINDS;
  assert.deepEqual([it.value, it.values, it.unit], [['comp', 'limiter'], [null, 4], 'x']);
});

test('ts: <SET>_VALUES maps each id to its value, null for none', () => {
  const [js, dts] = renderTs(planted()).map((f) => f.text);
  assert.match(js, /^export const COMP_KINDS_VALUES = \{\n {2}"comp": null,\n {2}"limiter": 4\n\};$/m);
  assert.match(dts, /^export declare const COMP_KINDS_VALUES: \{\n {2}readonly comp: null;\n {2}readonly limiter: 4;\n\};$/m);
  assert.match(js, /^export const COMP_KINDS = \[\n {2}"comp",\n {2}"limiter"\n\];$/m, 'the set itself is still its ids');
});

test('c: the value of each id that carries one, and no define for an id that carries none', () => {
  const h = renderC(planted())[0].text;
  assert.match(h, /^#define OMX_COMP_KINDS_UNIT "x"\n#define OMX_COMP_KINDS_LIMITER_VALUE 4\.0f\nstatic inline int omx_comp_kinds_value\(int id, float \*out\) \{$/m);
  assert.doesNotMatch(h, /OMX_COMP_KINDS_COMP_VALUE/);
});

const cc = (process.env.CC ?? 'cc').split(' ');
test('c: the lookup returns an id\'s value, or 0 for an id that carries none', { skip: spawnSync(cc[0], [...cc.slice(1), '--version']).status !== 0 && 'no cc' }, () => {
  const h = renderC(planted())[0].text;
  const dir = mkdtempSync(join(tmpdir(), 'omx-set-values-'));
  mkdirSync(join(dir, 'omxcontract'));
  writeFileSync(join(dir, 'omxcontract/omx_contract_limits.h'), h);
  writeFileSync(join(dir, 'main.c'), [
    '#include <omxcontract/omx_contract_limits.h>',
    'int main(void) {',
    '  float v = -1.0f;',
    '  if (omx_comp_kinds_value(OMX_COMP_KINDS_COMP, &v) != 0 || v != -1.0f) return 1;',
    '  if (omx_comp_kinds_value(OMX_COMP_KINDS_LIMITER, &v) != 1 || v != 4.0f) return 2;',
    '  if (omx_comp_kinds_value(OMX_COMP_KINDS_COUNT, &v) != 0) return 3;',
    '  return 0;',
    '}',
  ].join('\n'));
  execFileSync(cc[0], [...cc.slice(1), '-std=c11', '-Wall', '-Wextra', '-Werror', '-Wno-unused-function', `-I${dir}`, join(dir, 'main.c'), '-o', join(dir, 'main'), '-lm']);
  execFileSync(join(dir, 'main'));
});

test('validate: no item may take the name of a set\'s values export', () => {
  const problems = validateData(loadData(null, texts((d, at) => {
    const s = at('data/kernels/comp.json', 'COMP_KINDS');
    s.values = [null, 4];
    s.unit = 'x';
    d['data/rates.json'].COMP_KINDS_VALUES = { kind: 'scalar', doc: 'a clash', unit: '', value: 1 };
  })));
  assert.ok(problems.some((p) => p.rule === 'set-values' && /COMP_KINDS_VALUES is the ts render's export/.test(p.message)));
});
