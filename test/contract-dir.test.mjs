// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
// The contract directory (docs/contract-dir.md): omx-contract's own data installed by tools/install-contract-dir.sh
// and read back through loadContractDir() renders byte for byte what data/ renders; every refusal of the reader is
// raised by its CONTRACT_CODES code, one sabotage arm per code, and stops the whole read.
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, test } from 'node:test';
import { main } from '../bin/omx-contract.mjs';
import { CONTRACT_CODES, ContractRefusal } from '../lib/codes.mjs';
import { SCHEMA_MAJOR, contractRoots, contractVersion, installedSchemaUrl, loadContractDir, sha256 } from '../lib/contract-dir.mjs';
import { dataFiles, loadData, packageVersion, resolveData } from '../lib/data.mjs';
import { SCHEMA_VERSION, fileProblems } from '../lib/validate.mjs';
import { renderC } from '../render/c.mjs';
import { renderJson } from '../render/json.mjs';
import { renderTs } from '../render/ts.mjs';
import { DATA, ROOT } from './helpers.mjs';

const SCRATCH = mkdtempSync(join(tmpdir(), 'omx-contract-dir-'));
after(() => rmSync(SCRATCH, { recursive: true, force: true }));
let n = 0;
const VERSION = packageVersion(ROOT);
const URL2 = installedSchemaUrl(2);

/** A fresh contract directory holding omx-contract's data/ as the install writes it; returns its root. */
function installed() {
  const root = join(SCRATCH, `cd-${n++}`);
  execFileSync('sh', [join(ROOT, 'tools/install-contract-dir.sh'), '-x', 'codes.json', 'omx-contract', VERSION, String(SCHEMA_MAJOR), DATA, root, 'data'], { stdio: 'ignore' });
  return root;
}

const pkgDir = (root, pkg) => join(root, String(SCHEMA_MAJOR), pkg);

/** Rewrite a package's manifest from what is on disk, as the install would. `edit(m)` may change it after. */
function rehash(root, pkg, edit) {
  const dir = pkgDir(root, pkg);
  const mp = join(dir, 'MANIFEST.json');
  const m = existsSync(mp) ? JSON.parse(readFileSync(mp, 'utf8')) : { package: pkg, version: '1.0.0', schemaMajor: SCHEMA_MAJOR };
  m.files = {};
  const walk = (d, pre) => {
    for (const f of readdirSync(d, { withFileTypes: true })) {
      const rel = pre ? `${pre}/${f.name}` : f.name;
      if (f.isDirectory()) walk(join(d, f.name), rel);
      else if (rel !== 'MANIFEST.json') m.files[rel] = sha256(readFileSync(join(d, f.name)));
    }
  };
  walk(dir, '');
  edit?.(m);
  writeFileSync(mp, `${JSON.stringify(m, null, 2)}\n`);
}

/** Add a package `pkg` at `version` holding `files` ({ rel: doc | text }), with its manifest. */
function addPackage(root, pkg, files, version = '1.0.0') {
  for (const [rel, doc] of Object.entries(files)) {
    const p = join(pkgDir(root, pkg), rel);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, typeof doc === 'string' ? doc : `${JSON.stringify(doc, null, 2)}\n`);
  }
  rehash(root, pkg, (m) => { m.version = version; });
}

/** A file of a package other than omx-contract: the installed $schema, a schema floor, and its items. */
const owned = (items, requires = {}) => ({ $schema: URL2, requires: { 'omx-contract-schema': `>= ${SCHEMA_VERSION}`, ...requires }, ...items });
const scalar = (value, extra = {}) => ({ kind: 'scalar', doc: 'a test scalar', unit: '', value, ...extra });

const codesRaised = new Set();
/** The code the read of `root` refuses with; the read returns nothing. */
function refusalOf(opts) {
  try {
    loadContractDir(opts);
  } catch (e) {
    assert.ok(e instanceof ContractRefusal, `a refusal, not ${e.message}`);
    codesRaised.add(e.code);
    return e.code;
  }
  assert.fail('the read was not refused');
}

