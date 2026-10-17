// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
// #5: the schema's unit list is the units the declared items use, and no item keeps a placeholder doc.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { loadData, resolveData } from '../lib/data.mjs';
import { renderJson } from '../render/json.mjs';
import { DATA, ROOT, UNION } from './helpers.mjs';

const json = () => JSON.parse(renderJson(resolveData(loadData(UNION)), '0.0.0')[0].text);

test('the schema unit enum lists exactly the units the items and readouts use', () => {
  const schema = JSON.parse(readFileSync(join(ROOT, 'schema/omx-contract.schema.json'), 'utf8'));
  const listed = new Set(schema.$defs.unit.enum);
  const used = new Set();
  const walk = (o) => {
    if (!o || typeof o !== 'object') return;
    for (const [k, v] of Object.entries(o)) {
      if (k === 'unit' && typeof v === 'string') used.add(v);
      walk(v);
    }
  };
  const j = json();
  walk(j.items);
  walk(j.kernels);
  assert.ok(used.size >= 8, 'the probe sees the units in use');
  assert.deepEqual([...listed].filter((u) => !used.has(u)), [], 'a unit nothing uses is in the enum');
  assert.deepEqual([...used].filter((u) => !listed.has(u)), [], 'a unit in use is missing from the enum');
});

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
