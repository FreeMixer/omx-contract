// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
// The kernel recipe: the completeness check over the tree and each of its arms sabotaged, and the
// wizard's importer and declare step over a small engine checkout made here.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { ROOT, completeness, kernelNames, loadRecipe } from '../tools/kernel-recipe.mjs';
import { asData, commitPlan, declare, defineValue, importKernel, verifyAnswers } from '../tools/omx-new-kernel.mjs';
import { addedAfterFirstRelease } from '../tools/proof/round-trip.mjs';

/** A scratch copy of everything the recipe's checkers read. */
function scratchTree() {
  const dir = mkdtempSync(join(tmpdir(), 'omx-kernel-recipe-'));
  for (const p of ['data', 'schema', 'recipes', 'include', 'share', 'test/golden', 'package.json']) {
    cpSync(join(ROOT, p), join(dir, p), { recursive: true });
  }
  return dir;
}
const edit = (root, rel, fn) => {
  const p = join(root, rel);
  const doc = JSON.parse(readFileSync(p, 'utf8'));
  fn(doc);
  writeFileSync(p, `${JSON.stringify(doc, null, 2)}\n`);
};
const gapsOf = (root) => completeness(root).gaps.join('\n');

test('every kernel of the tree, the released ones included, has every artifact of the recipe', () => {
  const v = completeness(ROOT);
  assert.deepEqual(v.gaps, []);
  assert.ok(kernelNames(ROOT).length >= 10, 'the check runs over the kernels it finds');
});

test('a kernel without its answers is a gap naming the import step', () => {
  const root = scratchTree();
  rmSync(join(root, 'recipes/answers/gate.json'));
  assert.match(gapsOf(root), /gate: artifact answers \(wizard step 'import'\): recipes\/answers\/gate\.json is missing/);
});

test('a kernel value moved away from its engine source is a gap naming both', () => {
  const root = scratchTree();
  edit(root, 'data/kernels/delay.json', (d) => { d.FX_DELAY_TIME_RANGE.travel.max = 2001; });
  assert.match(gapsOf(root), /delay: artifact value-citations .*FX_DELAY_TIME_RANGE resolves to .*"max":2001.*strip-fx-limits\.ts FX_DELAY_TIME_RANGE is .*"max":2000/);
});

test('an item the answers do not cite, and an answer the kernel does not declare, are gaps', () => {
  const root = scratchTree();
  edit(root, 'recipes/answers/transient.json', (a) => { a.items = a.items.filter((i) => i.name !== 'TRANSIENT_REF_DB'); a.items.push({ ...a.items[0], name: 'TRANSIENT_GHOST' }); });
  const g = gapsOf(root);
  assert.match(g, /TRANSIENT_REF_DB has no citation/);
  assert.match(g, /TRANSIENT_GHOST is answered but not in the kernel file/);
});