test('the install writes omx-contract\'s data/ with its manifest: every file, its hash, the installed $schema', () => {
  const root = installed();
  const dir = pkgDir(root, 'omx-contract');
  const m = JSON.parse(readFileSync(join(dir, 'MANIFEST.json'), 'utf8'));
  assert.equal(m.package, 'omx-contract');
  assert.equal(m.version, VERSION);
  assert.equal(m.schemaMajor, 2);
  assert.equal(m.tree, 'data');
  const want = dataFiles(DATA).map((p) => p.slice(DATA.length + 1)).sort();
  assert.deepEqual(Object.keys(m.files).sort(), want);
  assert.ok(!want.includes('codes.json'), 'the reader\'s own codes are not installed');
  assert.equal(want.length, 7);
  for (const rel of want) {
    const bytes = readFileSync(join(dir, rel));
    assert.equal(m.files[rel], sha256(bytes), `${rel}: the manifest lists its hash`);
    const doc = JSON.parse(bytes);
    assert.equal(doc.$schema, URL2);
    const { $schema, ...items } = JSON.parse(readFileSync(join(DATA, rel), 'utf8'));
    const { $schema: s2, ...got } = doc;
    assert.deepEqual(got, items, `${rel}: only $schema differs`);
  }
});

test('read back through the reader, omx-contract renders c, ts and json byte for byte as data/ and the goldens', () => {
  const root = installed();
  const fromDir = loadContractDir({ dir: root });
  const fromData = loadData(DATA);
  assert.deepEqual(fromDir.files.map((f) => f.rel), fromData.files.map((f) => f.rel), 'the files read in the order of data/');
  assert.deepEqual([...fromDir.items.keys()], [...fromData.items.keys()]);
  assert.equal(fromDir.items.size, 79);
  const a = resolveData(fromDir);
  const b = resolveData(fromData);
  for (const [render, dir] of [[renderC, 'include'], [renderTs, 'test/golden/ts']]) {
    const x = render(a);
    assert.deepEqual(x, render(b));
    for (const f of x) assert.equal(f.text, readFileSync(join(ROOT, dir, f.path), 'utf8'), `${dir}/${f.path}`);
  }
  const json = renderJson(a, contractVersion(fromDir, 'none'));
  assert.equal(contractVersion(fromDir, 'none'), VERSION, 'the json render carries the manifest\'s version');
  assert.equal(json[0].text, readFileSync(join(ROOT, 'share/omx-contract/omx-contract.json'), 'utf8'));
  for (const target of ['c', 'json', 'ts']) {
    const out = { c: 'include', json: 'share/omx-contract', ts: 'test/golden/ts' }[target];
    assert.equal(main(['render', '--target', target, '--out', join(ROOT, out), '--check', '--contract-dir', root]), 0, target);
  }
  assert.equal(main(['validate', '--contract-dir', root]), 0);
  assert.equal(main(['fmt', '--check', '--contract-dir', root]), 0);
});

test('a perturbed installed value moves every render: the reader reads the directory, not data/', () => {
  const root = installed();
  const p = join(pkgDir(root, 'omx-contract'), 'rates.json');
  const doc = JSON.parse(readFileSync(p, 'utf8'));
  doc.RT_HARD_TARGET.value.rate = 176400;
  writeFileSync(p, `${JSON.stringify(doc, null, 2)}\n`);
  rehash(root, 'omx-contract');
  const r = resolveData(loadContractDir({ dir: root }));
  assert.equal(r.get('RT_HARD_TARGET').value.rate, 176400);
  assert.equal(main(['render', '--target', 'c', '--out', join(ROOT, 'include'), '--check', '--contract-dir', root]), 1);
  assert.equal(main(['render', '--target', 'ts', '--out', join(ROOT, 'test/golden/ts'), '--check', '--contract-dir', root]), 1);
  assert.equal(main(['render', '--target', 'json', '--out', join(ROOT, 'share/omx-contract'), '--check', '--contract-dir', root]), 1);
});

