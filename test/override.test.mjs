// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
// The override words, step O1 of the override module (docs/overrides.md, FreeMixer/omx-contract#105): the file's
// schema, applyOverride beside descriptorProblems, and one broken fixture per contract.override.* code.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { CONTRACT_CODES } from '../lib/codes.mjs';
import { PARAM_SCALE_IDS, applyOverride, overrideSchemaProblems } from '../lib/descriptor.mjs';
import { ROOT } from './helpers.mjs';

const read = (rel) => JSON.parse(readFileSync(join(ROOT, rel), 'utf8'));
const descriptor = () => read('test/fixtures/descriptors/scanned-clap-unknown.json');
const override = (name) => read(`test/fixtures/overrides/${name}.json`);
const FINGERPRINT = '5f0c';
const apply = (layers, d = descriptor()) => applyOverride(d, layers, { paramsFingerprint: FINGERPRINT });
const control = (r, id) => r.descriptor.controls.find((c) => String(c.id) === String(id));

test('a good override is applied: label, meaning, unit and scale filled, a narrower travel, the family', () => {
  const r = apply([override('good')]);
  assert.deepEqual([r.refused, r.dropped, r.warnings], [[], [], []]);
  assert.equal(r.family, 'filter');
  assert.deepEqual(r.answered, { 3: 0, 5: 0 });
  const c = control(r, 5);
  assert.deepEqual(c.travel, { min: 30, max: 18000, unit: 'Hz', default: 1000, scale: 'log' });
  assert.equal(c.label, 'Cutoff');
  assert.equal(c.meaning, 'cutoffFrequency');
  assert.equal(c.basis, 'person');
  assert.equal(c.corrected, undefined, 'a unit the plugin did not state is filled, not corrected');
  assert.equal(control(r, 3).meaning, 'shape');
  assert.deepEqual(descriptor().controls[1].travel.unit, 'unknown', 'the scanned descriptor is left as it was');
});

test('the schema: the override words, one major, a closed list of keys', () => {
  assert.deepEqual(overrideSchemaProblems(override('good')), []);
  assert.ok(overrideSchemaProblems(override('file-invalid')).some((p) => /override/.test(p.message)), 'another major is refused');
  const arms = [
    (d) => { d.verdict = 'good'; },
    (d) => { delete d.plugin; },
    (d) => { d.family = 'synth'; },
    (d) => { d.controls['5'].meaning = 'unknown'; },
    (d) => { d.controls['5'].meaning = 'on'; },
    (d) => { d.controls['5'].travel.unit = 'unknown'; },
    (d) => { d.controls['5'].travel.scale = 'exp'; },
    (d) => { delete d.controls['5'].basis; },
    (d) => { d.controls['5'].basis = 'guessed'; },
    (d) => { d.controls['5'].band = -1; },
    (d) => { d.controls['5'].hue = 3; },
    (d) => { d.controls['5'].evidence = { sha256: 'abc' }; },
    (d) => { d.controls['5'].map = { points: [[20, 20]], unit: 'Hz', scale: 'log' }; },
    (d) => { d.against = {}; },
  ];
  for (const [i, arm] of arms.entries()) {
    const d = override('good');
    arm(d);
    assert.ok(overrideSchemaProblems(d).length > 0, `arm ${i}`);
  }
  assert.deepEqual(read('schema/omx-contract.schema.json').$defs.override.properties.family.enum, ['none', 'gate', 'dynamics', 'limiter', 'deesser', 'eq', 'filter', 'drive', 'modulation', 'delay', 'reverb', 'pitch'].map((w) => w), 'the families are PANEL_FAMILIES');
  const panel = Object.values(read('data/panel.json').PANEL_FAMILIES.words).map((w) => w.word);
  assert.deepEqual(read('schema/omx-contract.schema.json').$defs.override.properties.family.enum, panel);
  assert.deepEqual(read('schema/omx-contract.schema.json').$defs.overrideTravel.properties.scale.enum, PARAM_SCALE_IDS);
});

/** One broken fixture per code: the file, the code it is refused with, and how (a dropped entry, a whole file, a warning). */
const ARMS = [
  ['overridePluginMismatch', 'plugin-mismatch', 'refused'],
  ['overrideControlAbsent', 'control-absent', 'dropped'],
  ['overrideWidens', 'widens', 'dropped'],
  ['overrideKindMismatch', 'kind-mismatch', 'dropped'],
  ['overrideScaleFloor', 'scale-floor', 'dropped'],
  ['overrideMapInvalid', 'map-invalid', 'dropped'],
  ['overrideBasisEvidence', 'basis-evidence', 'dropped'],
  ['overrideFingerprintDiffers', 'fingerprint-differs', 'warnings'],
  ['fileInvalid', 'file-invalid', 'refused'],
];

