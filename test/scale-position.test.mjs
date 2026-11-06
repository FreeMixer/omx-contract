// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
// The position law of each scale word (docs/scale-position.md, spec 7.12): scalePosition and scaleValue held to the
// golden vectors of data/scale-vectors.json both ways within one ulp, each law once wrong red, the log floor.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { applyOverride } from '../lib/descriptor.mjs';
import { scalePosition, scaleValue } from '../lib/scale.mjs';
import { ROOT } from './helpers.mjs';

const VECTORS = JSON.parse(readFileSync(join(ROOT, 'data/scale-vectors.json'), 'utf8'));
const ULP = VECTORS.ulp;

/** Within one ulp: relative to the expected, absolute where it is zero. */
const near = (got, want) => Math.abs(got - want) <= ULP * Math.max(Math.abs(want), 1e-300) || got === want;
const OWN = { scalePosition, scaleValue };

/** Every row of every law, both ways, through `fns`; the mismatches as strings. */
function misses(fns) {
  const out = [];
  for (const [law, { travel, rows }] of Object.entries(VECTORS.laws)) {
    for (const row of rows) {
      const { value, p } = row;
      const gotP = fns.scalePosition(travel, value);
      const gotV = fns.scaleValue(travel, p);
      const wantV = row.valueAtP ?? value;
      if (!near(gotP, p)) out.push(`${law}: position of ${value} is ${gotP}, not ${p}`);
      if (!near(gotV, wantV)) out.push(`${law}: value at ${p} is ${gotV}, not ${wantV}`);
    }
  }
  return out;
}

test('the vectors: each law has the ends, the middle and three interior points', () => {
  assert.deepEqual(Object.keys(VECTORS.laws), ['linear', 'log', 'stepped', 'map']);
  for (const [law, { rows }] of Object.entries(VECTORS.laws)) {
    assert.equal(rows.length, law === 'log' ? 7 : 6, `${law}: six rows, and the 1 kHz row beside the log ones`);
    const ps = rows.map((r) => r.p);
    assert.ok(ps.includes(0) && ps.includes(1) && ps.some((p) => p === 0.5), `${law}: ends and middle`);
  }
});

test('the vectors pass both ways within one ulp', () => {
  assert.deepEqual(misses(OWN), []);
});

test('20 Hz to 20 kHz puts 1 kHz at 0.5663', () => {
  const travel = { scale: 'log', min: 20, max: 20000 };
  assert.equal(scalePosition(travel, 1000).toFixed(4), '0.5663');
  assert.ok(Math.abs(scaleValue(travel, 0.5663233347786729) - 1000) < 1e-12, 'the rounded p gives 1 kHz back to 1e-12');
  const row = VECTORS.laws.log.rows.find((r) => r.value === 1000);
  assert.ok(row && row.p.toFixed(4) === '0.5663', 'the 1 kHz row is in the vectors');
});

test('sabotage: a log10(1 + 9p) law on the 1 kHz row goes red', () => {
  const wrong = {
    scalePosition: (t, v) => (t.scale === 'log' && v === 1000 ? Math.log10(1 + 9 * ((v - t.min) / (t.max - t.min))) : scalePosition(t, v)),
    scaleValue: (t, p) => scaleValue(t, p),
  };
  const bad = misses(wrong);
  assert.equal(bad.length, 1);
  assert.match(bad[0], /^log: position of 1000/);
});

// each law once wrong: the formula another word would have given, on that word's rows only
const WRONG = {
  linear: { scalePosition: (t, v) => v / t.max, scaleValue: (t, p) => p * t.max },
  log: { scalePosition: (t, v) => (v - t.min) / (t.max - t.min), scaleValue: (t, p) => t.min + p * (t.max - t.min) },
  // the index over the number of steps, not over the steps less one
  stepped: { scalePosition: (t, v) => Math.round((v - t.min) / t.step) / (Math.round((t.max - t.min) / t.step) + 1), scaleValue: (t, p) => t.min + Math.round(p * (Math.round((t.max - t.min) / t.step) + 1)) * t.step },
  map: {
    scalePosition: (t, v) => (v - t.points[0][1]) / (t.points.at(-1)[1] - t.points[0][1]),
    scaleValue: (t, p) => t.points[0][1] + p * (t.points.at(-1)[1] - t.points[0][1]),
  },
};