test('discovery: --contract-dir, else OMX_CONTRACT_PATH (first directory wins a package), else pkg-config', () => {
  const a = installed();
  const b = installed();
  addPackage(b, 'omx-contract', { 'rates.json': readFileSync(join(pkgDir(b, 'omx-contract'), 'rates.json'), 'utf8') }, '9.9.9');
  assert.deepEqual(contractRoots({ dir: a }), [a]);
  assert.deepEqual(contractRoots({ env: { OMX_CONTRACT_PATH: `${a}::${b}` } }), [a, b]);
  assert.equal(loadContractDir({ env: { OMX_CONTRACT_PATH: `${a}:${b}` } }).packages.get('omx-contract').manifest.version, VERSION);
  assert.equal(loadContractDir({ env: { OMX_CONTRACT_PATH: `${b}:${a}` } }).packages.get('omx-contract').manifest.version, '9.9.9');
  const pc = join(SCRATCH, 'pkg-config');
  writeFileSync(pc, `#!/bin/sh\n[ "$1" = --variable=contractdir ] && [ "$2" = omx-contract ] && echo '${a}'\n`);
  chmodSync(pc, 0o755);
  assert.deepEqual(contractRoots({ env: {}, pkgConfig: pc }), [a]);
  assert.equal(loadContractDir({ env: {}, pkgConfig: pc }).items.size, 79);
});

test('contract.dir.absent: nothing names a directory, the one named is missing, or it holds no package of this major', () => {
  assert.equal(refusalOf({ env: {}, pkgConfig: join(SCRATCH, 'no-such-pkg-config') }), CONTRACT_CODES.dirAbsent);
  assert.equal(refusalOf({ dir: join(SCRATCH, 'missing') }), CONTRACT_CODES.dirAbsent);
  const root = join(SCRATCH, 'other-major');
  mkdirSync(join(root, '3', 'omx-contract'), { recursive: true });
  assert.equal(refusalOf({ dir: root }), CONTRACT_CODES.dirAbsent);
});

test('contract.manifest.absent and contract.manifest.invalid', () => {
  let root = installed();
  rmSync(join(pkgDir(root, 'omx-contract'), 'MANIFEST.json'));
  assert.equal(refusalOf({ dir: root }), CONTRACT_CODES.manifestAbsent);
  for (const edit of [
    (m) => { m.package = 'omx-dsp'; },
    (m) => { m.schemaMajor = 3; },
    (m) => { m.version = '2.14'; },
    (m) => { m.extra = true; },
    (m) => { m.tree = '../data'; },
    (m) => { m.files['../x.json'] = m.files['rates.json']; },
    (m) => { m.files['rates.json'] = 'abc'; },
  ]) {
    root = installed();
    rehash(root, 'omx-contract', edit);
    assert.equal(refusalOf({ dir: root }), CONTRACT_CODES.manifestInvalid, edit.toString());
  }
  root = installed();
  writeFileSync(join(pkgDir(root, 'omx-contract'), 'MANIFEST.json'), '{ not json');
  assert.equal(refusalOf({ dir: root }), CONTRACT_CODES.manifestInvalid);
});

test('contract.manifest.mismatch: an unlisted file, a listed file missing, a hash that differs', () => {
  let root = installed();
  writeFileSync(join(pkgDir(root, 'omx-contract'), 'stray.json'), '{}\n');
  assert.equal(refusalOf({ dir: root }), CONTRACT_CODES.manifestMismatch);
  root = installed();
  rmSync(join(pkgDir(root, 'omx-contract'), 'curves.json'));
  assert.equal(refusalOf({ dir: root }), CONTRACT_CODES.manifestMismatch);
  root = installed();
  const p = join(pkgDir(root, 'omx-contract'), 'rates.json');
  const text = readFileSync(p, 'utf8');
  assert.ok(text.includes('"rate": 192000'));
  writeFileSync(p, text.replace('"rate": 192000', '"rate": 176400'));
  assert.equal(refusalOf({ dir: root }), CONTRACT_CODES.manifestMismatch, 'an edit after install is caught by its hash');
});

