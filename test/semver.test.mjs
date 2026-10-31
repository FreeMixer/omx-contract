// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { main } from '../bin/omx-contract.mjs';
import { DEVELOPMENT_PHASE, bumpOf, classify, classifySchema, refusal } from '../lib/semver.mjs';
import { DATA, ROOT, dropDecl, editData, relOf, resolvedOf, scratchData, texts } from './helpers.mjs';

const base = resolvedOf(texts());
const level = (fn) => classify(base, resolvedOf(texts(fn))).level;

test('no change is none', () => assert.equal(classify(base, base).level, 'none'));
test('doc text is PATCH', () => assert.equal(level((d) => { d['data/rates.json'].RT_HARD_TARGET.doc = 'reworded'; }), 'patch'));
test('a default moved inside its travel is MINOR', () => assert.equal(level((d, at) => { at('data/kernels/gate.json', 'GATE_LIMITS.ratio').default = 10; }), 'minor'));
test('a travel widened is MINOR', () => assert.equal(level((d, at) => { at('data/kernels/gate.json', 'GATE_LIMITS.ratio').max = 200; }), 'minor'));
test('a travel narrowed is MAJOR', () => assert.equal(level((d, at) => { at('data/kernels/gate.json', 'GATE_LIMITS.ratio').max = 50; }), 'major'));
test('a unit changed is MAJOR', () => assert.equal(level((d, at) => { at('data/kernels/gate.json', 'GATE_LIMITS.ratio').unit = '%'; }), 'major'));
test('a kernel constant changed is MAJOR', () => assert.equal(level((d, at) => { at('data/kernels/transient.json', 'TRANSIENT_REF_DB').value = 7; }), 'major'));
test('a derived constant changed is MAJOR', () => assert.equal(level((d) => { d[relOf('FDELAY_MOD_READ_ORDER')].FDELAY_MOD_READ_ORDER.value = 5; }), 'major'));
test('an item added is MINOR, removed is MINOR in the development phase and MAJOR after it', () => {
  assert.equal(level((d) => { d['data/rates.json'].NEW_RATE = { kind: 'scalar', doc: 'new', unit: 'Hz', value: 1 }; }), 'minor');
  const gone = texts((d) => { dropDecl('data/kernels/chorus.json', d['data/kernels/chorus.json'], 'CHORUS_SPREAD_RANGE'); });
  const r = classify(resolvedOf(texts()), resolvedOf(gone));
  assert.equal(r.level, 'minor');
  assert.ok(r.changes[0].what.includes(`development phase: every consumer is ${DEVELOPMENT_PHASE.consumers.join(', ')}`), r.changes[0].what);
  assert.equal(classify(resolvedOf(texts()), resolvedOf(gone), { developmentPhase: null }).level, 'major');
});
test('a list member appended is MINOR, changed is MAJOR', () => {
  assert.equal(level((d) => { d['data/rates.json'].STANDARD_SAMPLE_RATES.values.push(384000); }), 'minor');
  assert.equal(level((d) => { d['data/rates.json'].STANDARD_SAMPLE_RATES.values[0] = 32000; }), 'major');
});
test('the bump must cover the class', () => {
  assert.equal(bumpOf('1.0.0', '1.1.0'), 'minor');
  assert.equal(refusal('minor', '1.0.0', '1.0.1'), 'the changes since 1.0.0 are MINOR, and 1.0.0 -> 1.0.1 is a patch bump');
  assert.equal(refusal('major', 'v1.2.3', '2.0.0'), null);
  assert.match(refusal('patch', '1.2.0', '1.1.0'), /lower/);
});

test('the CLI refuses a short bump and passes a sufficient one; a MAJOR class takes a minor in the development phase', () => {
  const dir = scratchData();
  editData(dir, 'kernels/gate.json', (d, at) => { at('GATE_LIMITS.ratio').max = 50; });
  assert.equal(main(['semver', '--from-dir', DATA, '--from-version', '1.0.0', '--data', dir, '--version', '1.0.1']), 1);
  assert.equal(main(['semver', '--from-dir', DATA, '--from-version', '1.0.0', '--data', dir, '--version', '1.1.0']), 0);
  assert.equal(main(['semver', '--from-dir', DATA, '--from-version', '1.0.0', '--data', dir, '--version', '2.0.0']), 0);
});

test('a set\'s values added is MINOR, a value changed or the values removed is MAJOR (#29)', () => {
  const withValues = (s) => { s.values = [null, 4]; s.unit = 'x'; };
  const valued = resolvedOf(texts((d, at) => withValues(at('data/kernels/comp.json', 'COMP_KINDS'))));
  assert.equal(classify(base, valued).level, 'minor');
  assert.equal(classify(valued, base).level, 'major');
  const moved = resolvedOf(texts((d, at) => { const s = at('data/kernels/comp.json', 'COMP_KINDS'); withValues(s); s.values[1] = 8; }));
  assert.equal(classify(valued, moved).level, 'major');
  assert.deepEqual(classify(valued, moved).changes.map((c) => c.what), ['COMP_KINDS: the value of limiter: 4 -> 8 (a constant a kernel computes with)']);
});

