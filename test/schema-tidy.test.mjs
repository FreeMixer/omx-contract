// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
// #5: no item keeps a placeholder doc (the unit list is held in test/live-owners.test.mjs).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { loadData, resolveData } from '../lib/data.mjs';
import { validateData } from '../lib/validate.mjs';
import { renderJson } from '../render/json.mjs';
import { DATA, ROOT, UNION, texts } from './helpers.mjs';

const json = () => JSON.parse(renderJson(resolveData(loadData(UNION)), '0.0.0')[0].text);

// The unit list against the units in use is held against the live owners' data: test/live-owners.test.mjs.

test('no item carries a placeholder doc that only names where it came from', () => {
  const items = json().items;
  assert.ok(Object.keys(items).length > 100, 'the probe sees the items');
  const bare = Object.entries(items).filter(([n, it]) => new RegExp(`^${n}, moved from \\w+\\.?$`).test(it.doc ?? '')).map(([n]) => n);
  assert.deepEqual(bare, []);
});

test('the docs state the development-phase rule while lib/semver.mjs carries it, and not after', async () => {
  const { DEVELOPMENT_PHASE } = await import('../lib/semver.mjs');
  const doc = readFileSync(join(ROOT, 'docs/kernel-files.md'), 'utf8');
  const section = doc.slice(doc.indexOf('## What `semver` judges'));
  assert.ok(section.length > 200, 'the docs carry the semver section');
  assert.equal(/^The development phase:/m.test(section), DEVELOPMENT_PHASE !== null,
    'docs/kernel-files.md says what DEVELOPMENT_PHASE does exactly while it is set');
});

test('dB/oct is a unit an item may state, and a unit outside the list is still refused', () => {
  const slope = (unit) => texts((d) => { d['data/primitives.json'].TILT_PROBE = { kind: 'scalar', doc: 'A tilt slope.', unit, value: 6 }; });
  assert.deepEqual(validateData(loadData(null, slope('dB/oct'))), []);
  assert.ok(validateData(loadData(null, slope('dB/octave'))).some((p) => p.item === 'TILT_PROBE' && /unit must be equal to one of the allowed values/.test(p.message)));
});