test('contract.schema.major, contract.schema.too-old and contract.schema.floor-absent', () => {
  let root = installed();
  addPackage(root, 'omx-dsp', { 'x.json': { ...owned({ TEST_A: scalar(1) }), $schema: installedSchemaUrl(3) } });
  assert.equal(refusalOf({ dir: root }), CONTRACT_CODES.schemaMajor);
  root = installed();
  addPackage(root, 'omx-dsp', { 'x.json': { ...owned({ TEST_A: scalar(1) }), $schema: '../schema/omx-contract.schema.json' } });
  assert.equal(refusalOf({ dir: root }), CONTRACT_CODES.schemaMajor, 'the relative $schema of data/ is not an installed form');
  root = installed();
  addPackage(root, 'omx-dsp', { 'x.json': owned({ TEST_A: scalar(1) }, { 'omx-contract-schema': '>= 2.99.0' }) });
  assert.equal(refusalOf({ dir: root }), CONTRACT_CODES.schemaTooOld);
  root = installed();
  addPackage(root, 'omx-dsp', { 'x.json': owned({ TEST_A: scalar(1) }, { 'omx-contract-schema': `>= ${SCHEMA_VERSION}` }) });
  assert.equal(loadContractDir({ dir: root }).items.get('TEST_A').pkg, 'omx-dsp', 'the floor at the reader\'s own schema is read');
  root = installed();
  addPackage(root, 'omx-dsp', { 'x.json': { $schema: URL2, TEST_A: scalar(1) } });
  assert.equal(refusalOf({ dir: root }), CONTRACT_CODES.schemaFloorAbsent);
  root = installed();
  addPackage(root, 'omx-dsp', { 'x.json': owned({ TEST_A: scalar(1) }, { 'omx-contract-schema': '2.15.0' }) });
  assert.equal(refusalOf({ dir: root }), CONTRACT_CODES.fileInvalid, 'a floor is written >= x.y.z');
});

test('contract.file.not-json and contract.file.invalid', () => {
  let root = installed();
  addPackage(root, 'omx-dsp', { 'x.json': '{ "TEST_A": ' });
  assert.equal(refusalOf({ dir: root }), CONTRACT_CODES.fileNotJson);
  for (const items of [{ TEST_A: scalar(1, { unit: 'decibel' }) }, { TEST_A: scalar(1, { colour: 'red' }) }, { lower: scalar(1) }]) {
    root = installed();
    addPackage(root, 'omx-dsp', { 'x.json': owned(items) });
    assert.equal(refusalOf({ dir: root }), CONTRACT_CODES.fileInvalid, JSON.stringify(items));
  }
  root = installed();
  addPackage(root, 'omx-dsp', { 'kernels/k.json': { ...owned({}), controls: [{ name: 'a', kind: 'travel', doc: 'a', travel: { min: 0, max: 1, unit: '' } }], extra: {} } });
  assert.equal(refusalOf({ dir: root }), CONTRACT_CODES.fileInvalid, 'an unknown top-level key of a kernel file');
});

test('contract.item.duplicate: two packages declare one name', () => {
  const root = installed();
  addPackage(root, 'omx-dsp', { 'x.json': owned({ RT_HARD_TARGET: scalar(1) }) });
  assert.equal(refusalOf({ dir: root }), CONTRACT_CODES.itemDuplicate);
});

test('contract.kernel.duplicate: two packages each install a file of one kernel, even with names of their own', () => {
  const root = installed();
  addPackage(root, 'openmixer', { 'kernels/hrp.json': { ...owned({}), controls: [{ name: 'consoleOnly', kind: 'travel', doc: 'a console row', travel: { min: 0, max: 1, unit: '' } }] } });
  assert.equal(refusalOf({ dir: root }), CONTRACT_CODES.kernelDuplicate);
  const other = installed();
  addPackage(other, 'openmixer', { 'kernels/console_hrp.json': { ...owned({}), controls: [{ name: 'consoleOnly', kind: 'travel', doc: 'a console row', travel: { min: 0, max: 1, unit: '' } }] } });
  assert.ok(loadContractDir({ dir: other }).items.has('CONSOLE_HRP_CONSOLE_ONLY_RANGE'), 'a kernel of its own is read');
});

test('contract.ref.unresolved and contract.ref.undeclared, and a reference its requires names is read', () => {
  let root = installed();
  addPackage(root, 'omx-dsp', { 'x.json': owned({ TEST_A: scalar({ ref: 'NO_SUCH_ITEM' }) }) });
  assert.equal(refusalOf({ dir: root }), CONTRACT_CODES.refUnresolved);
  // omx-plugins refers to an omx-dsp item: refused unless its requires names omx-dsp
  root = installed();
  addPackage(root, 'omx-dsp', { 'x.json': owned({ TEST_A: scalar(3) }) }, '0.21.0');
  addPackage(root, 'omx-plugins', { 'y.json': owned({ TEST_B: scalar({ ref: 'TEST_A' }) }) });
  assert.equal(refusalOf({ dir: root }), CONTRACT_CODES.refUndeclared);
  root = installed();
  addPackage(root, 'omx-dsp', { 'x.json': owned({ TEST_A: scalar(3) }) }, '0.21.0');
  addPackage(root, 'omx-plugins', { 'y.json': owned({ TEST_B: scalar({ ref: 'TEST_A' }), TEST_C: scalar({ ref: 'RT_HARD_TARGET.rate' }) }, { 'omx-dsp': '>= 0.21.0' }) });
  const r = resolveData(loadContractDir({ dir: root }));
  assert.equal(r.get('TEST_B').value, 3);
  assert.equal(r.get('TEST_C').value, 192000, 'an item of omx-contract needs no requires');
});

