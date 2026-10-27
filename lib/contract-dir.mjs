// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
/**
 * The contract directory (docs/contract-dir.md): `<contractdir>/<schema major>/<package>/`, each package's files
 * listed with their hashes in its MANIFEST.json. loadContractDir() reads it whole or refuses: any refusal is a
 * ContractRefusal carrying a CONTRACT_CODES code, and nothing is returned, so a reader never holds a partial set.
 * What it returns has the shape of loadData(), so validate, fmt and every render read it as they read `data/`.
 */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { refuse } from './codes.mjs';
import { entriesOf, isDescriptor, isKernelFile, kernelName } from './data.mjs';
import { SCHEMA_VERSION, fileProblems, validatesWhole } from './validate.mjs';
import { verbProblems } from './verbs.mjs';

/** The schema major this reader reads, and the only directory under a contractdir it looks in. */
export const SCHEMA_MAJOR = Number(SCHEMA_VERSION.split('.')[0]);

/** The package whose files are read by the schema they ship with, and whose items every file may refer to. */
export const SCHEMA_PACKAGE = 'omx-contract';

/** The `$schema` an installed file carries: the schema of its major, by URL. */
export const installedSchemaUrl = (major) => `https://github.com/FreeMixer/omx-contract/raw/v${major}/schema/omx-contract.schema.json`;
const INSTALLED_SCHEMA = /^https:\/\/github\.com\/FreeMixer\/omx-contract\/raw\/v(\d+)\/schema\/omx-contract\.schema\.json$/;

const VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const FLOOR = /^>= ((0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*))$/;
const HASH = /^[0-9a-f]{64}$/;
const FILE_REL = /^[A-Za-z0-9_+.-]+(\/[A-Za-z0-9_+.-]+)*\.json$/;

/** Whether version `v` is at least version `floor`, both x.y.z. */
export function atLeast(v, floor) {
  const a = v.split('.').map(Number);
  const b = floor.split('.').map(Number);
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i];
  return true;
}

/** The x.y.z of a floor `>= x.y.z`, or undefined when it is not one. */
export const floorOf = (s) => (typeof s === 'string' ? FLOOR.exec(s)?.[1] : undefined);

/** The sha256 of a file's bytes, as the manifest lists it. */
export const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

const HISTORY_DIR = new URL('../schema/history/', import.meta.url);
const historySchemas = new Map();

/** `major.minor.0` of a version: the schema's vocabulary only ever grows at a minor, so a floor's patch names no
 * schema of its own. */
const minorOf = (v) => `${v.split('.').slice(0, 2).join('.')}.0`;

/** The schema object as it stood at the minor `floor` names (its `major.minor.0`), read from the frozen copy under
 * `schema/history/`, cached. `undefined` when `floor` names the bundled schema's own minor (nothing further to
 * check: `fileProblems` already checked against it) or a major schema has since gone by (a major is free to
 * remove or narrow a kind, unit, scale or field, so a floor from before it is no longer a vocabulary this reader's
 * major carries at all, and `contract.schema.too-old` already reads a floor's position, not its major, against
 * `SCHEMA_VERSION`). */
function schemaAt(floor) {
  if (Number(floor.split('.')[0]) !== SCHEMA_MAJOR) return undefined;
  const key = minorOf(floor);
  if (key === minorOf(SCHEMA_VERSION)) return undefined;
  if (!historySchemas.has(key)) {
    const p = new URL(`${key}.schema.json`, HISTORY_DIR);
    if (!existsSync(p)) throw new Error(`schema/history/${key}.schema.json is missing: every past minor needs a frozen copy (docs/contract-dir.md)`);
    historySchemas.set(key, { key, schema: JSON.parse(readFileSync(p, 'utf8')) });
  }
  return historySchemas.get(key);
}

/**
 * The directories that stand where `contractdir` stands, in their order: `dir` (a path or a list) when given, else
 * `$OMX_CONTRACT_PATH` (a `:` list), else `pkg-config --variable=contractdir omx-contract`.
 * @throws contract.dir.absent when none is found, or one named does not exist.
 */
