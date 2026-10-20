#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
/*
 * data-layout.mjs — omx-contract's own data/ against its layout (docs/data-layout.md): every word in the file its
 * rule names, and the mapped formats equal to the inventory of the installed ones.
 *
 *   node tools/data-layout.mjs [--data <dir>] [--inventory <dir>]
 *
 * Layout: no hosting code (omx-clap-core's since 3.0.0, docs/hosting.md) and no codes item outside codes.json; an
 * LV2 term only in the file of the specification whose URI it extends; a CLAP identifier only in the file of its
 * header; every item named by its path; the vocabulary files' items by their prefix. Coverage: every term of inventory/lv2.json and inventory/clap.json
 * mapped under its name with its URI or identifier and a status, the specification and its version equal, and no
 * mapped term the inventory lacks.
 *
 * Exit 0 clean; 1 a problem, each named with its file; 2 usage.
 */
import { readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dataFiles } from '../lib/data.mjs';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** A path below its domain directory in upper snake case: `ext/draft/scratch-memory` is EXT_DRAFT_SCRATCH_MEMORY. */
export const pathName = (p) => p.replace(/[^A-Za-z0-9]+/g, '_').toUpperCase();

/** The files at the top of data/ outside the domain directories, and the prefix their items carry. */
export const TOP = {
  'codes.json': null, 'primitives.json': null, 'rates.json': null,
  'measurement.json': 'MEASUREMENT_', 'resource-profile.json': 'RESOURCE_', 'machine-class.json': 'MACHINE_',
};

/** A CLAP identifier's name in its file: a string constant's text less `clap.`, any other in lowerCamel less `CLAP_`. */
export function clapName(id, group, value) {
  if (group === 'string') return value.startsWith('clap.') ? value.slice(5) : value;
  const parts = id.slice(5).toLowerCase().split('_');
  return parts[0] + parts.slice(1).map((p) => p.slice(0, 1).toUpperCase() + p.slice(1)).join('');
}

const itemsOf = (doc) => Object.entries(doc).filter(([k]) => !k.startsWith('$') && !['requires', 'source', 'render', 'checks'].includes(k));
const sorted = (keys) => keys.every((k, i) => i === 0 || keys[i - 1] < k);

