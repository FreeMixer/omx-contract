// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
/** The renderer's round-trip proof as a test; tools/proof/round-trip.mjs prints it. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { roundTrip } from '../tools/proof/round-trip.mjs';
import { ROOT } from './helpers.mjs';

test('step 1: the frozen sheet renders omx-dsp v0.1.3\'s limits header byte for byte', () => {
  assert.deepEqual(roundTrip().step1, { limits: true });
});

test('step 1: a header one byte off is red', () => {
  const pin = readFileSync(join(ROOT, 'test/fixtures/limits-0.1.3/omx_contract_limits.h'), 'utf8');
  assert.equal(roundTrip(pin.replace('#define ', '#define  ')).ok, false);
});

test('the moved renderer is openmixer\'s, line for line', () => {
  const ours = readFileSync(join(ROOT, 'render/c/contract-limits-render.mjs'), 'utf8').split('\n');
  assert.match(ours[2], /^\/\/ Moved unchanged from the console engine's contract-limits renderer/);
  assert.ok(ours.includes('export function renderContractLimits({'));
});
