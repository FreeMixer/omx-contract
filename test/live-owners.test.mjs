// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
/**
 * The kernels this repo's goldens run over are the frozen 2.14.0 fixture (BUILDING.md), so a kernel that left every live
 * owner would never be seen (#109: idelay left omx-dsp's data for a while and nothing went red). Given the data
 * directories of the live owners in OMX_LIVE_OWNER_DATA (a colon-separated list, e.g. an omx-dsp checkout's data/), every
 * kernel file of the fixture must still exist in one of them, unless REMOVED records its removal here.
 */
import assert from 'node:assert/strict';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { OWNERS } from './helpers.mjs';

/** Kernels removed on purpose since 2.14.0, with where the removal is recorded. */
export const REMOVED = {};

const live = (process.env.OMX_LIVE_OWNER_DATA ?? '').split(':').filter(Boolean);
export const missing = (kernels, dirs, removed = REMOVED) => kernels.filter((k) => !(k in removed) && !dirs.some((d) => existsSync(join(d, 'kernels', k))));

test('every kernel of the 2.14.0 fixture is still declared by a live owner, or its removal is recorded', { skip: live.length === 0 && !process.env.GITHUB_ACTIONS && 'OMX_LIVE_OWNER_DATA names no live owner data directory' }, () => {
  const kernels = readdirSync(join(OWNERS, 'kernels')).filter((f) => f.endsWith('.json'));
  assert.ok(kernels.length > 20, 'positive control: the fixture holds its kernels');
  assert.deepEqual(missing(kernels, live), []);
});

test('the check names a kernel no owner holds, and a recorded removal is not named', () => {
  const dir = join(OWNERS);   // holds kernels/, so every kernel is found there
  assert.deepEqual(missing(['gate.json', 'nope.json'], [dir]), ['nope.json']);
  assert.deepEqual(missing(['nope.json'], [dir], { 'nope.json': 'removed in 9.9.9' }), []);
});

// A skipped check is a check that is not there: in CI the owner's data is fetched (tools/live-owner-data.sh), so a run
// that finds none is red, not skipped.
test('in CI, OMX_LIVE_OWNER_DATA names a live owner and its kernels are there', () => {
  if (!process.env.GITHUB_ACTIONS) return;
  assert.ok(live.length > 0, 'OMX_LIVE_OWNER_DATA is not set: the live-owner step did not run');
  assert.ok(live.every((d) => existsSync(join(d, 'kernels'))), 'a live owner directory holds no kernels');
});
