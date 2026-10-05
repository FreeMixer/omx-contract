#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
/**
 * ONE-TIME: the units of omx-dsp's committed limits header that an omx-dsp file names (its include/,
 * test/, tools/ and Makefile, comments stripped, the header itself excluded), frozen as
 * test/fixtures/omx-dsp-v0.1.3/read-units.json for the round-trip proof (spec §2.3, §4.4 step 2).
 * Usage: node tools/seed/omx-dsp-readers.mjs <omx-dsp checkout at v0.1.3> > test/fixtures/omx-dsp-v0.1.3/read-units.json
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { limitUnits } from '../proof/limit-units.mjs';

const root = process.argv[2];
const header = join(root, 'include/omxdsp/omx_contract_limits.h');
const units = limitUnits(readFileSync(header, 'utf8')).filter((u) => u.frame === undefined);
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
const where = new Map();
const walk = (d) => {
  for (const f of readdirSync(d).sort()) {
    const p = join(d, f);
    if (f === '.git') continue;
    if (statSync(p).isDirectory()) { walk(p); continue; }
    if (p === header || !/\.(c|h)$|^Makefile$/.test(f)) continue;
    for (const id of strip(readFileSync(p, 'utf8')).match(/\b[A-Za-z_]\w*\b/g) ?? []) {
      if (!where.has(id)) where.set(id, new Set());
      where.get(id).add(p.slice(root.length + 1).split('/')[0]);
    }
  }
};
walk(root);
const read = units.filter((u) => u.names.some((n) => where.has(n)))
  .map((u) => ({ key: u.key, readBy: [...new Set(u.names.flatMap((n) => [...(where.get(n) ?? [])]))].sort() }));
process.stdout.write(`${JSON.stringify({ omxdsp: 'v0.1.3', units: units.length, read }, null, 1)}\n`);
