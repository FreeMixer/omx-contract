// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
/**
 * data/ against docs/data-layout.md: every word in the file its rule names, and each rule red when it is broken.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { layoutProblems, readFiles } from '../tools/data-layout.mjs';
import { DATA } from './helpers.mjs';

const files = () => structuredClone(readFiles(DATA));
const doc = (fs, rel) => fs.find((f) => f.rel === rel).doc;

test('every file of data/ sits where its rule places it', () => {
  assert.deepEqual(layoutProblems(files()), []);
});

test('every hosting code is unique, with a key of its own across the tree, in the file of its dimension', () => {
  const all = files().filter((f) => f.rel.startsWith('hosting/')).flatMap((f) => Object.entries(Object.values(f.doc).find((v) => v?.kind === 'codes').codes));
  assert.ok(all.length >= 73, `${all.length} hosting codes`);
  assert.equal(new Set(all.map(([k]) => k)).size, all.length, 'one key per code');
  assert.equal(new Set(all.map(([, c]) => c.code)).size, all.length, 'one code per key');
  for (const [k] of all) assert.match(k, /^[a-z][A-Za-z0-9]*$/, `${k}: an operator-facing key is a lowerCamel name, never prose`);
});

test('sabotage: a hosting code in another dimension\'s file is named', () => {
  const fs = files();
  doc(fs, 'hosting/cost.json').HOSTING_COST_CODES.codes.zzStray = { code: 'hosting.latency.stray' };
  assert.deepEqual(layoutProblems(fs), ['hosting/cost.json: zzStray: hosting.latency.stray belongs in hosting/latency.json']);
});

test('sabotage: a key or a code two files carry is named', () => {
  let fs = files();
  doc(fs, 'hosting/latency.json').HOSTING_LATENCY_CODES.codes.costAboveCeiling = { code: 'hosting.latency.other' };
  assert.ok(layoutProblems(fs).some((p) => /costAboveCeiling: the key is hosting\/cost\.json's too|costAboveCeiling: the key is hosting\/latency\.json's too/.test(p)));
  fs = files();
  doc(fs, 'hosting/realised.json').HOSTING_REALISED_CODES.codes.zzTwice = { code: 'hosting.realised.in-process' };
  assert.ok(layoutProblems(fs).some((p) => /hosting\.realised\.in-process: hosting\/realised\.json carries it too/.test(p)));
});

test('sabotage: unsorted codes and unsorted terms are named', () => {
  let fs = files();
  const c = doc(fs, 'hosting/cost.json').HOSTING_COST_CODES;
  c.codes = Object.fromEntries(Object.entries(c.codes).reverse());
  assert.deepEqual(layoutProblems(fs), ['hosting/cost.json: its codes are not sorted by name']);
  fs = files();
  const t = doc(fs, 'formats/lv2/worker.json').LV2_WORKER_TERMS;
  t.terms = Object.fromEntries(Object.entries(t.terms).reverse());
  assert.deepEqual(layoutProblems(fs), ['formats/lv2/worker.json: LV2_WORKER_TERMS: its terms are not sorted by name']);
});

test('sabotage: an LV2 URI in a CLAP file, or in another specification\'s file, is named', () => {
  let fs = files();
  doc(fs, 'formats/clap/ext/latency.json').CLAP_EXT_LATENCY_TERMS.terms.latency.uri = 'http://lv2plug.in/ns/lv2core#latency';
  assert.ok(layoutProblems(fs).includes('formats/clap/ext/latency.json: an LV2 URI outside data/formats/lv2/'));
  assert.ok(layoutProblems(fs).includes('formats/clap/ext/latency.json: latency: a CLAP term carries its identifier, never a URI'));
  fs = files();
  doc(fs, 'formats/lv2/worker.json').LV2_WORKER_TERMS.terms.schedule.uri = 'http://lv2plug.in/ns/ext/state#makePath';
  assert.deepEqual(layoutProblems(fs), ['formats/lv2/worker.json: schedule: http://lv2plug.in/ns/ext/state#makePath lies outside http://lv2plug.in/ns/ext/worker']);
});

test('sabotage: an item its path does not name, and a word file\'s item without its prefix, are named', () => {
  let fs = files();
  const d = doc(fs, 'formats/clap/ext/tail.json');
  d.CLAP_TAIL_TERMS = d.CLAP_EXT_TAIL_TERMS;
  delete d.CLAP_EXT_TAIL_TERMS;
  assert.deepEqual(layoutProblems(fs), ['formats/clap/ext/tail.json: holds one terms item, CLAP_EXT_TAIL_TERMS']);
  fs = files();
  const m = doc(fs, 'measurement.json');
  m.VOICE_BASES = m.MEASUREMENT_VOICE_BASES;
  assert.deepEqual(layoutProblems(fs), ['measurement.json: VOICE_BASES: an item of measurement.json is named MEASUREMENT_...']);
});

test('sabotage: a file no rule places is named', () => {
  const fs = files();
  fs.push({ rel: 'misc.json', doc: { $schema: '../schema/omx-contract.schema.json' } });
  assert.deepEqual(layoutProblems(fs), ['misc.json: no rule of docs/data-layout.md places this file']);
});
