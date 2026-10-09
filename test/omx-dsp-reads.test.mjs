// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
// omx-dsp can build against the c render: every limit its sources, tests and tools read from its
// committed header (frozen under test/fixtures/omx-dsp-v0.1.5-8-g4108494/, omx-dsp main at 4108494)
// is defined by the render, byte for byte, so with the same value and the same literal. (Until 1.2.x the
// three EQ band budget names stayed in openmixer; 1.3.0 carries them.)
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { loadData, resolveData } from '../lib/data.mjs';
import { renderC } from '../render/c.mjs';
import { limitUnits } from '../tools/proof/limit-units.mjs';
import { ROOT, editData, scratchData } from './helpers.mjs';

const FIX = join(ROOT, 'test/fixtures/omx-dsp-v0.1.5-8-g4108494');
const units = (t) => new Map(limitUnits(t).filter((u) => u.frame === undefined).map((u) => [u.key, u.lines.join('\n')]));
const pin = units(readFileSync(join(FIX, 'omx_contract_limits.h'), 'utf8'));
const reads = JSON.parse(readFileSync(join(FIX, 'read-units.json'), 'utf8')).read.map((r) => r.key);

/** The units omx-dsp reads that the render of `dataDir` lacks, and those it spells differently. */
function check(dataDir = join(ROOT, 'data')) {
  const files = renderC(resolveData(loadData(dataDir)));
  const ours = units(files.find((f) => f.path === 'omxcontract/omx_contract_limits.h').text);
  return {
    missing: reads.filter((k) => !ours.has(k)),
    differing: reads.filter((k) => ours.has(k) && ours.get(k) !== pin.get(k)),
  };
}

test('every limit omx-dsp reads is in the c render with the same value', () => {
  assert.ok(reads.length >= 190, `omx-dsp reads ${reads.length} units: a short list proves nothing`);
  const r = check();
  assert.deepEqual(r.differing, []);
  assert.deepEqual(r.missing, []);
});

test('the names omx-dsp#9 found missing from 1.1.0 are among them', () => {
  for (const k of ['OMX_CHORUS_RATE_RANGE_MIN', 'OMX_DRIVE_DRIVE_DB_MAX', 'OMX_EQ_NOTCH_Q_RANGE_MAX', 'OMX_HPF_FREQ_RANGE_MIN',
    'OMX_LPF_FREQ_RANGE_MAX', 'OMX_PAN_PAN_MIN', 'OMX_REVERB_GATE_THRESHOLD_RANGE_DEFAULT', 'OMX_REVERB_WIDTH_RANGE_DEFAULT']) {
    assert.ok(reads.includes(k), `${k} is read by omx-dsp`);
  }
});

test('a moved value and a removed travel are caught, naming the unit', () => {
  const moved = scratchData();
  editData(moved, 'kernels/chorus.json', (d, at) => { at('CHORUS_RATE_RANGE').travel.default = 0.7; });
  assert.deepEqual(check(moved).differing, ['OMX_CHORUS_RATE_RANGE_DEFAULT']);
  const removed = scratchData();
  editData(removed, 'kernels/balance.json', (d, at) => { delete at('PAN_RANGE').c; });
  assert.deepEqual(check(removed).missing, ['OMX_PAN_PAN_MIN', 'OMX_PAN_PAN_MAX']);
});
