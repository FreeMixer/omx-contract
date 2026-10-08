// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
// THE default EQ rule has three spellings (lib/eq-defaults.mjs, the ts render, the c render); they agree
// for every count, and the rule gives the answers the operator ruled (2026-10-08).
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { eqDefaultBands, eqDefaultCentres, eqDefaultParams, eqDefaultTypes } from '../lib/eq-defaults.mjs';
import { renderC } from '../render/c.mjs';
import { renderTs } from '../render/ts.mjs';
import { ROOT, editData, resolvedOf, scratchData, texts } from './helpers.mjs';
import { loadData, resolveData } from '../lib/data.mjs';

const resolved = resolvedOf(texts());
const params = eqDefaultParams(resolved);
const COUNTS = Array.from({ length: 40 }, (_, i) => i + 1);
const centres = (n) => { try { return eqDefaultCentres(n, params); } catch { return undefined; } };

test('four bands start at 100, 400, 2000 and 8000 Hz: a low shelf, two bells, a high shelf, flat, Q 1', () => {
  assert.deepEqual(eqDefaultBands(4, params), [
    { type: 'lowShelf', freqHz: 100, gainDb: 0, q: 1 },
    { type: 'bell', freqHz: 400, gainDb: 0, q: 1 },
    { type: 'bell', freqHz: 2000, gainDb: 0, q: 1 },
    { type: 'highShelf', freqHz: 8000, gainDb: 0, q: 1 },
  ]);
});

test('N bands: log-even across the band frequency range on the ISO 266 R10 series, R20 where R10 is too coarse, never a repeat', () => {
  for (const n of COUNTS) {
    const c = centres(n);
    if (n === 4) continue;
    if (n > 61) { assert.equal(c, undefined); continue; }
    assert.ok(c, `${n} bands have centres`);
    assert.equal(c.length, n);
    assert.ok(c.every((f, i) => f >= 20 && f <= 20000 && (i === 0 || f > c[i - 1])), `${n}: ascending, distinct, in range`);
  }
  assert.deepEqual(centres(8), [31.5, 80, 160, 400, 1000, 2500, 5000, 12500]);
  assert.ok(centres(16).every((f) => params.series[0].includes(f)), 'sixteen bands sit on R10');
  assert.ok(centres(32).some((f) => !params.series[0].includes(f)), 'thirty-two bands need the R20 refinement');
  assert.throws(() => eqDefaultCentres(62, params), /no distinct preferred centres/);
  assert.throws(() => eqDefaultCentres(0, params), /not a band count/);
  assert.deepEqual(eqDefaultTypes(1), ['bell']);
  assert.deepEqual(eqDefaultTypes(2), ['lowShelf', 'highShelf']);
  assert.deepEqual(eqDefaultTypes(5), ['lowShelf', 'bell', 'bell', 'bell', 'highShelf']);
});

test('the ts render runs the same rule', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'omx-eq-ts-'));
  for (const f of renderTs(resolved)) writeFileSync(join(dir, f.path), f.text);
  const mod = await import(pathToFileURL(join(dir, 'omx-contract.js')).href);
  for (const n of COUNTS) {
    const c = centres(n);
    if (c === undefined) { assert.throws(() => mod.eqDefaultCentres(n), RangeError); continue; }
    assert.deepEqual(mod.eqDefaultCentres(n), c, `${n} bands`);
    assert.deepEqual(mod.eqDefaultTypes(n), eqDefaultTypes(n));
    assert.deepEqual(mod.eqDefaultBands(n), eqDefaultBands(n, params));
  }
});

const cc = (process.env.CC ?? 'cc').split(' ');
const haveCc = spawnSync(cc[0], [...cc.slice(1), '--version']).status === 0;

test('the c render runs the same rule', { skip: !haveCc && 'no cc' }, () => {
  const dir = mkdtempSync(join(tmpdir(), 'omx-eq-c-'));
  const inc = join(dir, 'include');
  for (const f of renderC(resolved)) { spawnSync('mkdir', ['-p', join(inc, f.path, '..')]); writeFileSync(join(inc, f.path), f.text); }
  const src = join(dir, 't.c');
  writeFileSync(src, `#include <stdio.h>
#include <omxcontract/omx_contract_limits.h>
int main(void) {
  float out[70];
  for (unsigned n = 1; n <= 40; n++) {
    const unsigned r = omx_eq_default_centres(n, out);
    printf("%u", n);
    if (!r) { puts(" none"); continue; }
    for (unsigned i = 0; i < n; i++) {
      const int t = omx_eq_default_type(i, n);
      printf(" %s:%.9g", t == OMX_EQ_BAND_TYPES_LOW_SHELF ? "lowShelf" : t == OMX_EQ_BAND_TYPES_HIGH_SHELF ? "highShelf" : "bell", (double)out[i]);
    }
    puts("");
  }
  return 0;
}
`);
  const build = spawnSync(cc[0], [...cc.slice(1), '-std=c11', '-Wall', '-Wextra', '-Werror', '-I', inc, src, '-o', join(dir, 't'), '-lm'], { encoding: 'utf8' });
  assert.equal(build.status, 0, build.stderr);
  const lines = spawnSync(join(dir, 't'), { encoding: 'utf8' }).stdout.trim().split('\n');
  for (const n of COUNTS) {
    const c = centres(n);
    const got = lines[n - 1].split(' ');
    assert.equal(got[0], String(n));
    if (c === undefined) { assert.equal(got[1], 'none', `${n} bands`); continue; }
    const types = eqDefaultTypes(n);
    assert.deepEqual(got.slice(1).map((x) => x.split(':')[0]), types, `${n} bands: types`);
    assert.deepEqual(got.slice(1).map((x) => Math.fround(Number(x.split(":")[1]))), c.map(Math.fround), `${n} bands: centres`);
  }
});

test('perturbation: move the four-band set, the series or the range and the rule follows in every spelling', () => {
  const dir = scratchData();
  editData(dir, 'kernels/eq.json', (d) => { d.EQ_DEFAULT_CENTRES_FOUR_BAND_HZ.values = [125, 500, 2000, 8000]; });
  const r = resolveData(loadData(dir));
  assert.deepEqual(eqDefaultCentres(4, eqDefaultParams(r)), [125, 500, 2000, 8000]);
  const ts = renderTs(r)[0].text;
  assert.match(ts, /"four": \[\n {4}125,\n {4}500,/);
  const moved = scratchData();
  editData(moved, 'kernels/eq.json', (d) => { d.EQ_BAND_COUNTS.value.eq8.default = 6; d.EQ_BAND_DEFAULTS.value.q = 0.7; });
  const m = eqDefaultParams(resolveData(loadData(moved)));
  assert.equal(m.q, 0.7);
  assert.equal(eqDefaultBands(6, m)[2].q, 0.7);
  assert.equal(resolveData(loadData(moved)).get('EQ_BAND_COUNTS').value.eq8.default, 6);
  assert.match(renderC(resolveData(loadData(moved)))[0].text, /^#define OMX_EQ_BAND_COUNTS_EQ8_DEFAULT 6$/m);
});

test('the render is for this tree', () => assert.ok(ROOT));