test('contract.package.absent and contract.package.too-old, from a file\'s requires and from the consumer\'s needs', () => {
  let root = installed();
  addPackage(root, 'omx-plugins', { 'y.json': owned({ TEST_B: scalar(1) }, { 'omx-dsp': '>= 0.21.0' }) });
  assert.equal(refusalOf({ dir: root }), CONTRACT_CODES.packageAbsent);
  root = installed();
  addPackage(root, 'omx-dsp', { 'x.json': owned({ TEST_A: scalar(3) }) }, '0.20.9');
  addPackage(root, 'omx-plugins', { 'y.json': owned({ TEST_B: scalar(1) }, { 'omx-dsp': '>= 0.21.0' }) });
  assert.equal(refusalOf({ dir: root }), CONTRACT_CODES.packageTooOld);
  root = installed();
  assert.equal(refusalOf({ dir: root, needs: { 'omx-dsp': '>= 0.21.0' } }), CONTRACT_CODES.packageAbsent);
  assert.equal(refusalOf({ dir: root, needs: { 'omx-contract': '>= 99.0.0' } }), CONTRACT_CODES.packageTooOld);
  assert.equal(loadContractDir({ dir: root, needs: { 'omx-contract': `>= ${VERSION}` } }).items.size, 79);
});

test('a refusal stops the whole read: the CLI prints the code first, as JSON with --json, and renders nothing', () => {
  const root = installed();
  addPackage(root, 'omx-dsp', { 'x.json': owned({ RT_HARD_TARGET: scalar(1) }) });
  const out = join(SCRATCH, 'render-out');
  const r = spawnSync(process.execPath, [join(ROOT, 'bin/omx-contract.mjs'), 'render', '--target', 'c', '--out', out, '--contract-dir', root, '--json'], { encoding: 'utf8' });
  assert.equal(r.status, 1);
  assert.equal(JSON.parse(r.stdout).code, 'contract.item.duplicate');
  assert.match(r.stderr, /^contract\.item\.duplicate /);
  assert.equal(existsSync(out), false, 'no partial render');
  const u = spawnSync(process.execPath, [join(ROOT, 'bin/omx-contract.mjs'), 'fmt', '--contract-dir', root], { encoding: 'utf8' });
  assert.equal(u.status, 2, 'fmt never writes an installed directory');
});