/** The layout problems of `files` (`[{ rel, doc }]`, rel below data/): `[message]`. */
export function layoutProblems(files) {
  const out = [];
  for (const { rel, doc } of files) {
    const items = itemsOf(doc);
    const say = (m) => out.push(`${rel}: ${m}`);
    const codesItems = items.filter(([, it]) => it.kind === 'codes');
    const text = JSON.stringify(doc);
    if (!rel.startsWith('formats/lv2/') && /lv2plug\.in\/ns\//.test(text)) say('an LV2 URI outside data/formats/lv2/');
    if (!rel.startsWith('formats/clap/') && items.some(([, it]) => it.kind === 'terms' && it.format === 'clap')) say('CLAP terms outside data/formats/clap/');
    let m;
    if (rel.startsWith('hosting/')) {
      say('the hosting codes are omx-clap-core\'s (contract.d/3/omx-clap-core/hosting/), never omx-contract\'s');
    } else if ((m = /^formats\/(lv2|clap)\/(.+)\.json$/.exec(rel))) {
      const [, format, path] = m;
      const want = `${format.toUpperCase()}_${pathName(path)}_TERMS`;
      if (items.length !== 1 || items[0][0] !== want || items[0][1].kind !== 'terms') { say(`holds one terms item, ${want}`); continue; }
      const it = items[0][1];
      if (it.format !== format) say(`${want}: format ${it.format} in a ${format} file`);
      if (!sorted(Object.keys(it.terms))) say(`${want}: its terms are not sorted by name`);
      if (format === 'clap' && it.spec !== `clap/${path}.h`) say(`${want}: spec ${it.spec} is not clap/${path}.h`);
      for (const [k, t] of Object.entries(it.terms)) {
        if (format === 'lv2' && !(t.uri === it.spec || t.uri?.startsWith(`${it.spec}#`) || t.uri?.startsWith(`${it.spec}/`))) say(`${k}: ${t.uri} lies outside ${it.spec}`);
        if (format === 'clap' && (t.uri !== undefined || !t.id)) say(`${k}: a CLAP term carries its identifier, never a URI`);
      }
    } else if (Object.hasOwn(TOP, rel)) {
      for (const [n] of items) if (TOP[rel] && !n.startsWith(TOP[rel])) say(`${n}: an item of ${rel} is named ${TOP[rel]}...`);
      if (codesItems.length && rel !== 'codes.json') say(`${codesItems.map(([n]) => n).join(', ')}: a codes item outside codes.json`);
    } else {
      say('no rule of docs/data-layout.md places this file');
    }
  }
  return out;
}

const fileOf = (files, rel) => files.find((f) => f.rel === rel)?.doc;

/** The coverage problems of `files` against the inventories (`{ lv2, clap }`): `[message]`. */
export function coverageProblems(files, { lv2, clap }) {
  const out = [];
  const mapped = new Set();
  for (const [name, spec] of Object.entries(lv2.specs)) {
    const rel = `formats/lv2/${name}.json`;
    const doc = fileOf(files, rel);
    const it = doc && doc[`LV2_${pathName(name)}_TERMS`];
    if (!it) { out.push(`${rel}: the LV2 specification ${spec.uri} is not mapped`); continue; }
    mapped.add(rel);
    if (it.spec !== spec.uri || it.version !== spec.version) out.push(`${rel}: spec ${it.spec} ${it.version}, the installed one is ${spec.uri} ${spec.version}`);
    const want = new Map(spec.terms.map((t) => [t.name, t]));
    for (const [n, t] of want) {
      const m = it.terms[n];
      if (!m) out.push(`${rel}: ${t.uri} is not mapped`);
      else if (m.uri !== t.uri) out.push(`${rel}: ${n} maps ${m.uri}, the term is ${t.uri}`);
      else if (!m.status) out.push(`${rel}: ${n} has no status`);
    }
    for (const n of Object.keys(it.terms)) if (!want.has(n)) out.push(`${rel}: ${n} is no term of the installed ${spec.uri}`);
  }
  for (const [h, ids] of Object.entries(clap.headers)) {
    const rel = `formats/clap/${h}.json`;
    const doc = fileOf(files, rel);
    const it = doc && doc[`CLAP_${pathName(h)}_TERMS`];
    if (!it) { out.push(`${rel}: the CLAP header clap/${h}.h is not mapped`); continue; }
    mapped.add(rel);
    if (it.version !== clap.version) out.push(`${rel}: version ${it.version}, the installed CLAP is ${clap.version}`);
    const want = new Map(ids.map((i) => [clapName(i.name, i.group, i.value), i]));
    for (const [n, i] of want) {
      const m = it.terms[n];
      if (!m) out.push(`${rel}: ${i.name} is not mapped (as ${n})`);
      else if (m.id !== i.name || (i.group === 'string' && m.value !== i.value)) out.push(`${rel}: ${n} maps ${m.id} ${m.value ?? ''}, the identifier is ${i.name} ${i.group === 'string' ? i.value : ''}`);
      else if (!m.status) out.push(`${rel}: ${n} has no status`);
    }
    for (const n of Object.keys(it.terms)) if (!want.has(n)) out.push(`${rel}: ${n} is no identifier of the installed clap/${h}.h`);
  }
  for (const { rel } of files) if (rel.startsWith('formats/') && !mapped.has(rel)) out.push(`${rel}: maps no installed specification or header`);
  return out;
}

/** data/'s files as `[{ rel, doc }]`, rel below `dir`, codes.json included. */
export function readFiles(dir) {
  const rels = dataFiles(dir).map((p) => relative(dir, p));
  return ['codes.json', ...rels].map((rel) => ({ rel, doc: JSON.parse(readFileSync(join(dir, rel), 'utf8')) }));
}

export const readInventory = (dir) => ({
  lv2: JSON.parse(readFileSync(join(dir, 'lv2.json'), 'utf8')),
  clap: JSON.parse(readFileSync(join(dir, 'clap.json'), 'utf8')),
});

function main(argv) {
  let data = join(ROOT, 'data');
  let inventory = join(ROOT, 'inventory');
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--data' && argv[i + 1]) data = argv[++i];
    else if (argv[i] === '--inventory' && argv[i + 1]) inventory = argv[++i];
    else { process.stderr.write(`data-layout: unknown argument ${argv[i]}\n`); return 2; }
  }
  const files = readFiles(data);
  const problems = [...layoutProblems(files), ...coverageProblems(files, readInventory(inventory))];
  for (const p of problems) process.stderr.write(`data-layout: ${p}\n`);
  if (!problems.length) process.stdout.write(`data-layout: ${files.length} files, each in its place; every installed LV2 and CLAP term mapped\n`);
  return problems.length ? 1 : 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = main(process.argv.slice(2));
