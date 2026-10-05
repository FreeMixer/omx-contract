// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { loadData, packageVersion, resolveData } from '../lib/data.mjs';
import { renderC } from '../render/c.mjs';
import { renderJson } from '../render/json.mjs';
import { renderTs } from '../render/ts.mjs';
import { DATA, ROOT } from './helpers.mjs';

const resolved = () => resolveData(loadData(DATA));
const golden = (dir, files) => { for (const f of files) assert.equal(f.text, readFileSync(join(ROOT, dir, f.path), 'utf8'), `${dir}/${f.path} is the golden`); };

test('golden: the c render is include/omxcontract/', () => golden('include', renderC(resolved())));
test('golden: the json render is share/omx-contract/', () => golden('share/omx-contract', renderJson(resolved(), packageVersion(ROOT))));
test('golden: the ts render is test/golden/ts/', () => golden('test/golden/ts', renderTs(resolved())));

test('a render is idempotent: no time, path or host in its bytes', () => {
  for (const r of [renderC, renderTs]) assert.deepEqual(r(resolved()), r(resolved()));
});

test('the ts module exports every item with the resolved value', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'omx-ts-'));
  for (const f of renderTs(resolved())) writeFileSync(join(dir, f.path), f.text);
  const mod = await import(pathToFileURL(join(dir, 'omx-contract.js')).href);
  const json = JSON.parse(renderJson(resolved(), '0.0.0')[0].text).items;
  for (const [name, item] of Object.entries(json)) {
    const want = item.kind === 'plugin' ? item.value : item.value;
    assert.deepEqual(item.kind === 'plugin' ? mod[name].params : mod[name], want, name);
  }
  const dts = readFileSync(join(dir, 'omx-contract.d.ts'), 'utf8');
  assert.match(dts, /export declare const GATE_LIMITS: \{\n {2}readonly thresholdDb: \{\n {4}readonly min: -80;/);
});

test('the c headers compile, and a C reader sees the declared values', { skip: spawnSync('cc', ['--version']).status !== 0 && 'no cc' }, () => {
  const dir = mkdtempSync(join(tmpdir(), 'omx-c-'));
  const src = join(dir, 't.c');
  writeFileSync(src, `#include <stdio.h>
#include <omxcontract/omx_contract_limits.h>
#include <omxcontract/params/omx_delay_params.h>
int main(void) {
  printf("%g %g %d %u %g %s %d\\n", (double)OMX_GATE_THRESHOLD_DB_MIN, OMX_BUTTERWORTH_Q_DOUBLE, OMX_GEQ_BANDS,
         OMX_DECLARED_RATE_COUNT, (double)OMX_DELAY_PARAMS[OMX_DELAY_PARAM_FEEDBACK].max, OMX_DELAY_PARAMS[4].symbol,
         (int)OMX_DELAY_TIME_MS_MAX);
  return 0;
}
`);
  execFileSync('cc', ['-std=c11', '-Wall', '-Wextra', '-Werror', '-Wno-unused-function', '-I', join(ROOT, 'include'), src, '-o', join(dir, 't')]);
  assert.equal(execFileSync(join(dir, 't'), { encoding: 'utf8' }), '-80 0.707107 31 6 0.99 pingpong 2000\n');
});