test('a stale render is a gap naming the render command', () => {
  const root = scratchTree();
  writeFileSync(join(root, 'share/omx-contract/omx-contract.json'), '{}\n');
  assert.match(gapsOf(root), /share\/omx-contract\/omx-contract\.json is stale \(omx-contract render --target json/);
});

test('a hand-formatted kernel file is a gap', () => {
  const root = scratchTree();
  const p = join(root, 'data/kernels/chorus.json');
  writeFileSync(p, JSON.stringify(JSON.parse(readFileSync(p, 'utf8'))));
  assert.match(gapsOf(root), /chorus: artifact kernel-file .*not in the one formatting/);
});

test('a unit or c block that differs between the kernel file and the answers is a gap', () => {
  const root = scratchTree();
  edit(root, 'recipes/answers/transient.json', (a) => { a.items.find((i) => i.name === 'TRANSIENT_FAST_ATTACK_MS').unit = 's'; });
  edit(root, 'recipes/answers/delay.json', (a) => { delete a.items.find((i) => i.name === 'FX_DELAY_TIME_RANGE').c; });
  const g = gapsOf(root);
  assert.match(g, /TRANSIENT_FAST_ATTACK_MS: unit "ms" in the kernel file, "s" in the answers/);
  assert.match(g, /FX_DELAY_TIME_RANGE: c .* in the kernel file, undefined in the answers/);
});

test('an item the engine does not declare is cited by an origin sentence, and a set\'s default and labels are held to the answers', () => {
  const root = scratchTree();
  assert.deepEqual(completeness(root, ['tremolo']).gaps, [], 'TREMOLO_MODES is cited by origin');
  edit(root, 'recipes/answers/tremolo.json', (a) => { a.items.find((i) => i.name === 'TREMOLO_MODES').default = 'pan'; });
  assert.match(gapsOf(root), /TREMOLO_MODES: default or labels differ between the kernel file and the answers/);
  edit(root, 'recipes/answers/tremolo.json', (a) => { a.items.find((i) => i.name === 'TREMOLO_MODES').default = 'tremolo'; a.items.find((i) => i.name === 'TREMOLO_MODES').source = { origin: '' }; });
  assert.match(gapsOf(root), /an origin source is the one non-empty sentence/);
  edit(root, 'recipes/answers/tremolo.json', (a) => { a.items.find((i) => i.name === 'TREMOLO_MODES').source = { origin: 'x', path: 'y' }; });
  assert.match(gapsOf(root), /an origin source is the one non-empty sentence/);
});

test('a value JSON cannot carry unchanged is refused, not recorded', () => {
  assert.throws(() => asData('X', { min: -Infinity, max: 0 }), /X\.min: -Infinity is not a finite number/);
  assert.throws(() => asData('Y', () => 1), /Y: a function is not data/);
  assert.throws(() => asData('Z', { a: undefined }), /Z\.a: a undefined is not data/);
  assert.deepEqual(asData('W', { a: [1, 0.5] }), { a: [1, 0.5] });
});

test('an entry added to the recipe is required of every kernel at once', () => {
  const root = scratchTree();
  edit(root, 'recipes/kernel.recipe.json', (r) => { r.artifacts.push({ ...r.artifacts[0], id: 'dsp', step: 'dsp', checker: { fn: 'dspKernel' } }); });
  const v = completeness(root);
  assert.equal(v.gaps.filter((g) => /artifact dsp \(wizard step 'dsp'\): the recipe names checker dspKernel/.test(g)).length, kernelNames(root).length);
});

test('a kernel file holding a plugin item breaks the own-items law', () => {
  const root = scratchTree();
  edit(root, 'data/kernels/chorus.json', (d) => { d.CHORUS_SPREAD_RANGE.kind = 'plugin'; });
  assert.match(gapsOf(root), /chorus: law own-items-only/);
});

test('a C define is read only when it is one plain number', () => {
  assert.equal(defineValue('#define OMX_X_MS 0.5f /* half */\n', 'OMX_X_MS'), 0.5);
  assert.equal(defineValue('#define OMX_N (12)\n', 'OMX_N'), 12);
  assert.throws(() => defineValue('#define OMX_CAP (OMX_RATE / 1000)\n', 'OMX_CAP'), /not one plain number/);
});

function engineCheckout() {
  const dir = mkdtempSync(join(tmpdir(), 'omx-engine-'));
  mkdirSync(join(dir, 'packages/core/src'), { recursive: true });
  mkdirSync(join(dir, 'packages/pipewire-native/src'), { recursive: true });
  writeFileSync(join(dir, 'packages/core/src/base.ts'), 'export const WOBBLE_BASE = { min: 0, max: 10, step: 0.5, unit: \'Hz\' as const };\n');
  writeFileSync(join(dir, 'packages/core/src/wobble.ts'), [
    "import { WOBBLE_BASE } from './base.js';",
    'type T = { min: number; max: number };',
    '/** The wobble rate: the base travel, coming up at 2 Hz. */',
    'export const WOBBLE_RATE_RANGE = { ...WOBBLE_BASE, default: 2, defaultFrom: \'desk\' } as const satisfies T;',
    '/** The wobble depth bound: the square root of a half. */',
    'export const WOBBLE_DEPTH_MAX = Math.sqrt(0.5);',
    'export const WOBBLE_UNDOCUMENTED = 3;',
    '/** The wobble\'s travels by field: each field IS its travel. */',
    'export const WOBBLE_TRAVELS = { rateHz: WOBBLE_RATE_RANGE } as const;',
    '',
  ].join('\n'));
  writeFileSync(join(dir, 'packages/pipewire-native/src/mix_wobble.h'), '/** The wobble ring, in samples. */\n#define WOBBLE_RING 4096u\n');
  const git = (...a) => execFileSync('git', ['-C', dir, ...a], { stdio: 'ignore' });
  git('init', '-q');
  git('add', '.');
  git('-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'commit.gpgsign=false', 'commit', '-q', '-m', 'engine');
  return dir;
}

test('the importer reads each value by evaluating the engine, cites it, and the wizard declares a complete kernel', async () => {
  const root = scratchTree();
  const engine = engineCheckout();
  const { answers } = await importKernel({
    kernel: 'wobble', since: '1.1.0', engine, ref: 'HEAD',
    names: 'WOBBLE_RATE_RANGE,WOBBLE_DEPTH_MAX,WOBBLE_RING,WOBBLE_TRAVELS',
    unit: ['WOBBLE_DEPTH_MAX=', 'WOBBLE_RING='], set: ['WOBBLE_DEPTH_MAX={"derive":"sqrt","of":0.5}'],
  }, root);
  assert.match(answers.engine.commit, /^[0-9a-f]{40}$/);
  assert.deepEqual(answers.items.map((i) => [i.name, i.source, i.value]), [
    ['WOBBLE_RATE_RANGE', { path: 'packages/core/src/wobble.ts', export: 'WOBBLE_RATE_RANGE' }, { min: 0, max: 10, step: 0.5, unit: 'Hz', default: 2, defaultFrom: 'desk' }],
    ['WOBBLE_DEPTH_MAX', { path: 'packages/core/src/wobble.ts', export: 'WOBBLE_DEPTH_MAX' }, Math.sqrt(0.5)],
    ['WOBBLE_RING', { path: 'packages/pipewire-native/src/mix_wobble.h', define: 'WOBBLE_RING' }, 4096],
    ['WOBBLE_TRAVELS', { path: 'packages/core/src/wobble.ts', export: 'WOBBLE_TRAVELS' }, { rateHz: { min: 0, max: 10, step: 0.5, unit: 'Hz', default: 2, defaultFrom: 'desk' } }],
  ]);
  assert.deepEqual(answers.items[3].set, { rateHz: { ref: 'WOBBLE_RATE_RANGE' } }, 'a field that IS another item refers to it');
  assert.equal(answers.items[0].doc, 'The wobble rate: the base travel, coming up at 2 Hz.');

  const { written } = declare(join(root, 'recipes/answers/wobble.json'), root);
  assert.ok(written.includes('data/kernels/wobble.json'));
  const k = JSON.parse(readFileSync(join(root, 'data/kernels/wobble.json'), 'utf8'));
  assert.deepEqual(k.WOBBLE_DEPTH_MAX.value, { derive: 'sqrt', of: 0.5 }, 'a derivation is declared as one, its value proven equal');
  assert.deepEqual(k.WOBBLE_TRAVELS.fields, { rateHz: { ref: 'WOBBLE_RATE_RANGE' } }, 'the travel is typed once');
  assert.deepEqual(completeness(root, ['wobble']).gaps, []);
  assert.deepEqual(completeness(root).gaps, [], 'the released kernels stay complete');

  assert.deepEqual(await verifyAnswers(answers, engine, root), [], 'the answers read again at their commit');
  const tampered = { ...answers, items: answers.items.map((i) => (i.name === 'WOBBLE_RING' ? { ...i, value: 4097 } : i)) };
  assert.deepEqual(await verifyAnswers(tampered, engine, root), ['WOBBLE_RING: the answers hold 4097, packages/pipewire-native/src/mix_wobble.h gives 4096']);

  const { plan, stray } = commitPlan(loadRecipe(root), ['recipes/answers/wobble.json', ...written], { kernel: 'wobble', repo: 'r', commit12: 'c' });
  assert.deepEqual(plan.map((c) => c.layer), ['answers', 'data', 'render']);
  assert.deepEqual(stray, []);
});

test('items added to a released kernel carry their own since and are appended to its file', async () => {
  const root = scratchTree();
  const engine = engineCheckout();
  const base = { kernel: 'wobble', engine, ref: 'HEAD' };
  await importKernel({ ...base, since: '1.8.0', names: 'WOBBLE_RATE_RANGE' }, root);
  declare(join(root, 'recipes/answers/wobble.json'), root);
  const before = readFileSync(join(root, 'data/kernels/wobble.json'), 'utf8');

  const { answers } = await importKernel({ ...base, since: '1.9.0', names: 'WOBBLE_RATE_RANGE,WOBBLE_RING', unit: ['WOBBLE_RING='] }, root);
  assert.equal(answers.since, '1.8.0', 'the kernel keeps the release that first carried it');
  assert.deepEqual(answers.items.map((i) => [i.name, i.since]), [['WOBBLE_RATE_RANGE', undefined], ['WOBBLE_RING', '1.9.0']]);
  assert.ok(addedAfterFirstRelease(root).has('WOBBLE_RING'), 'the proof reads the item\'s own since');

  const { written } = declare(join(root, 'recipes/answers/wobble.json'), root);
  assert.ok(written.includes('data/kernels/wobble.json'));
  const k = JSON.parse(readFileSync(join(root, 'data/kernels/wobble.json'), 'utf8'));
  assert.deepEqual(Object.keys(k), ['$schema', 'WOBBLE_RATE_RANGE', 'WOBBLE_RING'], 'appended after the released items');
  assert.deepEqual(k.WOBBLE_RATE_RANGE, JSON.parse(before).WOBBLE_RATE_RANGE, 'a released item is kept as written');
  assert.deepEqual(completeness(root, ['wobble']).gaps, []);

  edit(root, 'recipes/answers/wobble.json', (a) => { a.items[1].since = '1.8.0'; });
  assert.match(completeness(root, ['wobble']).gaps.join('\n'), /WOBBLE_RING: since 1\.8\.0 is not later than the kernel's 1\.8\.0; leave it out/);
});

test('the importer refuses what it cannot read, naming the item', async () => {
  const root = scratchTree();
  const engine = engineCheckout();
  const base = { kernel: 'wobble', since: '1.1.0', engine, ref: 'HEAD' };
  await assert.rejects(importKernel({ ...base, names: 'WOBBLE_NOWHERE' }, root), /WOBBLE_NOWHERE: the engine declares no export const or #define/);
  await assert.rejects(importKernel({ ...base, names: 'WOBBLE_UNDOCUMENTED', unit: ['WOBBLE_UNDOCUMENTED='] }, root), /WOBBLE_UNDOCUMENTED: .* has no doc comment/);
  await assert.rejects(importKernel({ ...base, names: 'WOBBLE_DEPTH_MAX' }, root), /WOBBLE_DEPTH_MAX: a scalar carries a unit the engine does not declare/);
  await assert.rejects(importKernel({ ...base, names: 'WOBBLE_RING', from: ['WOBBLE_RING=packages/pipewire-native/src/mix_wobble.h'] }, root), /--from WOBBLE_RING=.*: give <path>:<export or define>/);
});
