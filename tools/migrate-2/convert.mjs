#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
/*
 * convert.mjs — step 2 of the 2.0.0 migration: rewrite every data/kernels/<kernel>.json in the two-section
 * shape from tools/migrate-2/inventory.json. Nothing is dropped: every field of every entry is carried over;
 * the stored aggregates and tables keep only their names and docs, and lib/data.mjs regenerates their content.
 *   controls    ordered list; a travel or a choice, its own `name`, its `global` only when the name does not
 *               derive it (<KERNEL>_<NAME>_RANGE / <KERNEL>_<NAME>S), its `table` when it is a field of one
 *   tables      { NAME: { doc, ... } } — a fields table that is the kernel's only declaration of its controls
 *   aggregates  { NAME: { doc, fields: [control names] } } — the row's field-name map, by reference
 *   constants   { NAME: entry } — scalars, lists, sheets, unchanged
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const DIR = join(HERE, '..', '..', 'data', 'kernels');
const inv = JSON.parse(readFileSync(join(HERE, 'inventory.json'), 'utf8'));
export const snake = (n) => n.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toUpperCase();
export const derive = (K, name, kind) => `${K}_${snake(name)}${kind === 'travel' ? '_RANGE' : 'S'}`;

for (const [kernel, rec] of Object.entries(inv)) {
  const K = kernel.toUpperCase().replace(/-/g, '_');
  const file = join(DIR, `${kernel}.json`);
  const doc = JSON.parse(readFileSync(file, 'utf8'));
  const out = { $schema: doc.$schema };
  const controls = [];
  for (const c of rec.controls) {
    const { kind, ...rest } = doc[c.global];
    const ctl = { name: c.name, kind: kind === 'set' ? 'choice' : 'travel' };
    if (derive(K, c.name, ctl.kind) !== c.global) ctl.global = c.global;
    controls.push({ ...ctl, ...rest });
  }
  const tables = {};
  for (const t of rec.tables) {
    const { kind, fields, ...meta } = doc[t.global];
    tables[t.global] = meta;
    for (const [fname, travel] of Object.entries(fields)) controls.push({ name: fname, kind: 'travel', table: t.global, travel });
  }
  const aggregates = {};
  for (const a of rec.aggregates) {
    const { kind, fields, ...meta } = doc[a.global];
    aggregates[a.global] = { ...meta, fields: Object.entries(fields).map(([fname, t]) => {
      const c = controls.find((x) => (x.global ?? derive(K, x.name, x.kind)) === t.ref);
      if (!c || c.name !== fname) throw new Error(`${kernel}: ${a.global}.${fname} names no control`);
      return fname;
    }) };
  }
  const constants = {};
  for (const c of rec.constants) constants[c.global] = doc[c.global];
  if (controls.length) out.controls = controls;
  if (Object.keys(tables).length) out.tables = tables;
  if (Object.keys(aggregates).length) out.aggregates = aggregates;
  if (Object.keys(constants).length) out.constants = constants;
  writeFileSync(file, JSON.stringify(out, null, 2) + '\n');
  console.log(`${kernel.padEnd(12)} controls ${controls.length} tables ${Object.keys(tables).length} aggregates ${Object.keys(aggregates).length} constants ${Object.keys(constants).length}`);
}
