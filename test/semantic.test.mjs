// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { lagrangeReadL1, loadData } from '../lib/data.mjs';
import { validateData } from '../lib/validate.mjs';
import { relOf, resolvedOf, texts } from './helpers.mjs';

const problems = (t) => validateData(loadData(null, t));
const has = (t, item, rule) => problems(t).some((p) => p.item === item && p.rule === rule);

test('a default outside its travel is refused, by item and field', () => {
  const t = texts((d, at) => { at('data/kernels/swell.json', 'SWELL_LIMITS.ratio').default = 41; });
  assert.ok(has(t, 'SWELL_LIMITS', 'default-inside'));
  assert.match(problems(t)[0].message, /SWELL_LIMITS\.ratio: default 41 outside \[1, 40\]/);
});

test('a byKind default outside its travel is refused', () => {
  assert.ok(has(texts((d, at) => { at('data/kernels/echo.json', 'ECHO_MIX_RANGE').travel.byKind.send = 2; }), 'ECHO_MIX_RANGE', 'default-inside'));
});

test('a reference that does not resolve is refused', () => {
  assert.ok(has(texts((d) => { d[relOf('TOOL_SPLIT')].TOOL_SPLIT.value.highQ = { ref: 'TOOL_QQ' }; }), 'TOOL_SPLIT', 'reference'));
});

test('a reference cycle is refused', () => {
  const t = texts((d) => {
    d[relOf('TOOL_Q')].TOOL_Q.value = { ref: 'TOOL_SPLIT.highQ' };
  });
  assert.ok(problems(t).some((p) => p.rule === 'reference' && /cycle/.test(p.message)));
});

test('a c.alias is refused by the schema (3.0.0 removed the word)', () => {
  assert.ok(has(texts((d, at) => { at('data/kernels/echo.json', 'ECHO_TIME_RANGE').c = { alias: { fact: 'echo', field: 'timeMs' } }; }), 'ECHO_TIME_RANGE', 'schema'));
});

test('two items rendering one C name are refused', () => {
  const t = texts((d) => { d['data/kernels/contour.json'].constants.TOOL_SPLIT_LOW = { kind: 'sheet', doc: 'collides', value: { q: 1 } }; });
  assert.ok(problems(t).some((p) => p.rule === 'render-c' && /OMX_TOOL_SPLIT_LOW_Q/.test(p.message)));
});

test('the derivations evaluate: a square root, the references to it, the read norm and a count', () => {
  const r = resolvedOf(texts());
  assert.equal(r.get('TOOL_Q').value, 0.6);
  assert.equal(r.get('TOOL_SPLIT').value.highQ, 0.6);
  assert.equal(r.get('CONTOUR_SHELF').value.q, 0.6);
  assert.equal(r.get('TOOL_READ_L1').value, lagrangeReadL1(2));
  assert.equal(lagrangeReadL1(2), 1.25);
  assert.equal(lagrangeReadL1(1), 1);
  assert.equal(r.get('CONTOUR_CENTRE_COUNT').value, r.get('CONTOUR_CENTRES_HZ').value.length);
});

test('a reference follows its target: move TOOL_Q and both readers move', () => {
  const r = resolvedOf(texts((d) => { d[relOf('TOOL_Q')].TOOL_Q.value = { derive: 'sqrt', of: 0.49 }; }));
  assert.equal(r.get('TOOL_SPLIT').value.highQ, 0.7);
  assert.equal(r.get('CONTOUR_SHELF').value.q, 0.7);
});
