// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
// A red arm for each rule validate raises on a travel (#91): travel-order (min above max), step (below zero) and finite
// (a bound, step or default that does not resolve to a finite number). Each arm names the rule, and a clean travel
// raises none, so removing a rule from lib/validate.mjs turns its arm red.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadData } from '../lib/data.mjs';
import { validateData } from '../lib/validate.mjs';

const RULES = ['travel-order', 'step', 'finite'];
const check = (items) => validateData(loadData(null, { 'data/x.json': JSON.stringify({ $schema: '../schema/omx-contract.schema.json', ...items }) }))
  .filter((p) => RULES.includes(p.rule)).map((p) => `${p.rule}: ${p.message}`);
const single = (travel) => ({ T: { kind: 'travels', doc: 'a travel', travel: { unit: '', ...travel } } });
const table = (fields) => ({ T: { kind: 'travels', doc: 'a table', fields } });
const LIST = { L: { kind: 'list', doc: 'a list', unit: '', values: [1, 2] } };

test('a travel whose bounds are ordered, whose step is not negative and whose numbers are finite raises none of the three rules', () => {
  assert.deepEqual(check(single({ min: -1, max: 1, step: 0, default: 0 })), []);
  assert.deepEqual(check(table({ a: { min: 0, max: 0 }, b: { min: 1, max: 5, step: 0.5 } })), []);
});

test('travel-order: min above max is named, in a single travel and in a field of a table', () => {
  assert.deepEqual(check(single({ min: 2, max: 1 })), ['travel-order: T: min 2 > max 1']);
  assert.deepEqual(check(table({ ok: { min: 0, max: 1 }, bad: { min: 5, max: 4 } })), ['travel-order: T.bad: min 5 > max 4']);
});

test('step: a negative step is named, zero is the continuous travel and passes', () => {
  assert.deepEqual(check(single({ min: 0, max: 1, step: -0.5 })), ['step: T: step -0.5 < 0']);
  assert.deepEqual(check(table({ f: { min: 0, max: 1, step: -1 } })), ['step: T.f: step -1 < 0']);
  assert.deepEqual(check(single({ min: 0, max: 1, step: 0 })), []);
});

test('finite: a min, max, step or default that resolves to anything but a finite number is named', () => {
  for (const k of ['min', 'max', 'step', 'default']) {
    const t = { min: 0, max: 1, step: 0.5, default: 0.5, [k]: { ref: 'L' } };
    assert.ok(check({ ...LIST, ...single(t) }).some((m) => m.startsWith('finite:') && m.endsWith(`${k} resolves to [1,2]`)), k);
  }
});
