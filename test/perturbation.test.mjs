// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
/**
 * The perturbation arm (R-094, spec §4.3): move a value in the data and every target that renders it
 * moves — the c limits header (its own spelling and its alias), the plugin's parameter table, the ts
 * module and the json render — while `render --check` against the committed renders goes red.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { main } from '../bin/omx-contract.mjs';
import { loadData, resolveData } from '../lib/data.mjs';
import { renderC } from '../render/c.mjs';
import { renderJson } from '../render/json.mjs';
import { renderTs } from '../render/ts.mjs';
import { roundTrip } from '../tools/proof/round-trip.mjs';
import { DATA, ROOT, editData, scratchData } from './helpers.mjs';

const all = (dir) => {
  const r = resolveData(loadData(dir));
  return { r, text: [...renderC(r), ...renderTs(r), ...renderJson(r, '0.0.0')].map((f) => `== ${f.path}\n${f.text}`).join('\n') };
};

test('move the delay time ceiling: every target follows', () => {
  const dir = scratchData();
  editData(dir, 'kernels/delay.json', (d) => { d.FX_DELAY_TIME_RANGE.travel.max = 1500; });
  const { r, text } = all(dir);
  const c = renderC(r);
  const limits = c.find((f) => f.path.endsWith('omx_contract_limits.h')).text;
  const params = c.find((f) => f.path.endsWith('omx_delay_params.h')).text;
  assert.match(limits, /^#define OMX_FX_DELAY_TIME_RANGE_MAX 1500$/m);
  assert.match(limits, /^#define OMX_DELAY_TIME_MS_MAX 1500\.0f$/m);
  assert.match(params, /^#define OMX_DELAY_PARAM_TIME_MS_MAX 1500\.0f$/m);
  assert.match(params, /\{ "timeMs", "Time", "ms", 0\.0f, 1500\.0f, 300\.0f, OMX_PLUGIN_PARAM_INTEGER \}/);
  assert.match(renderTs(r)[0].text, /"max": 1500/);
  assert.equal(JSON.parse(renderJson(r, '0.0.0')[0].text).items.FX_DELAY_TIME_RANGE.value.max, 1500);
  assert.doesNotMatch(text, /OMX_DELAY_TIME_MS_MAX 2000/);
  assert.equal(main(['render', '--target', 'c', '--out', `${ROOT}/include`, '--check', '--data', dir]), 1);
  assert.equal(main(['render', '--target', 'json', '--out', `${ROOT}/share/omx-contract`, '--check', '--data', dir]), 1);
  assert.equal(main(['render', '--target', 'ts', '--out', `${ROOT}/test/golden/ts`, '--check', '--data', dir]), 1);
  const proof = roundTrip(r);
  assert.equal(proof.ok, false);
  assert.ok(proof.step2.differing.includes('OMX_FX_DELAY_TIME_RANGE_MAX') && proof.step2.differing.includes('OMX_DELAY_TIME_MS_MAX'));
});

test('move a gate default: its table block, the ts and json renders follow', () => {
  const dir = scratchData();
  editData(dir, 'kernels/gate.json', (d) => { d.GATE_LIMITS.fields.thresholdDb.default = -41; });
  const { r } = all(dir);
  assert.match(renderC(r)[0].text, /^#define OMX_GATE_THRESHOLD_DB_DEFAULT -41\.0f$/m);
  assert.match(renderTs(r)[0].text, /"default": -41/);
  assert.equal(JSON.parse(renderJson(r, '0.0.0')[0].text).items.GATE_LIMITS.value.thresholdDb.default, -41);
});

test('move the sample rates: the list, the rate block and RT target readers follow', () => {
  const dir = scratchData();
  editData(dir, 'rates.json', (d) => { d.STANDARD_SAMPLE_RATES.values.push(384000); });
  const h = renderC(resolveData(loadData(dir)))[0].text;
  assert.match(h, /^#define OMX_STANDARD_SAMPLE_RATES_COUNT 7u$/m);
  assert.match(h, /^#define OMX_DECLARED_RATE_COUNT 7u$/m);
  assert.match(h, /384000\.0f \};$/m);
});

test('the unperturbed data passes every check', () => {
  assert.equal(main(['render', '--target', 'c', '--out', `${ROOT}/include`, '--check', '--data', DATA]), 0);
  assert.equal(roundTrip().ok, true);
});
