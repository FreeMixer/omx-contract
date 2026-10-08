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
  assert.match(limits, /^#define OMX_FX_DELAY_TIME_RANGE_MAX 1500$/m);
  assert.match(limits, /^#define OMX_DELAY_TIME_MS_MAX 1500\.0f$/m);
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

// 1.3.0: one case per family of items it added — move the value in its file and the c, ts and json
// renders follow while `render --check` against the committed ones goes red.
const moved = (rel, fn) => {
  const dir = scratchData();
  editData(dir, rel, fn);
  const r = resolveData(loadData(dir));
  return { dir, r, c: renderC(r)[0].text, ts: renderTs(r)[0].text, json: JSON.parse(renderJson(r, '0.0.0')[0].text).items };
};

test('move an FBS detector gate, an HRP value, the RTA size and the bus input cap: every target follows', () => {
  const f = moved('kernels/fbs.json', (d) => { d.GROWTH_MIN_TOTAL_RISE_DB.value = 7; });
  assert.match(f.c, /^#define OMX_GROWTH_MIN_TOTAL_RISE_DB 7$/m);
  assert.match(f.c, /^#define OMX_DEFAULT_THRESHOLDS_GROWTH_MIN_TOTAL_RISE_DB 7$/m, 'the sheet that refers to it follows');
  assert.equal(f.json.DEFAULT_THRESHOLDS.value.growthMinTotalRiseDb, 7);
  assert.equal(main(['render', '--target', 'c', '--out', `${ROOT}/include`, '--check', '--data', f.dir]), 1);
  const h = moved('kernels/hrp.json', (d) => { d.HRP_AMOUNT_RANGE.travel.default = 0.25; });
  assert.match(h.c, /^#define OMX_HRP_AMOUNT_RANGE_DEFAULT 0\.25f$/m);
  assert.match(h.ts, /"default": 0\.25/);
  assert.match(moved('kernels/rta.json', (d) => { d.RTA_FFT_SIZE_MAX.value = 65536; }).c, /^#define OMX_RTA_FFT_SIZE_MAX 65536$/m);
  const b = moved('kernels/mixmatrix.json', (d) => { d.BUS_INPUT_CAP.value = 256; });
  assert.match(b.c, /^#define OMX_BUS_INPUT_CAP 256$/m);
  assert.equal(b.json.BUS_INPUT_CAP.value, 256);
});

test('move a set, a band count, a rate set and a kernel constant: every target follows', () => {
  const s = moved('kernels/tremolo.json', (d) => { d.TREMOLO_MODES.ids.push('ring'); delete d.TREMOLO_MODES.labels; });
  assert.match(s.c, /^ {2}OMX_TREMOLO_MODES_RING = 2,$/m);
  assert.match(s.c, /^#define OMX_TREMOLO_MODES_COUNT 3u$/m);
  assert.deepEqual(s.json.TREMOLO_MODES.value, ['tremolo', 'pan', 'ring']);
  assert.match(s.ts, /"ring"/);
  const n = moved('kernels/eq.json', (d) => { d.EQ_BAND_COUNTS.value.eq16.default = 12; });
  assert.match(n.c, /^#define OMX_EQ_BAND_COUNTS_EQ16_DEFAULT 12$/m);
  assert.equal(n.json.EQ_BAND_COUNTS.value.eq16.default, 12);
  const r = moved('rates.json', (d) => { d.ORACLE_FLOOR_RATES.values.push(384000); });
  assert.match(r.c, /^#define OMX_ORACLE_FLOOR_RATES_COUNT 5u$/m);
  const k = moved('kernels/chorus.json', (d) => { d.CHORUS_BASE_MS.value = 12; });
  assert.match(k.c, /^#define OMX_CHORUS_BASE_MS 12$/m);
  assert.match(k.c, /^#define OMX_CHORUS_MAX_MS 24$/m, 'the derived maximum follows');
  assert.equal(k.json.CHORUS_MAX_MS.value, 24);
});
