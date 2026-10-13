// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
// 2.7.0 (#32): the drive's oversampling factor is a control, oversample (DRIVE_OVERSAMPLES: 1, 2, 4, the id is the
// factor), coming up at 4 as the console's drive row (DRIVE_OVERSAMPLE_FACTORS) and omx-dsp's drive
// face (OMX_DRIVE_INSTANCE_FACTOR, the oversampler's largest) do. The C render keeps every line of the released 2.7.0 header and adds only the set.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { main } from '../bin/omx-contract.mjs';
import { loadData, resolveData } from '../lib/data.mjs';
import { renderC } from '../render/c.mjs';
import { renderJson } from '../render/json.mjs';
import { DATA, ROOT, editData, scratchData } from './helpers.mjs';

const resolved = (dir = DATA) => resolveData(loadData(dir));
const header = (dir) => renderC(resolved(dir))[0].text;
const json = (dir) => JSON.parse(renderJson(resolved(dir), '0.0.0')[0].text);

test('drive: oversample is the last control, a choice of DRIVE_OVERSAMPLES (1, 2, 4) that comes up at 4', () => {
  assert.deepEqual(json().kernels.drive.controls.slice(-1), [{ name: 'oversample', kind: 'choice', global: 'DRIVE_OVERSAMPLES' }]);
  assert.deepEqual(json().items.DRIVE_OVERSAMPLES.value, [1, 2, 4]);
  assert.equal(json().items.DRIVE_OVERSAMPLES.default, 4);
});

test('the C render keeps every 2.7.0 line, byte for byte and in order, and adds only the oversample set', () => {
  const old = readFileSync(join(ROOT, 'test/fixtures/omx-contract-2.7.0/omx_contract_limits.h'), 'utf8').split('\n');
  const now = header().split('\n');
  let i = 0;
  const added = [];
  for (const line of now) {
    if (i < old.length && line === old[i]) i++;
    else added.push(line);
  }
  assert.equal(i, old.length, `2.7.0 line ${i + 1} is not in the render: ${old[i]}`);
  assert.deepEqual(added, [
    'enum omx_drive_oversamples {',
    '  OMX_DRIVE_OVERSAMPLES_1 = 1,',
    '  OMX_DRIVE_OVERSAMPLES_2 = 2,',
    '  OMX_DRIVE_OVERSAMPLES_4 = 4,',
    '};',
    '#define OMX_DRIVE_OVERSAMPLES_COUNT 3u',
    '#define OMX_DRIVE_OVERSAMPLES_DEFAULT OMX_DRIVE_OVERSAMPLES_4',
  ]);
});

test('perturbation: a moved come-up factor moves the C default, and --check goes red', () => {
  const dir = scratchData();
  editData(dir, 'kernels/drive.json', (d, at) => { at('DRIVE_OVERSAMPLES').default = 2; });
  assert.match(header(dir), /^#define OMX_DRIVE_OVERSAMPLES_DEFAULT OMX_DRIVE_OVERSAMPLES_2$/m);
  assert.equal(main(['render', '--target', 'c', '--out', `${ROOT}/include`, '--check', '--data', dir]), 1);
});
