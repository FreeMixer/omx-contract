// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { controlGlobal, isKernelFile, isUse, loadData, packageVersion, resolveData } from '../lib/data.mjs';
import { renderC } from '../render/c.mjs';
import { renderJson } from '../render/json.mjs';
import { renderTs } from '../render/ts.mjs';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
/** omx-contract's own data: the schema's shared facts, what the committed renders are rendered from. */
export const DATA = join(ROOT, 'data');

/** The kinds of the vocabulary (docs/data-layout.md): hosting codes, words and a format's mapped terms. */
export const VOCABULARY_KINDS = ['codes', 'words', 'terms'];

/** The names of data/'s vocabulary items, which 2.14.0's union did not hold. */
export const VOCABULARY = new Set([...loadData(DATA).items.values()].filter(({ item }) => VOCABULARY_KINDS.includes(item.kind)).map(({ name }) => name));

/** How many items data/ declares. */
export const DATA_ITEMS = loadData(DATA).items.size;

/**
 * The macro names 3.0.0's removal of `c.alias` dropped: a travel's second C spelling,
 * OMX_<FACT>_<FIELD>_MIN/_MAX/_DEFAULT. Read generically from the released 2.10.0 header, the last one to carry the
 * aliases section, rather than hand-listed: an old omx-dsp fixture that reads one of these is before 0.25.0, which
 * omx-contract-devel 3.0.0 conflicts with.
 */
export const ALIAS_NAMES = (() => {
  const h = readFileSync(join(ROOT, 'test/fixtures/omx-contract-2.10.0/omx_contract_limits.h'), 'utf8');
  const section = /\/\* The second C spelling of a travel[\s\S]*?\n\n(?=\/\* Every scalar)/.exec(h)[0];
  return new Set([...section.matchAll(/^#define (OMX_\w+)/gm)].map((m) => m[1]));
})();

/**
 * The invented kernels and primitives of test/fixtures/tool-kernels/: the shapes the tool's tests read and break, no owner's values.
 * The definitions themselves are held by their owners' own CI (omx-dsp's `make contract-proof` and contract tests).
 */
export const TOOL_KERNELS = join(ROOT, 'test/fixtures/tool-kernels');

/**
 * omx-clap-core's hosting file, frozen at its 2.14.0 bytes, with its render word: kept until omx-clap-core carries its
 * own proof (omx-contract#192).
 */
export const HOSTING = join(ROOT, 'test/fixtures/owners-2.14.0/hosting.json');

const scratch = [];
process.on('exit', () => { for (const d of scratch) rmSync(d, { recursive: true, force: true }); });

/** A scratch directory in TMPDIR, removed when the test process exits: a test never leaves one behind (#169). */
export function scratchDir(prefix) {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  scratch.push(dir);
  return dir;
}

/** A scratch data directory holding data/, the tool kernels in kernels/ and the hosting file (schema/ beside it). */
export function scratchUnion() {
  const dir = scratchDir('omx-contract-union-');
  cpSync(DATA, join(dir, 'data'), { recursive: true });
  for (const d of ['kernels', 'primitives']) cpSync(join(TOOL_KERNELS, d), join(dir, 'data', d), { recursive: true });
  cpSync(HOSTING, join(dir, 'data/hosting.json'));
  cpSync(join(ROOT, 'schema'), join(dir, 'schema'), { recursive: true });
  return join(dir, 'data');
}

/** The union of data/, the tool kernels and the hosting file, read like a data directory. */
export const UNION = scratchUnion();

const unionItems = loadData(UNION).items;
/** The file of the union that declares item `name`, as a rel (`data/primitives/butterworth-q.json`). */
export function relOf(name) {
  const it = unionItems.get(name);
  if (!it) throw new Error(`the union declares no ${name}`);
  return it.rel;
}

/** A scratch copy of the union (and schema/ beside it), to perturb; returns its data directory. */
export const scratchData = scratchUnion;

/**
 * The renders of the union, laid out as this tree's (include/, share/omx-contract/, test/golden/ts/): what a
 * perturbed union's `render --check` is held against, as the committed renders hold data/.
 */
export const RENDERS = (() => {
  const dir = scratchDir('omx-contract-renders-');
  const resolved = resolveData(loadData(UNION));
  const files = [
    ...renderC(resolved).map((f) => ['include', f]),
    ...renderJson(resolved, packageVersion(ROOT)).map((f) => ['share/omx-contract', f]),
    ...renderTs(resolved).map((f) => ['test/golden/ts', f]),
  ];
  for (const [base, f] of files) {
    mkdirSync(dirname(join(dir, base, f.path)), { recursive: true });
    writeFileSync(join(dir, base, f.path), f.text);
  }
  return dir;
})();

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
  const data = loadData(UNION);
  const docs = Object.fromEntries(data.files.map((f) => [f.rel, JSON.parse(f.text)]));
  fn?.(docs, (rel, name) => declOf(rel, docs[rel], name));
  return Object.fromEntries(Object.entries(docs).map(([k, v]) => [k, JSON.stringify(v)]));
}

export const resolvedOf = (t) => resolveData(loadData(null, t));
