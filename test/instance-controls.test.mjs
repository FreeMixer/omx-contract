// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
// 2.2.0 (#21, #22, #23, #24): the delay's ping-pong, the drive's auto-gain, stereo link and HF roll-off, the EQ
// instance's controls (pass-filter switches and slopes, the per-band quintet counted by EQ_BAND_COUNTS, the notch's
// Q as q's travel while the band is a notch) and the comp's detector choices are controls. Every define the 2.1.0 C
// render carried is carried byte for byte; each new control's come-up value moves every render that spells it
// (the ts render carries a set's ids, not its default).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { main } from '../bin/omx-contract.mjs';
import { loadData, resolveData } from '../lib/data.mjs';
import { validateData } from '../lib/validate.mjs';
import { renderC } from '../render/c.mjs';
import { renderJson } from '../render/json.mjs';
import { renderTs } from '../render/ts.mjs';
import { DATA, ROOT, editData, scratchData, texts } from './helpers.mjs';

const header = (dir = DATA) => renderC(resolveData(loadData(dir))).find((f) => f.path === 'omxcontract/omx_contract_limits.h').text;
const json = (dir = DATA) => JSON.parse(renderJson(resolveData(loadData(dir)), '0.0.0')[0].text);
const ts = (dir = DATA) => renderTs(resolveData(loadData(dir))).map((f) => f.text).join('\n');
const controls = (k, dir) => json(dir).kernels[k].controls;
const problems = (t) => validateData(loadData(null, t)).map((p) => `${p.rule}: ${p.message}`);

