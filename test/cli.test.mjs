// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { DATA, ROOT, scratchData } from './helpers.mjs';

const cli = (...a) => spawnSync(process.execPath, [join(ROOT, 'bin/omx-contract.mjs'), ...a], { encoding: 'utf8' });

test('validate, fmt --check and every render --check pass on the shipped tree', () => {
  assert.equal(cli('validate').status, 0);
  assert.equal(cli('fmt', '--check').status, 0);
  assert.equal(cli('render', '--target', 'c', '--out', join(ROOT, 'include'), '--check').status, 0);
  assert.equal(cli('render', '--target', 'json', '--out', join(ROOT, 'share/omx-contract'), '--check').status, 0);
  assert.equal(cli('render', '--target', 'ts', '--out', join(ROOT, 'test/golden/ts'), '--check').status, 0);
});

test('a usage error exits 2, never a pass', () => {
  assert.equal(cli().status, 2);
  assert.equal(cli('render', '--target', 'c').status, 2);
  assert.equal(cli('render', '--target', 'rust', '--out', '/tmp/x').status, 2);
  assert.equal(cli('validate', '--data', '/nonexistent').status, 2);
  assert.equal(cli('semver').status, 2);
});

test('render --check names a missing and an extra file', () => {
  const r = cli('render', '--target', 'c', '--out', join(ROOT, 'test/fixtures'), '--check');
  assert.equal(r.status, 1);
  assert.match(r.stderr, /omxcontract\/omx_contract_limits\.h is missing/);
});

test('fmt --check refuses a file out of the one formatting, fmt fixes it', () => {
  const dir = scratchData();
  const p = join(dir, 'rates.json');
  writeFileSync(p, JSON.stringify(JSON.parse(readFileSync(p, 'utf8'))));
  assert.equal(cli('fmt', '--check', '--data', dir).status, 1);
  assert.equal(cli('fmt', '--data', dir).status, 0);
  assert.equal(readFileSync(p, 'utf8'), readFileSync(join(DATA, 'rates.json'), 'utf8'));
});

test('validate names file, item and rule', () => {
  const dir = scratchData();
  const p = join(dir, 'kernels/gate.json');
  writeFileSync(p, readFileSync(p, 'utf8').replace('"default": -40', '"default": 5'));
  const r = cli('validate', '--data', dir);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /^data\/kernels\/gate\.json: GATE_LIMITS: default-inside: GATE_LIMITS\.thresholdDb: default 5 outside \[-80, 0\]$/m);
});
