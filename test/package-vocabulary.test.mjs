// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
// render --package spells a package's vocabulary (its codes and words items of files with no render word) by kind,
// exactly as the whole read spells it (docs/render.md): omx-contract's is omx_vocabulary.h byte for byte, and a file
// of another package keeps its C names (a code by its code, never by its key) under that package's own guard.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { main } from '../bin/omx-contract.mjs';
import { SCHEMA_MAJOR } from '../lib/contract-dir.mjs';
import { packageVersion } from '../lib/data.mjs';
import { DATA, ROOT } from './helpers.mjs';

const SCRATCH = mkdtempSync(join(tmpdir(), 'omx-contract-vocabulary-'));
after(() => rmSync(SCRATCH, { recursive: true, force: true }));
let n = 0;
const COMMITTED = readFileSync(join(ROOT, 'include/omxcontract/omx_vocabulary.h'), 'utf8');

const quiet = (fn) => {
  const { log, error } = console;
  console.log = () => {};
  console.error = () => {};
  try { return fn(); } finally { console.log = log; console.error = error; }
};

const defines = (text) => text.split('\n').filter((l) => l.startsWith('#define OMX_') && !/_VOCABULARY_H$/.test(l));

test('render --package omx-contract is omx_vocabulary.h byte for byte, and its ts module exports every vocabulary item', async () => {
  const out = join(SCRATCH, `c-${n++}`);
  assert.equal(quiet(() => main(['render', '--target', 'c', '--package', 'omx-contract', '--out', out])), 0);
  assert.deepEqual(readdirSync(out), ['omx_param_units.h', 'omx_vocabulary.h']);
  assert.equal(readFileSync(join(out, 'omx_vocabulary.h'), 'utf8'), COMMITTED);
  assert.equal(quiet(() => main(['render', '--target', 'c', '--package', 'omx-contract', '--out', join(ROOT, 'include/omxcontract'), '--check'])), 0);
  const ts = join(SCRATCH, `ts-${n++}`);
  assert.equal(quiet(() => main(['render', '--target', 'ts', '--package', 'omx-contract', '--out', ts])), 0);
  assert.deepEqual(readdirSync(ts).sort(), ['omx-vocabulary.d.ts', 'omx-vocabulary.js']);
  const whole = await import(`file://${join(ROOT, 'test/golden/ts/omx-contract.js')}`);
  const mod = await import(`file://${join(ts, 'omx-vocabulary.js')}`);
  assert.ok(Object.keys(mod).length > 0);
  for (const [k, v] of Object.entries(mod)) assert.deepEqual(v, whole[k], `${k} as the whole ts module exports it`);
  assert.ok(Object.keys(mod).some((k) => k.endsWith('_WORDS')), 'positive control: a words item');
});

/**
 * A codes file as an owner holds it: omx-clap-core's hosting/cost.json, byte for byte as omx-contract carried it until
 * 3.0.0 moved the hosting codes to omx-clap-core (docs/hosting.md). Its key costSpiky differs from its code.
 */
const PACKAGE_CODES = join(ROOT, 'test/fixtures/package-codes');

/** A contract directory: omx-contract's data/, and package `pkg` holding the files of `dir`. */
function withPackage(pkg, dir) {
  const root = join(SCRATCH, `cd-${n++}`);
  const sh = (...a) => execFileSync('sh', [join(ROOT, 'tools/install-contract-dir.sh'), ...a], { stdio: 'ignore' });
  sh('-x', 'codes.json', 'omx-contract', packageVersion(ROOT), String(SCHEMA_MAJOR), DATA, root, 'data');
  sh(pkg, '0.13.0', String(SCHEMA_MAJOR), dir, root, 'data');
  return root;
}

test('a codes file of another package keeps its C names, under that package\'s own header and guard', () => {
  assert.ok(readdirSync(join(PACKAGE_CODES, 'hosting')).length > 0, 'positive control: the owner\'s codes file');
  const root = withPackage('acme-core', PACKAGE_CODES);
  const out = join(SCRATCH, `pkg-${n++}`);
  assert.equal(quiet(() => main(['render', '--target', 'c', '--contract-dir', root, '--package', 'acme-core', '--out', out])), 0);
  assert.deepEqual(readdirSync(out), ['acme_core_vocabulary.h']);
  const theirs = readFileSync(join(out, 'acme_core_vocabulary.h'), 'utf8');
  assert.match(theirs, /^#ifndef ACME_CORE_VOCABULARY_H$/m);
  assert.match(theirs, /^#endif \/\* ACME_CORE_VOCABULARY_H \*\/$/m);
  assert.match(theirs, /^#define OMX_HOSTING_COST_SPIKY_TAIL "hosting\.cost\.spiky-tail"$/m, 'a code by its code');
  assert.doesNotMatch(theirs, /^#define OMX_HOSTING_COST_SPIKY /m, 'never by its key');
  const mine = join(SCRATCH, `own-out-${n++}`);
  assert.equal(quiet(() => main(['render', '--target', 'c', '--contract-dir', root, '--package', 'omx-contract', '--out', mine])), 0);
  const own = readFileSync(join(mine, 'omx_vocabulary.h'), 'utf8');
  assert.equal(own, COMMITTED, 'omx-contract\'s own is the committed header, which holds no hosting code');
  assert.doesNotMatch(own, /OMX_HOSTING_/);
  const whole = join(SCRATCH, `whole-${n++}`);
  assert.equal(quiet(() => main(['render', '--target', 'c', '--contract-dir', root, '--out', whole])), 0);
  const all = readFileSync(join(whole, 'omxcontract/omx_vocabulary.h'), 'utf8');
  assert.deepEqual(defines(all).sort(), [...defines(own), ...defines(theirs)].sort(), 'the whole read\'s defines are the two packages\', each once');
});
