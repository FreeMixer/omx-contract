// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
// The kernel-file shape (2.0.0): controls, tables, aggregates and constants. The loader expands it into the items
// the renders read, kernelDocOf writes it back, validation refuses anything else, fmt has one spelling of it.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { isDeepStrictEqual } from 'node:util';
import { entriesOf, isUse, kernelDocOf, loadData } from '../lib/data.mjs';
import { formatDoc } from '../lib/fmt.mjs';
import { validateData } from '../lib/validate.mjs';
import { DATA, ROOT, scratchData, texts } from './helpers.mjs';

const kernels = () => loadData(DATA).files.filter((f) => f.rel.startsWith('data/kernels/'));
const problems = (t) => validateData(loadData(null, t));

// The control facts the items do not carry, published in the json render's `kernels` and in no item: `rearms`
// (behaviour: changing the control re-arms the kernel's state), `count` (the item counting a per-band control), `of`
// and `when` (the travel another control reaches while a choice holds an id), and a use (a control taking the item
// another control declares), which adds no item. A control whose item a use shares (the EQ's hpfSlope, whose
// FILTER_SLOPES lpfSlope uses) is named after the item: no item says which of its controls declares it.
const withoutRearms = (body) => {
  const shared = new Set((body.controls ?? []).filter(isUse).map((c) => c.global));
  const named = (c) => (shared.has(c.global) ? { ...c, name: c.global.toLowerCase().replace(/_([a-z0-9])/g, (_, x) => x.toUpperCase()).replace(/s$/, '') } : c);
  return {
    ...body,
    ...(body.controls ? { controls: body.controls.filter((c) => !isUse(c)).map(({ rearms, count, of, when, ...c }) => named(c)) } : {}),
  };
};

test('every shipped kernel file is the kernel-file shape, and kernelDocOf writes each back exactly (the control facts no item carries aside)', () => {
  const files = kernels();
  assert.ok(files.length >= 20, `${files.length} kernel files: a short list proves nothing`);
  for (const f of files) {
    const { $schema, ...body } = f.doc;
    assert.deepEqual(Object.keys(body).filter((k) => !['controls', 'tables', 'aggregates', 'constants'].includes(k)), [], `${f.rel} holds only the four sections`);
    assert.deepEqual(kernelDocOf(f.rel, entriesOf(f.rel, f.doc)), withoutRearms(body), `${f.rel}: the items it expands to declare it again`);
  }
});

test('a flat item map restated by kernelDocOf expands to the same items (how semver reads a 1.x tag)', () => {
  for (const f of kernels()) {
    const items = entriesOf(f.rel, f.doc);
    const back = entriesOf(f.rel, kernelDocOf(f.rel, items));
    assert.ok(isDeepStrictEqual(new Map(back), new Map(items)), `${f.rel}: the restated file expands to its items`);
  }
});

test('a kernel file written as a flat item map is refused, naming the file and the four sections', () => {
  const t = texts((d) => {
    const f = d['data/kernels/chorus.json'];
    const { $schema } = f;
    d['data/kernels/chorus.json'] = { $schema, ...Object.fromEntries(entriesOf('data/kernels/chorus.json', f)) };
  });
  const p = problems(t).filter((x) => x.rule === 'shape');
  assert.deepEqual(p.map((x) => [x.file, x.message]), [['data/kernels/chorus.json', 'data/kernels/chorus.json is a flat item map (the 1.x shape): a kernel file declares its items under controls, tables, aggregates, constants']]);
  assert.equal(loadData(null, t).items.has('CHORUS_SPREAD_RANGE'), false, 'nothing reads a flat kernel file');
});

test('validate on a hand-written flat kernel file exits 1 and says to use the four sections', () => {
  const dir = scratchData();
  const p = join(dir, 'kernels/rta.json');
  const doc = JSON.parse(readFileSync(p, 'utf8'));
  writeFileSync(p, formatDoc({ $schema: doc.$schema, ...doc.constants }));
  const r = spawnSync(process.execPath, [join(ROOT, 'bin/omx-contract.mjs'), 'validate', '--data', dir], { encoding: 'utf8' });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /^data\/kernels\/rta\.json: -: shape: data\/kernels\/rta\.json is a flat item map \(the 1\.x shape\): a kernel file declares its items under controls, tables, aggregates, constants$/m);
});

test('a key beside the four sections, a constant that is a travel, an undeclared table and an aggregate of nothing are refused', () => {
  const shape = (fn) => problems(texts(fn)).filter((x) => x.rule === 'shape').map((x) => x.message).join('\n');
  assert.match(shape((d) => { d['data/kernels/gate.json'].GATE_LIMITS = { kind: 'scalar', doc: 'x', unit: '', value: 1 }; }), /unknown top-level key GATE_LIMITS: a kernel file holds controls, tables, aggregates, constants/);
  assert.match(shape((d) => { d['data/kernels/rta.json'].constants.RTA_X_RANGE = { kind: 'travels', doc: 'x', travel: { min: 0, max: 1 } }; }), /constant RTA_X_RANGE: kind "travels" is not scalar, list or sheet \(a travel or a set is a control\)/);
  assert.throws(() => loadData(null, texts((d) => { d['data/kernels/gate.json'].aggregates = { GATE_ALL: { doc: 'x', fields: ['nothing'] } }; })), /aggregate GATE_ALL names control nothing, which is not declared/);
  assert.throws(() => loadData(null, texts((d) => { d['data/kernels/gate.json'].controls[1].table = 'NO_TABLE'; })), /control thresholdDb names table NO_TABLE, which is not declared/);
});

test('kernelDocOf refuses a table that mixes references with travels, and an aggregate field not named by its control', () => {
  const travel = { min: 0, max: 1, step: 0, unit: '', default: 0, defaultFrom: 'desk' };
  const one = ['WOB_RATE_RANGE', { kind: 'travels', doc: 'r', travel }];
  assert.throws(() => kernelDocOf('data/kernels/wob.json', [one, ['WOB_T', { kind: 'travels', doc: 't', fields: { rate: { ref: 'WOB_RATE_RANGE' }, depth: travel } }]]), /WOB_T mixes fields that refer to single travels/);
  const kept = kernelDocOf('data/kernels/wob.json', [one]);
  assert.deepEqual(kept.controls.map((c) => c.name), ['rate'], 'the name derives from the global, which then is not written');
  assert.throws(() => kernelDocOf('data/kernels/wob.json', [['WOB_T', { kind: 'travels', doc: 't', fields: { speed: { ref: 'WOB_RATE_RANGE' } } }]], kept), /WOB_T\.speed refers to WOB_RATE_RANGE, whose control is named rate/);
});

test('fmt has one spelling of a kernel file: sections in order, a control\'s keys in schema order', () => {
  for (const f of kernels()) assert.equal(formatDoc(f.doc), f.text, `${f.rel} is in the one formatting`);
  const gate = kernels().find((f) => f.rel === 'data/kernels/gate.json');
  const { $schema, controls, ...rest } = gate.doc;
  const scrambled = { $schema, ...rest, controls: controls.map((c) => Object.fromEntries(Object.entries(c).reverse())) };
  assert.notEqual(JSON.stringify(scrambled, null, 2) + '\n', gate.text);
  assert.equal(formatDoc(scrambled), gate.text);
});
