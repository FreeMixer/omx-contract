#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
/*
 * inventory.mjs — step 1 of the 2.0.0 migration (openmixer spec 2026-10-09-plugin-from-contract §0.3).
 * Classifies every entry of every data/kernels/<kernel>.json as a control (a single travel, or one field of
 * a table that is the kernel's only declaration of its controls), a choice (a set), a constant (scalar,
 * list, sheet), or an aggregate (a fields table repeating single travels), and checks two things the
 * converter relies on:
 *   - an aggregate repeats its singles EXACTLY (every field's travel equals one single's travel), and
 *   - a control's global name is derivable (<KERNEL>_<NAME>_RANGE / <KERNEL>_<NAME>S) or is recorded.
 * Writes tools/migrate-2/inventory.json and prints one line per kernel; exit 1 when an entry needs a hand
 * decision (named, never guessed).
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const DIR = join(ROOT, 'data', 'kernels');
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const camel = (u) => u.toLowerCase().replace(/_([a-z0-9])/g, (_, x) => x.toUpperCase());
const out = {};
let decisions = 0;
for (const f of readdirSync(DIR).filter((n) => n.endsWith('.json')).sort()) {
  const kernel = f.replace(/\.json$/, '');
  const K = kernel.toUpperCase().replace(/-/g, '_');
  const doc = JSON.parse(readFileSync(join(DIR, f), 'utf8'));
  delete doc.$schema;
  const singles = Object.entries(doc).filter(([, e]) => e.kind === 'travels' && e.travel);
  const tables = Object.entries(doc).filter(([, e]) => e.kind === 'travels' && e.fields);
  const rec = { controls: [], constants: [], aggregates: [], tables: [], review: [] };
  for (const [name, e] of Object.entries(doc)) {
    if (e.kind === 'travels' && e.travel) {
      const short = name.startsWith(K + '_') && name.endsWith('_RANGE') ? camel(name.slice(K.length + 1, -'_RANGE'.length)) : null;
      rec.controls.push({ global: name, kind: 'travel', name: short, derivable: !!short });
    } else if (e.kind === 'set') {
      const short = name.startsWith(K + '_') && name.endsWith('S') ? camel(name.slice(K.length + 1, -1)) : null;
      rec.controls.push({ global: name, kind: 'choice', name: short, derivable: !!short });
    } else if (e.kind === 'travels' && e.fields) {
      if (singles.length) {
        // An aggregate: every field must equal one single travel exactly.
        // A field is a reference to one single ({ ref: NAME }) or, in an older file, a copy of its travel.
        const unmatched = Object.entries(e.fields).filter(([, t]) => !(t.ref ? singles.some(([n]) => n === t.ref) : singles.some(([, s]) => eq(s.travel, t)))).map(([fname]) => fname);
        for (const [fname, t] of Object.entries(e.fields)) {
          const c = rec.controls.find((x) => x.global === t.ref);
          if (c) { c.name = fname; c.derivable = true; c.from = 'aggregate'; }
          else if (t.ref) rec.pendingNames = [...(rec.pendingNames || []), [fname, t.ref]];
        }
        rec.aggregates.push({ global: name, fields: Object.keys(e.fields), exact: unmatched.length === 0, unmatched });
        if (unmatched.length) rec.review.push(`${name}: fields ${unmatched.join(', ')} match no single travel`);
      } else {
        rec.tables.push({ global: name, fields: Object.keys(e.fields) });
      }
    } else {
      rec.constants.push({ global: name, kind: e.kind });
    }
  }
  // A control the aggregate named after it was classified first: apply those names now.
  for (const [fname, ref] of rec.pendingNames || []) { const c = rec.controls.find((x) => x.global === ref); if (c) { c.name = fname; c.derivable = true; c.from = 'aggregate'; } }
  delete rec.pendingNames;
  // A name the global does not derive from is recorded explicitly (the control keeps `global`); not a review item.
  for (const c of rec.controls) if (!c.derivable) { c.name = c.global.replace(/_RANGE$/, '').replace(/S$/, '').toLowerCase().replace(/_([a-z0-9])/g, (_, x) => x.toUpperCase()); c.explicitGlobal = true; }
  if (tables.length > 1) rec.review.push(`${tables.length} field tables and no singles: which one holds the controls?`);
  decisions += rec.review.length;
  out[kernel] = rec;
  console.log(`${kernel.padEnd(12)} controls ${String(rec.controls.length).padStart(2)}  tables ${rec.tables.length}  aggregates ${rec.aggregates.length}${rec.aggregates.some((a) => !a.exact) ? ' (NOT exact)' : ''}  constants ${String(rec.constants.length).padStart(2)}  review ${rec.review.length}`);
  for (const r of rec.review) console.log(`  REVIEW ${r}`);
}
writeFileSync(join(dirname(fileURLToPath(import.meta.url)), 'inventory.json'), JSON.stringify(out, null, 2) + '\n');
process.exit(decisions ? 1 : 0);