test('the C render keeps every 2.1.0 line, byte for byte and in order, and only adds', () => {
  const old = readFileSync(join(ROOT, 'test/fixtures/omx-contract-2.1.0/omx_contract_limits.h'), 'utf8').split('\n');
  const now = header().split('\n');
  let i = 0;
  for (const line of now) if (i < old.length && line === old[i]) i++;
  assert.equal(i, old.length, `2.1.0 line ${i + 1} is not in the render: ${old[i]}`);
  const defines = (t) => t.filter((l) => /^#define OMX_|^  OMX_/.test(l));
  assert.ok(defines(old).length > 600, 'a short header proves nothing');
  assert.equal(defines(now).length - defines(old).length, 37, 'the 9 new sets: 20 enumerators, 9 counts, 8 defaults, and nothing else');
});

test('delay: pingpong is a switch whose come-up value is FX_DELAY_PINGPONG_DEFAULT (#22)', () => {
  assert.deepEqual(controls('delay').map((c) => c.name), ['fxDelayTime', 'fxDelayFeedback', 'tone', 'mix', 'pingpong']);
  assert.deepEqual(json().items.DELAY_PINGPONGS.value, ['off', 'on']);
  assert.equal(json().items.DELAY_PINGPONGS.default, 'off');
  assert.match(header(), /^#define OMX_DELAY_PINGPONGS_DEFAULT OMX_DELAY_PINGPONGS_OFF$/m);
});

test('drive: autoGain, stereoLink and hfRolloff are controls, appended (#24)', () => {
  assert.deepEqual(controls('drive').map((c) => `${c.name}:${c.kind}:${c.global}`).slice(-3),
    ['autoGain:choice:DRIVE_AUTO_GAINS', 'stereoLink:choice:DRIVE_STEREO_LINKS', 'hfRolloff:choice:DRIVE_HF_ROLLOFFS']);
  const h = header();
  assert.match(h, /^#define OMX_DRIVE_AUTO_GAINS_DEFAULT OMX_DRIVE_AUTO_GAINS_ON$/m);
  assert.match(h, /^#define OMX_DRIVE_STEREO_LINKS_DEFAULT OMX_DRIVE_STEREO_LINKS_ON$/m);
  assert.match(h, /^ {2}OMX_DRIVE_HF_ROLLOFFS_12000 = 12000,$/m);
  assert.match(h, /^#define OMX_DRIVE_HF_ROLLOFFS_DEFAULT OMX_DRIVE_HF_ROLLOFFS_0$/m);
});

test('eq: the instance\'s controls, in the face\'s word order, the band quintet counted by EQ_BAND_COUNTS (#23)', () => {
  const c = controls('eq');
  assert.deepEqual(c.map((x) => x.name), ['hpfOn', 'hpfFreq', 'hpfSlope', 'lpfOn', 'lpfFreq', 'lpfSlope', 'bandType', 'freq', 'gain', 'q', 'bandOn']);
  assert.deepEqual(c.filter((x) => x.count).map((x) => x.name), ['bandType', 'freq', 'gain', 'q', 'bandOn']);
  for (const x of c.filter((y) => y.count)) assert.equal(x.count, 'EQ_BAND_COUNTS');
  assert.equal(c[2].global, 'FILTER_SLOPES');
  assert.equal(c[5].global, 'FILTER_SLOPES', 'the LPF slope takes the HPF slope\'s set, declared once');
  assert.deepEqual(c[9].when, [{ control: 'bandType', is: 'notch', global: 'EQ_NOTCH_Q_RANGE' }]);
  assert.ok(!c.some((x) => x.name === 'notchQ' || x.name === 'filterSlope'));
  assert.equal(json().items.EQ_BAND_ONS.default, undefined, 'a band\'s come-up switch is the strip\'s, not the kernel\'s');
  assert.deepEqual(controls('geq')[0].count, 'GEQ_BANDS');
});

test('comp: the detector choice and the detector oversampling are controls, by the console\'s names (#21)', () => {
  assert.deepEqual(controls('comp').slice(-2).map((c) => `${c.name}:${c.global}`), ['kind:COMP_KINDS', 'detectorOversampling:DETECTOR_OVERSAMPLINGS']);
  const h = header();
  assert.match(h, /^ {2}OMX_DETECTOR_OVERSAMPLINGS_AUTO = 0,\n {2}OMX_DETECTOR_OVERSAMPLINGS_OFF = 1,\n {2}OMX_DETECTOR_OVERSAMPLINGS_X4 = 2,$/m);
  assert.match(h, /^#define OMX_COMP_KINDS_DEFAULT OMX_COMP_KINDS_COMP$/m);
  assert.deepEqual(controls('gate').map((c) => c.name), ['keySource', 'thresholdDb', 'rangeDb', 'kneeStartDb', 'kneeEndDb', 'attackMs', 'holdMs', 'releaseMs', 'hysteresisDb', 'ratio']);
});

// One perturbation per new control: move its come-up value, every render that spells it follows.
const moves = [
  ['delay', 'FX_DELAY_PINGPONG_DEFAULT', (it) => { it.value = true; }, 'DELAY_PINGPONGS', 'on'],
  ['drive', 'DRIVE_AUTO_GAINS', (it) => { it.default = 'off'; }, 'DRIVE_AUTO_GAINS', 'off'],
  ['drive', 'DRIVE_STEREO_LINKS', (it) => { it.default = 'off'; }, 'DRIVE_STEREO_LINKS', 'off'],
  ['drive', 'DRIVE_HF_ROLLOFFS', (it) => { it.default = 16000; }, 'DRIVE_HF_ROLLOFFS', 16000],
  ['eq', 'EQ_HPF_ONS', (it) => { it.default = 'on'; }, 'EQ_HPF_ONS', 'on'],
  ['eq', 'EQ_LPF_ONS', (it) => { it.default = 'on'; }, 'EQ_LPF_ONS', 'on'],
  ['eq', 'EQ_BAND_ONS', (it) => { it.default = 'on'; }, 'EQ_BAND_ONS', 'on'],
  ['eq', 'FILTER_SLOPES', (it) => { it.default = 24; }, 'FILTER_SLOPES', 24],
  ['comp', 'COMP_KINDS', (it) => { it.default = 'limiter'; }, 'COMP_KINDS', 'limiter'],
  ['comp', 'DETECTOR_OVERSAMPLINGS', (it) => { it.default = 'x4'; }, 'DETECTOR_OVERSAMPLINGS', 'x4'],
];
for (const [k, at, move, set, want] of moves) {
  test(`perturbation: move ${at}, ${set}'s default follows in the c and json renders, and --check goes red`, () => {
    const dir = scratchData();
    editData(dir, `kernels/${k}.json`, (d, decl) => move(decl(at)));
    const C = `OMX_${set}_${String(want).toUpperCase()}`;
    assert.match(header(dir), new RegExp(`^#define OMX_${set}_DEFAULT ${C}$`, 'm'));
    assert.equal(json(dir).items[set].default, want);
    if (at === 'FX_DELAY_PINGPONG_DEFAULT') assert.match(ts(dir), /^export const FX_DELAY_PINGPONG_DEFAULT = true;$/m); // the ts render carries no set default; the scalar it reads is the home
    assert.equal(main(['render', '--target', 'c', '--out', `${ROOT}/include`, '--check', '--data', dir]), 1);
  });
}

test('validate refuses a use of no declared item, a count that counts nothing, an of without its when, and a boolean default of a three-id set', () => {
  const eq = 'data/kernels/eq.json';
  const ctl = (d, n) => d[eq].controls.find((c) => c.name === n);
  assert.ok(problems(texts((d) => { ctl(d, 'lpfSlope').global = 'NO_SLOPES'; })).some((p) => /lpfSlope: uses NO_SLOPES, which no other control/.test(p)));
  assert.ok(problems(texts((d) => { ctl(d, 'lpfSlope').kind = 'travel'; })).some((p) => /a travel that uses FILTER_SLOPES, which is a choice/.test(p)));
  assert.ok(problems(texts((d) => { ctl(d, 'freq').count = 'EQ_FREQ_RANGE'; })).some((p) => /^count: eq\.freq: count EQ_FREQ_RANGE is neither/.test(p)));
  assert.ok(problems(texts((d) => { delete ctl(d, 'notchQ').when; })).some((p) => /notchQ: when must be/.test(p)));
  assert.ok(problems(texts((d) => { ctl(d, 'notchQ').when.is = 'shelf'; })).some((p) => /when\.is "shelf" is not an id of bandType/.test(p)));
  assert.ok(problems(texts((d) => { ctl(d, 'notchQ').of = 'bandType'; })).some((p) => /of "bandType" names no other control of its kind/.test(p)));
  assert.ok(problems(texts((d) => { d['data/kernels/drive.json'].controls.find((c) => c.name === 'hfRolloff').default = { ref: 'FX_DELAY_PINGPONG_DEFAULT' }; }))
    .some((p) => /a boolean default needs a two-id switch/.test(p)));
});