test('refusal: a MAJOR class needs a minor bump in the development phase and a major bump after it', () => {
  assert.equal(refusal('major', '2.10.0', '2.11.0'), null);
  assert.match(refusal('major', '2.10.0', '2.10.1'), /MAJOR, and 2\.10\.0 -> 2\.10\.1 is a patch bump \(at least a minor in the development phase\)/);
  assert.equal(refusal('major', '2.10.0', '2.11.0', { developmentPhase: null }), 'the changes since 2.10.0 are MAJOR, and 2.10.0 -> 2.11.0 is a minor bump');
  assert.equal(refusal('major', '2.10.0', '3.0.0', { developmentPhase: null }), null);
});

test('a set id that changes type is visible in the change message (#29)', () => {
  // the roll-off set as 2.10.1 declared it: numeric ids, no values
  const numeric = resolvedOf(texts((d, at) => { const s = at('data/kernels/drive.json', 'DRIVE_HF_ROLLOFFS'); s.ids = [0, 12000, 16000]; s.default = 0; delete s.values; delete s.unit; }));
  const what = classify(numeric, base).changes.filter((c) => c.item === 'DRIVE_HF_ROLLOFFS').map((c) => c.what);
  assert.ok(what.includes('DRIVE_HF_ROLLOFFS[1]: 12000 -> "12000"'), what.join('\n'));
  assert.ok(what.includes('DRIVE_HF_ROLLOFFS[0]: 0 -> "off"'));
});

// Every repository whose main reads a name the contract renders (a header define, a TypeScript export or the json
// render) is a consumer the development-phase rule speaks for: omx-clap-core's host tests and plugin-qualify's
// declarations read the C header and the rates as omx-dsp and omx-plugins do (FreeMixer/omx-contract#108).
test('the development phase names every FreeMixer repository that reads the contract', () => {
  assert.deepEqual([...DEVELOPMENT_PHASE.consumers].sort(), ['omx-clap-core', 'omx-dsp', 'omx-plugins', 'openmixer', 'plugin-qualify']);
});

// ---- the schema is classified too (#92)

const SCHEMA = JSON.parse(readFileSync(join(ROOT, 'schema/omx-contract.schema.json'), 'utf8'));
const schemaLevel = (fn) => { const next = structuredClone(SCHEMA); fn(next); return classifySchema(SCHEMA, next); };

test('schema: no change is none, a description is patch, the schema version is no change', () => {
  assert.equal(classifySchema(SCHEMA, SCHEMA).level, 'none');
  assert.equal(schemaLevel((n) => { n['x-omx-schema-version'] = '9.9.9'; }).level, 'none');
  assert.equal(schemaLevel((n) => { n.$defs.render.description = 'reworded'; }).level, 'patch');
});

test('schema: a property or an enum member added is minor; a property or an enum member removed, a constraint added or changed is major', () => {
  assert.equal(schemaLevel((n) => { n.$defs.renderHeader.properties.extra = { type: 'string' }; }).level, 'minor');
  assert.equal(schemaLevel((n) => { n.$defs.renderHeader.properties.scope.enum.push('tree'); }).level, 'minor');
  const gone = schemaLevel((n) => { delete n.$defs.renderHeader.properties.guard; });
  assert.equal(gone.level, 'major');
  assert.match(gone.changes[0].what, /renderHeader\.properties\.guard removed/);
  assert.equal(schemaLevel((n) => { n.$defs.renderHeader.properties.scope.enum.pop(); }).level, 'major');
  assert.equal(schemaLevel((n) => { n.$defs.renderHeader.properties.guard.pattern = '^X$'; }).level, 'major');
  assert.equal(schemaLevel((n) => { n.$defs.renderHeader.required.push('includes'); }).level, 'major');
  assert.equal(schemaLevel((n) => { n.$defs.renderHeader.required.pop(); }).level, 'minor');
});

test('the CLI against a tag reads the schema too, and --report names the level without refusing the bump', () => {
  const git = spawnSync('git', ['-C', ROOT, 'rev-parse', '--verify', 'v3.5.1^{commit}']);
  if (git.status !== 0) return;   // no tags in this checkout
  assert.equal(main(['semver', 'v3.5.1', '--report', '--version', '3.5.1']), 0);
  const dir = scratchData();
  editData(dir, 'kernels/gate.json', (d, at) => { at('GATE_LIMITS.ratio').max = 50; });
  assert.equal(main(['semver', '--from-dir', DATA, '--from-version', '1.0.0', '--data', dir, '--version', '1.0.1', '--report']), 0);
  assert.equal(main(['semver', '--from-dir', DATA, '--from-version', '1.0.0', '--data', dir, '--version', '1.0.1']), 1);
});