for (const [name, file, how] of ARMS) {
  test(`${CONTRACT_CODES[name]}: ${file}`, () => {
    const r = apply([override(file)]);
    const said = r[how];
    assert.deepEqual([...new Set(said.map((s) => s.code))], [CONTRACT_CODES[name]], JSON.stringify(r));
    assert.ok(said.every((s) => s.name === name));
    if (how === 'refused') {
      assert.deepEqual(r.answered, {}, 'a refused file answers no control');
      assert.deepEqual(r.descriptor, descriptor(), 'the plugin is drawn from its scan alone');
    }
    if (how === 'dropped') {
      assert.ok(!(said[0].control in r.answered), 'a dropped entry answers nothing');
      assert.ok(Object.keys(r.answered).length >= 0);
    }
    if (how === 'warnings') assert.deepEqual([r.dropped, r.refused], [[], []], 'a changed fingerprint drops nothing by itself');
    if (file === 'fingerprint-differs') assert.deepEqual(Object.keys(r.answered), ['3', '5'], 'the entries that still hold are applied');
  });
}

test('a dropped entry leaves the rest of the file standing', () => {
  const r = apply([override('widens')]);
  assert.deepEqual(r.answered, { 3: 0 });
  assert.equal(control(r, 3).meaning, 'shape');
  assert.equal(control(r, 5).travel.unit, 'unknown');
});

test('layers apply lowest first and the highest entry wins whole, family too', () => {
  const low = override('good');
  const high = override('good');
  high.family = 'eq';
  high.controls = { 5: { label: 'Freq', basis: 'starter' } };
  const r = apply([low, high]);
  assert.equal(r.family, 'eq');
  assert.deepEqual(r.answered, { 3: 0, 5: 1 });
  const c = control(r, 5);
  assert.equal(c.label, 'Freq');
  assert.equal(c.basis, 'starter');
  assert.equal(c.travel.unit, 'unknown', 'the lower layer\'s entry for that control is not merged in');
  assert.equal(apply([high, low]).family, 'filter', 'order decides');
});

test('a stated unit may be corrected, and the effective control says so', () => {
  const d = descriptor();
  d.controls[1].travel.unit = 'Hz';
  d.controls[1].travel.scale = 'linear';
  const o = override('good');
  o.controls = { 5: { travel: { unit: 'ms' }, basis: 'person' } };
  const r = apply([o], d);
  assert.deepEqual(r.dropped, []);
  assert.deepEqual(control(r, 5).corrected, ['unit']);
  assert.equal(control(r, 5).travel.unit, 'ms');
});

test('a band needs family eq and an EQ meaning', () => {
  const o = override('good');
  o.controls = { 5: { meaning: 'frequency', band: 0, basis: 'person' } };
  o.family = 'eq';
  assert.deepEqual(apply([o]).dropped, []);
  assert.equal(control(apply([o]), 5).band, 0);
  const noFamily = structuredClone(o);
  delete noFamily.family;
  assert.deepEqual(apply([noFamily]).dropped.map((d) => d.name), ['overrideKindMismatch']);
  const notEq = structuredClone(o);
  notEq.controls[5].meaning = 'delay';
  assert.deepEqual(apply([notEq]).dropped.map((d) => d.name), ['overrideKindMismatch']);
});

test('a map covers the plugin\'s ends, strictly monotonic; a measured entry carries its evidence', () => {
  const o = override('good');
  o.controls = { 5: { map: { points: [[20, 20], [1000, 900], [20000, 20000]], unit: 'Hz', scale: 'log' }, basis: 'measured', evidence: { sha256: 'a'.repeat(64) } } };
  const ok = apply([o]);
  assert.deepEqual([ok.dropped, ok.refused], [[], []]);
  assert.deepEqual(control(ok, 5).map.points[1], [1000, 900]);
  assert.deepEqual(control(ok, 5).evidence, { sha256: 'a'.repeat(64) });
  const short = structuredClone(o);
  short.controls[5].map.points = [[20, 20], [1000, 900]];
  assert.deepEqual(apply([short]).dropped.map((d) => d.name), ['overrideMapInvalid'], 'it stops short of the plugin\'s max');
  const falling = structuredClone(o);
  falling.controls[5].map.points = [[20, 20000], [1000, 900], [20000, 20]];
  assert.deepEqual(apply([falling]).dropped, [], 'a falling quantity is monotonic too');
  const evidence = structuredClone(o);
  evidence.controls[5].basis = 'person';
  assert.deepEqual(apply([evidence]).dropped.map((d) => d.name), ['overrideBasisEvidence'], 'evidence without measured');
});

test('the codes are registered, each with its name, and the override never touches the scan\'s fingerprint', () => {
  for (const [name] of ARMS.slice(0, 8)) assert.match(CONTRACT_CODES[name], /^contract\.override\./);
  assert.equal(Object.keys(CONTRACT_CODES).filter((k) => k.startsWith('override')).length, 8);
  assert.equal(apply([override('good')]).descriptor.paramsFingerprint, undefined);
});

test('a log scale over a travel whose floor is not positive is contract.override.scale-floor', () => {
  const d = descriptor();
  d.controls[1].travel.min = 0;
  const o = override('good');
  o.controls = { 5: { travel: { scale: 'log' }, basis: 'person' } };
  assert.deepEqual(apply([o], d).dropped.map((x) => x.name), ['overrideScaleFloor']);
  o.controls[5].travel.min = 20;
  assert.deepEqual(apply([o], d).dropped, [], 'a positive floor of the entry itself is fine');
});