export function contractRoots({ dir, env = process.env, pkgConfig = 'pkg-config' } = {}) {
  let roots;
  let from;
  if (dir !== undefined) { roots = [dir].flat(); from = '--contract-dir'; }
  else if (env.OMX_CONTRACT_PATH) { roots = env.OMX_CONTRACT_PATH.split(':').filter(Boolean); from = 'OMX_CONTRACT_PATH'; }
  else {
    from = 'pkg-config';
    try {
      roots = [execFileSync(pkgConfig, ['--variable=contractdir', 'omx-contract'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()].filter(Boolean);
    } catch { roots = []; }
  }
  if (!roots.length) refuse('dirAbsent', from, 'no contract directory: neither --contract-dir, OMX_CONTRACT_PATH nor pkg-config names one');
  for (const r of roots) if (!existsSync(r) || !statSync(r).isDirectory()) refuse('dirAbsent', r, `the contract directory ${r} (from ${from}) does not exist`);
  return roots;
}

/** Every file under `dir`, relative to it with `/`, sorted. */
function filesUnder(dir) {
  const out = [];
  const walk = (d) => {
    for (const f of readdirSync(d).sort()) {
      const p = join(d, f);
      if (statSync(p).isDirectory()) walk(p);
      else out.push(relative(dir, p).split(sep).join('/'));
    }
  };
  walk(dir);
  return out.sort();
}

/** One package's manifest, checked against its place. */
function readManifest(pdir, name, major) {
  const at = `${name}/MANIFEST.json`;
  const p = join(pdir, 'MANIFEST.json');
  if (!existsSync(p)) refuse('manifestAbsent', name, `${pdir} holds no MANIFEST.json`);
  let m;
  try { m = JSON.parse(readFileSync(p, 'utf8')); } catch (e) { refuse('manifestInvalid', at, `not JSON: ${e.message}`); }
  if (typeof m !== 'object' || m === null || Array.isArray(m)) refuse('manifestInvalid', at, 'not an object');
  const known = ['package', 'version', 'schemaMajor', 'tree', 'files'];
  for (const k of Object.keys(m)) if (!known.includes(k)) refuse('manifestInvalid', at, `unknown key ${k}: a manifest holds ${known.join(', ')}`);
  if (m.package !== name) refuse('manifestInvalid', at, `names the package ${JSON.stringify(m.package)}, and sits in ${name}/`);
  if (typeof m.version !== 'string' || !VERSION.test(m.version)) refuse('manifestInvalid', at, `version ${JSON.stringify(m.version)} is not x.y.z`);
  if (m.schemaMajor !== major) refuse('manifestInvalid', at, `schemaMajor ${JSON.stringify(m.schemaMajor)}, and sits under ${major}/`);
  if (m.tree !== undefined && (typeof m.tree !== 'string' || !/^[A-Za-z0-9_+.-]+(\/[A-Za-z0-9_+.-]+)*$/.test(m.tree) || m.tree.split('/').includes('..'))) {
    refuse('manifestInvalid', at, `tree ${JSON.stringify(m.tree)} is not a relative directory`);
  }
  if (typeof m.files !== 'object' || m.files === null || Array.isArray(m.files) || !Object.keys(m.files).length) refuse('manifestInvalid', at, 'files is not a map of at least one file');
  for (const [rel, h] of Object.entries(m.files)) {
    if (!FILE_REL.test(rel) || rel.split('/').some((s) => s === '..' || s === '.') || rel === 'MANIFEST.json') refuse('manifestInvalid', at, `${JSON.stringify(rel)} is not a relative .json path`);
    if (typeof h !== 'string' || !HASH.test(h)) refuse('manifestInvalid', at, `${rel}: ${JSON.stringify(h)} is not a sha256`);
  }
  return m;
}

/** Every `{ ref }` head, `count` derivation and control count a file's items name, as [name, where]. */
function referencesOf(rel, doc) {
  const out = [];
  const walk = (v, where) => {
    if (Array.isArray(v)) { v.forEach((x) => walk(x, where)); return; }
    if (typeof v !== 'object' || v === null) return;
    if (typeof v.ref === 'string') out.push([v.ref.split('.')[0], where]);
    if (v.derive === 'count' && typeof v.of === 'string') out.push([v.of, where]);
    for (const [k, x] of Object.entries(v)) if (k !== 'ref') walk(x, where);
  };
  for (const [name, item] of entriesOf(rel, doc)) walk(item, name);
  if (isDescriptor(doc)) {
    for (const c of Array.isArray(doc.controls) ? doc.controls : []) {
      if (typeof c.count === 'string') out.push([c.count, c.name]);
      walk(c.travel, c.name);
    }
    walk(doc.latency, 'latency');
  } else if (isKernelFile(rel)) {
    for (const c of Array.isArray(doc.controls) ? doc.controls : []) {
      if (typeof c.count === 'string') out.push([c.count, c.name]);
      walk(c.travel, c.name);
    }
    for (const ro of Array.isArray(doc.readouts) ? doc.readouts : []) walk(ro, `readouts.${ro.name}`);
  }
  return out;
}

/**
 * Read the contract directory: `{ files, items, packages, roots }`, `files` and `items` in loadData's shape (each
 * file with `pkg`, `path` and `installed: true`, each item with `pkg`), files in the order of their reported path
 * (`<manifest tree>/<file>`, else `<package>/<file>`), `packages` a Map of package name to its manifest and dir.
 * `needs` is what the consumer requires, `{ <package>: '>= x.y.z' }`.
 * @throws ContractRefusal, the first refusal met; see docs/contract-dir.md for the order.
 */
export function loadContractDir({ dir, env, pkgConfig, needs = {}, major = SCHEMA_MAJOR } = {}) {
  const roots = contractRoots({ dir, env, pkgConfig });
  const packages = new Map();
  for (const root of roots) {
    const mdir = join(root, String(major));
    if (!existsSync(mdir) || !statSync(mdir).isDirectory()) continue;
    for (const name of readdirSync(mdir).sort()) {
      const pdir = join(mdir, name);
      if (packages.has(name) || !statSync(pdir).isDirectory()) continue;
      packages.set(name, { name, dir: pdir, manifest: readManifest(pdir, name, major) });
    }
  }
  if (!packages.size) refuse('dirAbsent', roots.join(':'), `no package is installed under ${major}/ of ${roots.join(':')}`);

  const files = [];
  for (const { name, dir: pdir, manifest } of packages.values()) {
    const listed = Object.keys(manifest.files);
    const present = filesUnder(pdir).filter((f) => f !== 'MANIFEST.json');
    for (const f of present) if (!listed.includes(f)) refuse('manifestMismatch', `${name}/${f}`, 'present in the package directory, and its manifest does not list it');
    for (const f of listed.sort()) {
      const at = `${name}/${f}`;
      if (!present.includes(f)) refuse('manifestMismatch', at, 'listed by the manifest, and not installed');
      const bytes = readFileSync(join(pdir, f));
      if (sha256(bytes) !== manifest.files[f]) refuse('manifestMismatch', at, `sha256 ${sha256(bytes)}, and the manifest lists ${manifest.files[f]}`);
      const text = bytes.toString('utf8');
      let doc;
      try { doc = JSON.parse(text); } catch (e) { refuse('fileNotJson', at, e.message); }
      if (typeof doc !== 'object' || doc === null || Array.isArray(doc)) refuse('fileInvalid', at, 'a data file is an object');
      const m = INSTALLED_SCHEMA.exec(doc.$schema ?? '');
      if (!m) refuse('schemaMajor', at, `$schema ${JSON.stringify(doc.$schema)} is not ${installedSchemaUrl(major)}`);
      if (Number(m[1]) !== major) refuse('schemaMajor', at, `$schema names schema major ${m[1]}; this reader reads ${major}`);
      if (doc.requires !== undefined && (typeof doc.requires !== 'object' || doc.requires === null || Array.isArray(doc.requires))) refuse('fileInvalid', at, 'requires is not a map');
      const req = doc.requires ?? {};
      for (const [k, v] of Object.entries(req)) if (!floorOf(v)) refuse('fileInvalid', at, `requires.${k} ${JSON.stringify(v)} is not a floor ">= x.y.z"`);
      const floor = floorOf(req['omx-contract-schema']);
      if (floor === undefined && name !== SCHEMA_PACKAGE) refuse('schemaFloorAbsent', at, 'requires.omx-contract-schema states no schema floor');
      if (floor !== undefined && !atLeast(SCHEMA_VERSION, floor)) refuse('schemaTooOld', at, `requires omx-contract-schema >= ${floor}; this reader's schema is ${SCHEMA_VERSION}`);
      if (isDescriptor(doc) && doc.origin === 'scanned') refuse('originMisplaced', at, 'a scanned plugin descriptor: what a machine found about itself is no declaration, and is never installed');
      const rel = `${manifest.tree ?? name}/${f}`;
      const file = { rel, text, doc, pkg: name, path: join(pdir, f), installed: true };
      const problems = fileProblems(file);
      // A descriptor's own rules carry their code; everything else a file can break is contract.file.invalid.
      const coded = problems.find((p) => p.name);
      if (coded) refuse(coded.name, at, problems.filter((p) => p.name === coded.name).map((p) => `${p.item}: ${p.message}`).join('; '));
      if (problems.length) refuse('fileInvalid', at, problems.map((p) => `${p.item}: ${p.rule}: ${p.message}`).join('; '));
      if (floor !== undefined) {
        const hist = schemaAt(floor);
        if (hist && !validatesWhole(hist.schema, hist.key, file)) {
          refuse('schemaFloorUnderstated', at, `requires omx-contract-schema >= ${floor}; this file does not validate against the schema at that floor, only against a newer one`);
        }
      }
      files.push(file);
    }
  }
  files.sort((a, b) => (a.rel === b.rel ? (a.pkg < b.pkg ? -1 : 1) : a.rel < b.rel ? -1 : 1));

  const items = new Map();
  for (const f of files) {
    for (const [name, item] of entriesOf(f.rel, f.doc)) {
      if (items.has(name)) {
        const o = items.get(name);
        refuse('itemDuplicate', `${f.rel} (${f.pkg})`, `${name}: already declared by ${o.pkg} (${o.rel})`);
      }
      items.set(name, { name, rel: f.rel, item, pkg: f.pkg });
    }
  }

  // A kernel is one file: its controls are read in that file's order, so a second package's file of the same kernel,
  // even with names of its own, would replace its controls in the kernels index.
  const kernels = new Map();
  for (const f of files) {
    if (!isKernelFile(f.rel) || isDescriptor(f.doc)) continue;
    const k = kernelName(f.rel);
    if (kernels.has(k)) refuse('kernelDuplicate', `${f.rel} (${f.pkg})`, `kernel ${k}: already declared by ${kernels.get(k)}`);
    kernels.set(k, `${f.pkg} (${f.rel})`);
  }

  for (const f of files) {
    const req = f.doc.requires ?? {};
    for (const [name, where] of referencesOf(f.rel, f.doc)) {
      const target = items.get(name);
      if (!target) refuse('refUnresolved', f.rel, `${where}: refers to ${name}, which no installed file declares`);
      if (target.pkg !== f.pkg && target.pkg !== SCHEMA_PACKAGE && !(target.pkg in req)) {
        refuse('refUndeclared', f.rel, `${where}: refers to ${name} of ${target.pkg}, which its requires does not name`);
      }
    }
    for (const [pkg, v] of Object.entries(req)) {
      if (pkg === 'omx-contract-schema') continue;
      checkPackage(packages, pkg, v, f.rel);
    }
  }
  // A verb has one owner, starts its format with its word, names known hosts and refusals that exist (lib/verbs.mjs).
  const [verb] = verbProblems(items);
  if (verb) refuse(verb.name, verb.rel, `${verb.item}: ${verb.message}`);
  for (const [pkg, v] of Object.entries(needs)) {
    if (!floorOf(v)) refuse('fileInvalid', 'needs', `${pkg} ${JSON.stringify(v)} is not a floor ">= x.y.z"`);
    checkPackage(packages, pkg, v, 'needs');
  }
  return { files, items, packages, roots };
}

function checkPackage(packages, pkg, v, from) {
  const p = packages.get(pkg);
  if (!p) refuse('packageAbsent', from, `requires ${pkg} ${v}, which is not installed`);
  if (!atLeast(p.manifest.version, floorOf(v))) refuse('packageTooOld', from, `requires ${pkg} ${v}, and ${p.manifest.version} is installed`);
}

/** The version a read of the directory renders under: omx-contract's own manifest version, else `fallback`. */
export const contractVersion = (data, fallback) => data.packages?.get(SCHEMA_PACKAGE)?.manifest.version ?? fallback;
