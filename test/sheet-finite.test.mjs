// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
// Every leaf of every sheet resolves to a finite number (lib/validate.mjs): one rule over every sheet, naming no item.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadData } from '../lib/data.mjs';
import { validateData } from '../lib/validate.mjs';
import { DATA } from './helpers.mjs';

const scalar = (value) => ({ kind: 'scalar', doc: 'a scalar', unit: '', value });
const sheet = (value) => ({ kind: 'sheet', doc: 'a sheet', value });
const finite = (items) => validateData(loadData(null, { 'data/x.json': JSON.stringify({ $schema: '../schema/omx-contract.schema.json', ...items }) }))
  .filter((p) => p.rule === 'finite').map((p) => `${p.item}: ${p.message}`);

test('a sheet whose leaves all resolve to finite numbers passes, nested and by reference', () => {
  assert.deepEqual(finite({ N: scalar(3), ANY_SHEET: sheet({ a: 1, b: { ref: 'N' }, c: { d: -2.5, e: { derive: 'sqrt', of: 4 } } }) }), []);
});

test('a leaf that resolves to anything but a finite number is refused, wherever it sits and whatever the sheet is named', () => {
  const items = { L: { kind: 'list', doc: 'a list', unit: '', values: [1, 2] }, B: scalar(true), S: { kind: 'set', doc: 'a set', ids: ['x', 'y'] } };
  assert.deepEqual(finite({ ...items, SOME_TABLE: sheet({ a: 1, b: { ref: 'L' } }) }), ['SOME_TABLE: SOME_TABLE.b resolves to [1,2]']);
  assert.deepEqual(finite({ ...items, OTHER: sheet({ deep: { er: { ref: 'B' } } }) }), ['OTHER: OTHER.deep.er resolves to true']);
  assert.deepEqual(finite({ ...items, THIRD: sheet({ ids: { ref: 'S' } }) }), ['THIRD: THIRD.ids resolves to ["x","y"]']);
});

test('the data holds the rule today', () => {
  assert.deepEqual(validateData(loadData(DATA)).filter((p) => p.rule === 'finite'), []);
});
