// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
/** The round-trip proof (spec §4.4 steps 1 and 2) as a test; tools/proof/round-trip.mjs prints it. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { RULING_H, roundTrip } from '../tools/proof/round-trip.mjs';
import { ROOT } from './helpers.mjs';

const r = roundTrip();

test('step 1: the frozen openmixer sheet renders omx-dsp v0.1.3\'s headers byte for byte', () => {
  assert.deepEqual(r.step1, { limits: true, delay: true });
});

test('step 2: every shipped unit is byte-identical to omx-dsp\'s, in the same order', () => {
  assert.deepEqual(r.step2.differing, []);
  assert.deepEqual(r.step2.notInPin, []);
  assert.equal(r.step2.inOrder, true);
  assert.equal(r.step2.identical, r.step2.units);
  assert.equal(r.step2.pinUnits, 905);
  assert.equal(r.step2.residue.length, r.step2.pinUnits - r.step2.units);
});

test('step 2: the 64 units omx-dsp reads are among them, but the three ruling (h) keeps in openmixer', () => {
  assert.equal(r.step2.read, 64);
  assert.deepEqual([...r.step2.readMissing].sort(), [...RULING_H].sort());
  assert.equal(r.step2.delayIdentical, true);
});

test('the moved renderer is openmixer\'s, line for line', () => {
  const ours = readFileSync(join(ROOT, 'render/c/contract-limits-render.mjs'), 'utf8').split('\n');
  assert.match(ours[2], /^\/\/ Moved unchanged from openmixer harness\/contract-limits-render\.mjs/);
  assert.ok(ours.includes('export function renderContractLimits({'));
});
