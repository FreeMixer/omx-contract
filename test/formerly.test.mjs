// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
/**
 * 3.0.0 removed both second-name mechanisms: a list's `formerly` (the renamed list's old macros, export and json
 * entry) and a travel's `c.alias` (a second C spelling of a fact's field). The schema refuses both words outright now
 * (additionalProperties false), and no committed render carries their traces. This file ratchets that: the schema
 * rejects either word wherever it used to be legal, and the renders of the union hold no leftover of either.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadData } from '../lib/data.mjs';
import { validateData } from '../lib/validate.mjs';
import { renderC } from '../render/c.mjs';
import { renderJson } from '../render/json.mjs';
import { resolvedOf, texts } from './helpers.mjs';

const problems = (t) => validateData(loadData(null, t));
const refusesSchema = (t, item) => problems(t).some((p) => p.item === item && p.rule === 'schema');

test('a list carrying formerly is refused by the schema', () => {
  assert.ok(refusesSchema(texts((d) => {
    d['data/rates.json'].ORACLE_FLOOR_RATES.formerly = { name: 'OLD_FLOOR_RATES', removedIn: '9.9.0' };
  }), 'ORACLE_FLOOR_RATES'));
});

test('a kernel control carrying c.alias on its travel is refused by the schema', () => {
  assert.ok(refusesSchema(texts((d, at) => {
    at('data/kernels/delay.json', 'FX_DELAY_TIME_RANGE').c = { alias: { fact: 'delay', field: 'timeMs' } };
  }), 'FX_DELAY_TIME_RANGE'));
  assert.ok(refusesSchema(texts((d, at) => {
    at('data/kernels/balance.json', 'PAN_RANGE').c = { alias: { fact: 'pan', field: 'pan' } };
  }), 'PAN_RANGE'));
});

test('the json render of the union has no formerNames', () => {
  assert.equal(JSON.parse(renderJson(resolvedOf(texts()), '0.0.0')[0].text).formerNames, undefined);
});

test('the c render of the union has no c.alias section, and none of the alias spellings it used to define', () => {
  const h = renderC(resolvedOf(texts()))[0].text;
  assert.doesNotMatch(h, /c\.alias/i);
  assert.doesNotMatch(h, /OMX_PAN_PAN_/);
  assert.doesNotMatch(h, /OMX_DELAY_TIME_MS_/);
  assert.doesNotMatch(h, /OMX_DRIVE_DRIVE_DB_/);
});
