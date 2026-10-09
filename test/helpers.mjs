// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { controlGlobal, isKernelFile, isUse, loadData, resolveData } from '../lib/data.mjs';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const DATA = join(ROOT, 'data');

/** A scratch copy of data/ (and schema/ beside it); returns its data directory. */
export function scratchData() {
  const dir = mkdtempSync(join(tmpdir(), 'omx-contract-'));
  cpSync(DATA, join(dir, 'data'), { recursive: true });
  cpSync(join(ROOT, 'schema'), join(dir, 'schema'), { recursive: true });
  return join(dir, 'data');
}

/**
 * Where a data file writes the item `name`, to perturb in place. In a kernel file: the control whose item it is (its
 * `travel`, `ids`, `default`, `c` are the item's), the table's or the aggregate's own entry, or the constant; with
 * `TABLE.field`, that field control's travel. In rates.json and primitives.json, the item itself.
 * @throws when the file declares no such item, so a perturbation can never move nothing.
 */
export function declOf(rel, doc, name) {
  const found = (() => {
    if (!isKernelFile(rel)) return doc[name];
    const [head, field] = name.split('.');
    if (field !== undefined) return doc.controls?.find((c) => c.table === head && c.name === field)?.travel;
    return doc.controls?.find((c) => !c.table && !isUse(c) && controlGlobal(rel, c) === head) ?? doc.tables?.[head] ?? doc.aggregates?.[head] ?? doc.constants?.[head];
  })();
  if (found === undefined) throw new Error(`${rel} declares no ${name}`);
  return found;
}

/** Remove the declaration of item `name` from a kernel file (a control, a table with its controls, an aggregate, a constant). */
export function dropDecl(rel, doc, name) {
  declOf(rel, doc, name);
  if (!isKernelFile(rel)) { delete doc[name]; return; }
  doc.controls = (doc.controls ?? []).filter((c) => !(c.table === name || (!c.table && controlGlobal(rel, c) === name)));
  for (const s of ['tables', 'aggregates', 'constants']) if (doc[s]) delete doc[s][name];
}

/**
 * Edit one data file of a scratch copy in place: `fn(doc, at)` mutates the parsed document, `at(name)` being
 * declOf on it.
 */
export function editData(dataDir, rel, fn) {
  const p = join(dataDir, rel);
  const doc = JSON.parse(readFileSync(p, 'utf8'));
  fn(doc, (name) => declOf(rel.startsWith('data/') ? rel : `data/${rel}`, doc, name));
  writeFileSync(p, `${JSON.stringify(doc, null, 2)}\n`);
}

/** The data as `{ rel: text }` with `fn(docsByRel, at)` applied, `at(rel, name)` being declOf, for loadData(null, texts). */
export function texts(fn) {
  const data = loadData(DATA);
  const docs = Object.fromEntries(data.files.map((f) => [f.rel, JSON.parse(f.text)]));
  fn?.(docs, (rel, name) => declOf(rel, docs[rel], name));
  return Object.fromEntries(Object.entries(docs).map(([k, v]) => [k, JSON.stringify(v)]));
}

export const resolvedOf = (t) => resolveData(loadData(null, t));