test('the schema words: requires is a map of floors, source a closed object of links; both validate in data/ too', () => {
  const probs = (doc, rel = 'data/x.json') => [...new Set(fileProblems({ rel, text: '', doc }).map((p) => `${p.item}:${p.rule}`))];
  const base = { $schema: '../schema/omx-contract.schema.json' };
  const link = 'include/omxdsp/omx_eq_design.h#OMX_EQ_LOWPASS_HANDOVER_Q_PEAK';
  assert.deepEqual(probs({ ...base, requires: { 'omx-contract-schema': '>= 2.15.0', 'omx-dsp': '>= 0.21.0' }, source: { impl: link }, A: scalar(1, { source: { from: link, impl: [link, 'src/a.c#omx_a_plan'] } }) }), []);
  assert.deepEqual(probs({ ...base, A: scalar(1, { source: { from: { max: link }, impl: link, at: 'openmixer@6ee8a9b' } }) }), []);
  assert.deepEqual(probs({ ...base, A: scalar(1, { source: { impl: 'include/omxdsp/omx_eq_design.h#enum omx_eq_kind' } }) }), []);
  assert.deepEqual(probs({ ...base, A: scalar(1, { source: { impl: 'src/x.h#omx_hrp_family_search[guitar].maxVoices' } }) }), []);
  assert.deepEqual(probs({ ...base, requires: { 'omx-contract-schema': '<= 2.15.0' } }), ['requires:schema']);
  assert.deepEqual(probs({ ...base, requires: {} }), ['requires:schema']);
  assert.deepEqual(probs({ ...base, source: { impl: 'no-hash-here' } }), ['source:schema']);
  assert.deepEqual(probs({ ...base, source: { impl: link, extra: 1 } }), ['source:schema']);
  assert.deepEqual(probs({ ...base, A: scalar(1, { source: { from: link } }) }).length > 0, false, 'from alone is a source');
  assert.deepEqual(probs({ ...base, A: scalar(1, { source: { at: 'not a package' } }) }), ['A:schema']);
  const kernel = { $schema: '../../schema/omx-contract.schema.json', requires: { 'omx-contract-schema': '>= 2.15.0' }, source: { impl: link },
    controls: [{ name: 'a', kind: 'travel', source: { impl: link }, doc: 'a', travel: { min: 0, max: 1, unit: '' } },
      { name: 'b', kind: 'travel', table: 'K_T', source: { impl: link }, travel: { min: 0, max: 1, unit: '' } }], tables: { K_T: { doc: 't' } } };
  assert.deepEqual(probs(kernel, 'data/kernels/k.json'), ['-:shape'], 'a table field carries no source of its own');
  delete kernel.controls[1].source;
  assert.deepEqual(probs(kernel, 'data/kernels/k.json'), []);
  assert.equal(loadData(null, { 'data/x.json': JSON.stringify({ ...base, requires: { 'omx-contract-schema': '>= 2.15.0' }, source: { impl: link }, A: scalar(1) }) }).items.size, 1, 'requires and source declare no item');
});

test('the schema states its version; its major is the package\'s and the directory\'s', () => {
  assert.match(SCHEMA_VERSION, /^\d+\.\d+\.\d+$/);
  assert.equal(SCHEMA_MAJOR, Number(VERSION.split('.')[0]));
  assert.equal(SCHEMA_MAJOR, 2);
  const makefile = spawnSync('make', ['-s', '-C', ROOT, '-pn', 'all'], { encoding: 'utf8' }).stdout;
  assert.match(makefile, /^SCHEMA_MAJOR := 2$/m, 'the Makefile installs under the schema\'s major');
  assert.match(readFileSync(join(ROOT, 'omx-contract.pc.in'), 'utf8'), /^contractdir=@CONTRACTDIR@$/m);
});

test('the codes are data: data/codes.json holds every code once, valid and in the one formatting, and no render carries them', () => {
  const doc = JSON.parse(readFileSync(join(DATA, 'codes.json'), 'utf8'));
  assert.deepEqual(fileProblems({ rel: 'data/codes.json', text: '', doc }), []);
  const codes = Object.values(CONTRACT_CODES);
  assert.equal(new Set(codes).size, codes.length);
  assert.ok(codes.every((c) => /^contract\.[a-z]+\.[a-z-]+$/.test(c)));
  assert.equal(loadData(DATA).items.has('CONTRACT_CODES'), false);
  assert.ok(!readFileSync(join(ROOT, 'include/omxcontract/omx_contract_limits.h'), 'utf8').includes('contract.dir.absent'));
});

test('a scanned plugin descriptor is no declaration: contract.origin.misplaced, the whole read', () => {
  const root = installed();
  const scanned = JSON.parse(readFileSync(join(ROOT, 'test/fixtures/descriptors/scanned-clap-unknown.json'), 'utf8'));
  addPackage(root, 'omx-plugins', { 'plugins/a.json': owned({ TEST_A: scalar(1) }), 'plugins/b.json': scanned });
  assert.equal(refusalOf({ dir: root }), CONTRACT_CODES.originMisplaced);
});

// The links codes are raised in test/links.test.mjs and the descriptor codes in test/descriptor.test.mjs; every
// other reader code must have its arm here.
test('every reader refusal code was raised by an arm above (a code with no arm is a column with no reader)', () => {
  const reader = Object.entries(CONTRACT_CODES).filter(([k]) => !k.startsWith('source') && !k.startsWith('descriptor')).map(([, c]) => c);
  assert.deepEqual(reader.filter((c) => !codesRaised.has(c)), []);
  assert.ok(codesRaised.size >= 14);
});
