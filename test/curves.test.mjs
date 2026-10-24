// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
/**
 * The curve kinds (docs/curves.md): CURVE_KINDS names each picture a panel draws with its two axes, CURVE_AXES each
 * axis with its unit and scale. The words, their order and their axes are held as values, every render carries them,
 * and each validator rule over the axes has a red arm.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadData, resolveData } from '../lib/data.mjs';
import { validateData } from '../lib/validate.mjs';
import { renderC } from '../render/c.mjs';
import { renderJson } from '../render/json.mjs';
import { renderTs } from '../render/ts.mjs';
import { DATA, texts } from './helpers.mjs';

const C = 'data/curves.json';
const resolved = () => resolveData(loadData(DATA));
const problems = (t) => validateData(loadData(null, t));
const has = (t, item, rule) => problems(t).some((p) => p.item === item && p.rule === rule);

/** Every kind, in its declared order: word, x axis, y axis. */
const KINDS = [
  ['eq-curve', 'frequency', 'magnitude'],
  ['dynamics-curve', 'input-level', 'output-level'],
  ['transfer-curve', 'input-amplitude', 'output-amplitude'],
  ['delay-taps', 'delay-time', 'level'],
  ['decay-envelope', 'decay-time', 'level'],
  ['comb-response', 'frequency', 'magnitude'],
  ['modulation-shape', 'phase', 'modulation'],
  ['interval-map', 'input-pitch', 'output-pitch'],
];
/** Every axis, in its declared order: word, unit, scale. */
const AXES = [
  ['frequency', 'Hz', 'log'],
  ['magnitude', 'dB', 'linear'],
  ['input-level', 'dBFS', 'linear'],
  ['output-level', 'dBFS', 'linear'],
  ['input-amplitude', '', 'linear'],
  ['output-amplitude', '', 'linear'],
  ['delay-time', 'ms', 'linear'],
  ['decay-time', 's', 'linear'],
  ['level', 'dB', 'linear'],
  ['phase', '', 'linear'],
  ['modulation', '', 'linear'],
  ['input-pitch', 'st', 'linear'],
  ['output-pitch', 'st', 'linear'],
];

test('the curve kinds: each word and its two axes, in order', () => {
  const r = resolved().get('CURVE_KINDS');
  assert.equal(r.axes, 'CURVE_AXES');
  assert.deepEqual(Object.values(r.value).map((w) => [w.word, w.x, w.y]), KINDS);
});

test('the axes: each word, its unit and its scale, in order', () => {
  assert.deepEqual(Object.values(resolved().get('CURVE_AXES').value).map((w) => [w.word, w.unit, w.scale]), AXES);
});

test('the omx-plugins graph kinds are kept, the unused lfo is the modulation shape, and the wave adds three', () => {
  const words = KINDS.map(([w]) => w);
  assert.deepEqual(words.slice(0, 5), ['eq-curve', 'dynamics-curve', 'transfer-curve', 'delay-taps', 'decay-envelope']);
  assert.deepEqual(words.slice(5), ['comb-response', 'modulation-shape', 'interval-map']);
  assert.ok(!words.includes('lfo'), 'lfo is not declared beside modulation-shape: one picture, one word');
});

test('the renders: the C words and count, the vocabulary enum, the ts words and the json axes', () => {
  const r = resolved();
  const h = renderC(r).find((f) => f.path.endsWith('omx_vocabulary.h')).text;
  assert.match(h, /^#define OMX_CURVE_KINDS_EQ_CURVE "eq-curve"/m);
  assert.match(h, /^#define OMX_CURVE_KINDS_MODULATION_SHAPE "modulation-shape"/m);
  assert.match(h, /^#define OMX_CURVE_KINDS_COUNT 8u$/m);
  assert.match(h, /^#define OMX_CURVE_AXES_COUNT 13u$/m);
  assert.match(h, new RegExp(`^#define OMX_CURVE_KINDS_INIT \\{ ${KINDS.map(([w]) => `"${w}"`).join(', ')} \\}$`, 'm'));
  const json = renderJson(r, '0.0.0');
  const schema = JSON.parse(json.find((f) => f.path === 'omx-vocabulary.schema.json').text);
  assert.deepEqual(schema.$defs.CURVE_KINDS.enum, KINDS.map(([w]) => w));
  const items = JSON.parse(json.find((f) => f.path === 'omx-contract.json').text).items;
  assert.equal(items.CURVE_KINDS.axes, 'CURVE_AXES');
  assert.deepEqual(Object.values(items.CURVE_KINDS.value).map((w) => [w.word, w.x, w.y]), KINDS);
  assert.deepEqual(Object.values(items.CURVE_AXES.value).map((w) => [w.word, w.unit, w.scale]), AXES);
  const js = renderTs(r).find((f) => f.path === 'omx-contract.js').text;
  assert.match(js, new RegExp(`export const CURVE_KINDS_WORDS = ${JSON.stringify(KINDS.map(([w]) => w), null, 2).replace(/[[\]]/g, '\\$&')};`));
  assert.match(js, /"word": "interval-map",\n\s+"x": "input-pitch",\n\s+"y": "output-pitch"/);
});

test('the curve data is valid', () => {
  assert.deepEqual(problems(texts()), []);
});

test('a kind with an axis missing, an axis that is no axis word, or axes that name no words item, is refused', () => {
  assert.ok(has(texts((d) => { delete d[C].CURVE_KINDS.words.eqCurve.y; }), 'CURVE_KINDS', 'word-axis'));
  assert.ok(has(texts((d) => { d[C].CURVE_KINDS.words.eqCurve.x = 'time'; }), 'CURVE_KINDS', 'word-axis'));
  assert.ok(has(texts((d) => { d[C].CURVE_KINDS.axes = 'PARAM_SCALES'; }), 'CURVE_KINDS', 'word-axis'));
  assert.ok(has(texts((d) => { delete d[C].CURVE_KINDS.axes; }), 'CURVE_KINDS', 'word-axis'), 'an x with no axes');
});

test('an axis with no unit or no scale, or a scale that is no PARAM_SCALES id, is refused', () => {
  const axis = (fn) => problems(texts(fn)).filter((p) => p.item === 'CURVE_AXES' && p.rule === 'axis').map((p) => p.message);
  assert.deepEqual(axis((d) => { delete d[C].CURVE_AXES.words.frequency.scale; }), ['frequency carries a unit and no scale: an axis states both'], 'one fault, one message');
  assert.deepEqual(axis((d) => { delete d[C].CURVE_AXES.words.magnitude.unit; }), ['magnitude carries a scale and no unit: an axis states both'], 'one fault, one message');
  assert.deepEqual(axis((d) => { delete d[C].CURVE_AXES.words.level.unit; delete d[C].CURVE_AXES.words.level.scale; }), ['level is an axis of CURVE_KINDS and states no unit and no scale']);
  assert.ok(has(texts((d) => { d[C].CURVE_AXES.words.frequency.scale = 'exp'; }), 'CURVE_AXES', 'scale'));
  assert.match(problems(texts((d) => { d[C].CURVE_AXES.words.frequency.unit = 'volts'; })).map((p) => p.message).join('\n'), /unit must be equal to one of the allowed values/);
});
