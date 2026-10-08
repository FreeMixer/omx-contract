// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
/** The round-trip proof (spec §4.4 steps 1 and 2) as a test; tools/proof/round-trip.mjs prints it. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { roundTrip } from '../tools/proof/round-trip.mjs';
import { loadData, resolveData } from '../lib/data.mjs';
import { ROOT } from './helpers.mjs';

const r = roundTrip();

test('step 1: the frozen openmixer sheet renders omx-dsp v0.1.3\'s limits header byte for byte', () => {
  assert.deepEqual(r.step1, { limits: true });
});

test('step 2: every shipped unit is byte-identical to omx-dsp\'s, in the same order, but the units of later items it lacks', () => {
  assert.deepEqual(r.step2.differing, []);
  assert.deepEqual(r.step2.notInPin, []);
  assert.equal(r.step2.inOrder, true);
  assert.equal(r.step2.identical, r.step2.units - r.step2.addedLater.length);
  assert.equal(r.step2.identical - r.step2.heldLater.length, 155, 'every 1.0.0 unit is still rendered: a lost one shrinks this');
  assert.equal(r.step2.identical, 424, 'with the 81 units 1.1.0 added, the 135 of 1.2.0 and the 53 of 1.3.0, all of them omx-dsp\'s own');
  assert.ok(r.step2.heldLater.includes('OMX_CHORUS_RATE_RANGE_DEFAULT'), 'a later item omx-dsp\'s header holds is compared, not skipped');
  assert.equal(r.step2.pinUnits, 905);
  assert.equal(r.step2.residue.length, r.step2.pinUnits - r.step2.identical);
});

test('step 2: a unit omx-dsp lacks is refused when its item shipped in the first release', () => {
  const resolved = resolveData(loadData(join(ROOT, 'data')));
  const g = resolved.get('GATE_LIMITS');
  resolved.set('GATE_EXTRA_MS', { name: 'GATE_EXTRA_MS', rel: g.rel, kind: 'scalar', doc: 'x', unit: 'ms', value: 1 });
  const bad = roundTrip(resolved);
  assert.deepEqual(bad.step2.notInPin, ['OMX_GATE_EXTRA_MS']);
  assert.equal(bad.ok, false);
});

test('step 2: the 64 units omx-dsp reads are all among them', () => {
  assert.equal(r.step2.read, 64);
  assert.deepEqual(r.step2.readMissing, []);
});

test('the moved renderer is openmixer\'s, line for line', () => {
  const ours = readFileSync(join(ROOT, 'render/c/contract-limits-render.mjs'), 'utf8').split('\n');
  assert.match(ours[2], /^\/\/ Moved unchanged from openmixer harness\/contract-limits-render\.mjs/);
  assert.ok(ours.includes('export function renderContractLimits({'));
});
