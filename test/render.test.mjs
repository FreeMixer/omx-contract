// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { loadData, packageVersion, resolveData } from '../lib/data.mjs';
import { renderC } from '../render/c.mjs';
import { renderJson } from '../render/json.mjs';
import { renderTs } from '../render/ts.mjs';
import { DATA, RENDERS, ROOT, UNION, editData, scratchData, scratchDir } from './helpers.mjs';

const resolved = () => resolveData(loadData(UNION));
const own = () => resolveData(loadData(DATA));
const golden = (dir, files) => { for (const f of files) assert.equal(f.text, readFileSync(join(ROOT, dir, f.path), 'utf8'), `${dir}/${f.path} is the golden`); };

test('golden: the c render of data/ is include/omxcontract/', () => golden('include', renderC(own())));
test('golden: the json render of data/ is share/omx-contract/', () => golden('share/omx-contract', renderJson(own(), packageVersion(ROOT))));
test('golden: the ts render of data/ is test/golden/ts/', () => golden('test/golden/ts', renderTs(own())));

test('c: a <PREFIX>_LIMITS field with no default renders its MIN and MAX and no DEFAULT', () => {
  const dir = scratchData();
  editData(dir, 'kernels/swell.json', (d, at) => { delete at('SWELL_LIMITS.releaseMs').default; delete at('SWELL_LIMITS.releaseMs').defaultFrom; });
  const h = renderC(resolveData(loadData(dir)))[0].text;
  assert.match(h, /^#define OMX_SWELL_RELEASE_MS_MIN 5\.0f\n#define OMX_SWELL_RELEASE_MS_MAX 2000\.0f\n\n/m);
  assert.doesNotMatch(h, /OMX_SWELL_RELEASE_MS_DEFAULT|undefined/);
});

test('a render is idempotent: no time, path or host in its bytes', () => {
  for (const r of [renderC, renderTs]) assert.deepEqual(r(resolved()), r(resolved()));
});

test('the ts module exports every item with the resolved value', async () => {
  const dir = scratchDir('omx-ts-');
  for (const f of renderTs(resolved())) writeFileSync(join(dir, f.path), f.text);
  const mod = await import(pathToFileURL(join(dir, 'omx-contract.js')).href);
  const json = JSON.parse(renderJson(resolved(), '0.0.0')[0].text).items;
  for (const [name, item] of Object.entries(json)) {
    assert.deepEqual(mod[name], item.value, name);
  }
  const dts = readFileSync(join(dir, 'omx-contract.d.ts'), 'utf8');
  assert.match(dts, /export declare const SWELL_LIMITS: \{\n {2}readonly thresholdDb: \{\n {4}readonly min: -70;/);
});

const cc = (process.env.CC ?? 'cc').split(' ');

test('the c headers of the union compile, and a C reader sees the declared values', { skip: spawnSync(cc[0], [...cc.slice(1), '--version']).status !== 0 && 'no cc' }, () => {
  const dir = scratchDir('omx-c-');
  const src = join(dir, 't.c');
  writeFileSync(src, `#include <stdio.h>
#include <omxcontract/omx_contract_limits.h>
int main(void) {
  printf("%g %g %d %u %g %d %d\\n", (double)OMX_SWELL_THRESHOLD_DB_MIN, OMX_TOOL_Q_DOUBLE, OMX_CONTOUR_CENTRE_COUNT,
         OMX_DECLARED_RATE_COUNT, (double)OMX_CONTOUR_SHELF_GAIN_DB, (int)OMX_CONTOUR_MAX_BANDS,
         (int)OMX_ECHO_TIME_RANGE_MAX);
  return 0;
}
`);
  execFileSync(cc[0], [...cc.slice(1), '-std=c11', '-Wall', '-Wextra', '-Werror', '-Wno-unused-function', '-I', join(RENDERS, 'include'), src, '-o', join(dir, 't'), '-lm']);
  assert.equal(execFileSync(join(dir, 't'), { encoding: 'utf8' }), '-70 0.6 3 6 3 12 1500\n');
});

// The C header's rate tail says where the list it renders is declared: the data file that declares
// STANDARD_SAMPLE_RATES (read off the data, by the name it is installed under in the contract directory too), not the
// console engine module it came from (FreeMixer/omx-contract#108).
test('c: the rate tail of omx_contract_limits.h names the data file that declares the rates', () => {
  const file = own().get('STANDARD_SAMPLE_RATES').rel.split('/').pop();
  const h = readFileSync(join(ROOT, 'include/omxcontract/omx_contract_limits.h'), 'utf8');
  const tail = h.slice(h.lastIndexOf('#endif /* OMX_CONTRACT_LIMITS_H */') + 1);
  const prose = tail.slice(0, tail.indexOf('#ifndef OMX_DECLARED_RATE_COUNT'));
  assert.ok(prose.includes('STANDARD_SAMPLE_RATES'), 'positive control: the tail introduces the rates');
  assert.ok(prose.includes(`omx-contract's ${file}`), `the rate tail names omx-contract's ${file}`);
  assert.doesNotMatch(prose, /row-codecs\.ts|core's/, 'the rate tail names a console module as the list\'s home');
});
