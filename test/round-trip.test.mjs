// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
/** The round-trip proof as a test; tools/proof/round-trip.mjs prints it. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { roundTrip } from '../tools/proof/round-trip.mjs';
import { loadData, resolveData } from '../lib/data.mjs';
import { ROOT, UNION } from './helpers.mjs';

const r = roundTrip();

test('step 1: the frozen sheet renders omx-dsp v0.1.3\'s limits header byte for byte', () => {
  assert.deepEqual(r.step1, { limits: true });
});

test('step 2: every shipped unit is byte-identical to omx-dsp\'s, in the same order, but the units of later items it lacks', () => {
  assert.deepEqual(r.step2.differing, []);
  assert.deepEqual(r.step2.notInPin, []);
  assert.equal(r.step2.inOrder, true);
  assert.equal(r.step2.identical, r.step2.units - r.step2.addedLater.length - r.step2.moved.length);
  assert.equal(r.step2.identical - (r.step2.heldLater.length - r.step2.moved.length), 152, 'every 1.0.0 unit is still rendered: a lost one shrinks this');
  // with the 81 units 1.1.0 added, the 135 of 1.2.0, the 53 of 1.3.0, the 2 DETECTOR_OVERSAMPLE_AUTO_MS units of 2.0.0,
  // the 10 hosted-stage units of 2.12.0, the 34 kernel-travel units and the 31 HRP_FAMILY_SEARCH units of 2.14.0
  // omx-dsp already holds, all of them omx-dsp's own, less the 20 units of the c.alias spellings 3.0.0 removed
  // outright (the pin still carries them; the current render never does)
  assert.equal(r.step2.identical, 481);
  assert.deepEqual(r.step2.moved, ['OMX_INPUT_ALIGN_DELAY_RANGE_STEP', 'OMX_INPUT_ALIGN_DELAY_RANGE_STEP_DOUBLE'], 'the one travel the console engine moved after the pin');
  assert.deepEqual(r.step2.movedStale, []);
  assert.ok(r.step2.heldLater.includes('OMX_CHORUS_RATE_RANGE_DEFAULT'), 'a later item omx-dsp\'s header holds is compared, not skipped');
  assert.equal(r.step2.pinUnits, 905);
  assert.equal(r.step2.residue.length, r.step2.pinUnits - r.step2.identical - r.step2.moved.length);
});

test('step 2: a unit omx-dsp lacks is refused when its item shipped in the first release', () => {
  const resolved = resolveData(loadData(UNION));
  const g = resolved.get('GATE_LIMITS');
  resolved.set('GATE_EXTRA_MS', { name: 'GATE_EXTRA_MS', rel: g.rel, kind: 'scalar', doc: 'x', unit: 'ms', value: 1 });
  const bad = roundTrip(resolved);
  assert.deepEqual(bad.step2.notInPin, ['OMX_GATE_EXTRA_MS']);
  assert.equal(bad.ok, false);
});

test('step 2: the 63 units omx-dsp reads are all among them', () => {
  // the v0.1.3 pin held one c.alias spelling among its reads, OMX_DELAY_TIME_MS_MAX; 3.0.0 removes the word outright,
  // and an omx-dsp old enough to read that spelling is before 0.25.0, which omx-contract-devel 3.0.0 conflicts with,
  // so the frozen fixture (test/fixtures/omx-dsp-v0.1.3/read-units.json) leaves it out: 64 minus that one.
  assert.equal(r.step2.read, 64 - 1);
  assert.deepEqual(r.step2.readMissing, []);
});

test('the moved renderer is openmixer\'s, line for line', () => {
  const ours = readFileSync(join(ROOT, 'render/c/contract-limits-render.mjs'), 'utf8').split('\n');
  assert.match(ours[2], /^\/\/ Moved unchanged from the console engine's contract-limits renderer/);
  assert.ok(ours.includes('export function renderContractLimits({'));
});

test('step 2: a unit named as moved after the pin fails the proof once it is equal again', () => {
  const resolved = resolveData(loadData(UNION));
  const it = resolved.get('INPUT_ALIGN_DELAY_RANGE');
  resolved.set('INPUT_ALIGN_DELAY_RANGE', { ...it, value: { ...it.value, step: 0.01 } });
  const bad = roundTrip(resolved);
  assert.deepEqual(bad.step2.movedStale, ['OMX_INPUT_ALIGN_DELAY_RANGE_STEP', 'OMX_INPUT_ALIGN_DELAY_RANGE_STEP_DOUBLE']);
  assert.equal(bad.ok, false);
});

test('step 2: a unit the moved list does not name still fails when it differs from the pin', () => {
  const resolved = resolveData(loadData(UNION));
  const it = resolved.get('OUTPUT_DELAY_RANGE');
  resolved.set('OUTPUT_DELAY_RANGE', { ...it, value: { ...it.value, max: 2000 } });
  const bad = roundTrip(resolved);
  assert.deepEqual(bad.step2.differing, ['OMX_OUTPUT_DELAY_RANGE_MAX']);
  assert.equal(bad.ok, false);
});
