// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadData, resolveData } from '../lib/data.mjs';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const DATA = join(ROOT, 'data');

/** A scratch copy of data/ (and schema/ beside it); returns its data directory. */
export function scratchData() {
  const dir = mkdtempSync(join(tmpdir(), 'omx-contract-'));
  cpSync(DATA, join(dir, 'data'), { recursive: true });
  cpSync(join(ROOT, 'schema'), join(dir, 'schema'), { recursive: true });
  return join(dir, 'data');
}

/** Edit one data file of a scratch copy in place: `fn(doc)` mutates the parsed document. */
export function editData(dataDir, rel, fn) {
  const p = join(dataDir, rel);
  const doc = JSON.parse(readFileSync(p, 'utf8'));
  fn(doc);
  writeFileSync(p, `${JSON.stringify(doc, null, 2)}\n`);
}

/** The data as `{ rel: text }` with `fn(docsByRel)` applied, for loadData(null, texts). */
export function texts(fn) {
  const data = loadData(DATA);
  const docs = Object.fromEntries(data.files.map((f) => [f.rel, JSON.parse(f.text)]));
  fn?.(docs);
  return Object.fromEntries(Object.entries(docs).map(([k, v]) => [k, JSON.stringify(v)]));
}

export const resolvedOf = (t) => resolveData(loadData(null, t));