for (const law of Object.keys(WRONG)) {
  test(`sabotage: the ${law} law once wrong goes red, the other laws stay green`, () => {
    const on = (name) => (t, x) => (t.scale === law ? WRONG[law][name](t, x) : OWN[name](t, x));
    const bad = misses({ scalePosition: on('scalePosition'), scaleValue: on('scaleValue') });
    assert.ok(bad.length > 0, 'the wrong law is caught');
    assert.ok(bad.every((m) => m.startsWith(`${law}:`)), `only the ${law} rows go red: ${bad.join('; ')}`);
  });
}

test('a value outside the travel is not clamped; the ends are exact', () => {
  const t = { scale: 'log', min: 20, max: 20000 };
  assert.equal(scalePosition(t, 20), 0);
  assert.equal(scalePosition(t, 20000), 1);
  assert.equal(scaleValue(t, 0), 20);
  assert.equal(scaleValue(t, 1), 20000);
  assert.ok(scalePosition({ scale: 'linear', min: 0, max: 10 }, 12) > 1);
});

test('stepped: a value between steps lands on the nearest step; a step is an index over the steps', () => {
  const t = { scale: 'stepped', min: 10, max: 90, step: 10 };
  assert.equal(scalePosition(t, 37), 3 / 8);
  assert.equal(scaleValue(t, 0.45), 50);
  assert.equal(scaleValue(t, 2), 90, 'beyond the last step the last step');
});

test('refused: a stepped travel without a step, an unknown word, a travel that does not run upward', () => {
  assert.throws(() => scalePosition({ scale: 'stepped', min: 0, max: 8 }, 1), RangeError);
  assert.throws(() => scalePosition({ scale: 'wobble', min: 0, max: 8 }, 1), RangeError);
  assert.throws(() => scalePosition({ scale: 'linear', min: 8, max: 8 }, 8), RangeError);
  assert.throws(() => scaleValue({ scale: 'map', points: [[0, 0]] }, 0.5), RangeError);
});

test('the log floor: the validator drops the entry, a consumer serving the scan serves it linear', () => {
  const descriptor = JSON.parse(readFileSync(join(ROOT, 'examples/descriptors/scanned-clap-unknown.json'), 'utf8'));
  descriptor.controls[1].travel.min = 0;
  const file = JSON.parse(readFileSync(join(ROOT, 'test/fixtures/overrides/good.json'), 'utf8'));
  file.controls = { 5: { travel: { scale: 'log' }, basis: 'person' } };
  // outcome 1: the validator drops the entry
  const r = applyOverride(descriptor, [file], { paramsFingerprint: '5f0c' });
  assert.deepEqual(r.dropped.map((d) => d.name), ['overrideScaleFloor']);
  // outcome 2: the consumer serves the travel linear: the position of a log scale over a floor of zero is the linear one
  const t = { scale: 'log', min: 0, max: 1000 };
  assert.equal(scalePosition(t, 250), 0.25);
  assert.equal(scaleValue(t, 0.25), 250);
  assert.equal(scalePosition({ scale: 'log', min: -5, max: 5 }, 0), 0.5);
  // and a positive floor is the log law, so the fallback is the floor's, not the word's
  assert.notEqual(scalePosition({ scale: 'log', min: 1, max: 1000 }, 250), 0.25);
});

test('the library is exported and the vectors are installed beside omx-contract.json, not in the contract directory', async () => {
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
  assert.equal(pkg.exports['./scale'].import, './lib/scale.mjs');
  assert.equal(pkg.exports['./scale-vectors.json'], './data/scale-vectors.json');
  const lib = await import('@openmixer/omx-contract/scale').catch(() => import('../lib/scale.mjs'));
  assert.equal(typeof lib.scalePosition, 'function');
  const dest = mkdtempSync(join(tmpdir(), 'omx-scale-'));
  try {
    execFileSync('make', ['install', `DESTDIR=${dest}`, 'PREFIX=/usr'], { cwd: ROOT, stdio: 'ignore' });
    assert.deepEqual(JSON.parse(readFileSync(join(dest, 'usr/share/omx-contract/scale-vectors.json'), 'utf8')), VECTORS);
    assert.ok(!existsSync(join(dest, 'usr/share/omx-contract/contract.d/3/omx-contract/scale-vectors.json')), 'not a declaration');
  } finally { rmSync(dest, { recursive: true, force: true }); }
});
