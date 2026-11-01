// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
// The 3.7.0 descriptor vocabulary (docs/descriptors.md): the meanings added by FreeMixer/omx-contract#100 and the
// synonyms they refuse, and the table that maps every CLAP plugin feature and LV2 plugin class onto the four feature
// words or other (#120).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { MEANING_SYNONYMS } from '../lib/descriptor.mjs';
import { fileProblems } from '../lib/validate.mjs';
import { ROOT } from './helpers.mjs';

const read = (rel) => JSON.parse(readFileSync(join(ROOT, rel), 'utf8'));
const authored = () => read('test/fixtures/descriptors/authored-omx-delay.json');
const problemsOf = (doc) => fileProblems({ rel: 'descriptors/x.json', text: '', doc, installed: true }).map((p) => p.message);

test('shape, model, algorithm, mode, type and pingpong are meanings', () => {
  for (const meaning of ['shape', 'model', 'algorithm', 'mode', 'type', 'pingpong']) {
    const d = authored();
    d.controls[0].meaning = meaning;
    assert.deepEqual(problemsOf(d), [], meaning);
  }
});

test('on and speed are no meanings: the validator names enabled and rate', () => {
  assert.deepEqual(MEANING_SYNONYMS, { on: 'enabled', speed: 'rate' });
  for (const [word, canonical] of Object.entries(MEANING_SYNONYMS)) {
    const d = authored();
    d.controls[0].meaning = word;
    const said = problemsOf(d);
    assert.ok(said.some((m) => m.includes(`"${word}" is not a meaning, the word is "${canonical}"`)), JSON.stringify(said));
  }
  const d = authored();
  d.controls[0].meaning = 'wobble';
  const said = problemsOf(d);
  assert.ok(said.length > 0 && said.every((m) => !/the word is/.test(m)), 'a word with no synonym names no other');
});

const FEATURES = ['audio-effect', 'instrument', 'note-effect', 'analyzer', 'other'];
const itemOf = (f) => `PLUGIN_FEATURE_${f.toUpperCase().replace('-', '_')}`;
const table = (map = read('data/plugin-features.json')) => {
  const rows = new Map();
  for (const f of FEATURES) for (const w of Object.values(map[itemOf(f)].words)) for (const ref of w.from) rows.set(ref, [...(rows.get(ref) ?? []), f]);
  return rows;
};
const terms = () => {
  const clap = Object.values(read('data/formats/clap/plugin-features.json').CLAP_PLUGIN_FEATURES_TERMS.terms);
  void clap;
  const out = [];
  for (const [n, t] of Object.entries(read('data/formats/clap/plugin-features.json').CLAP_PLUGIN_FEATURES_TERMS.terms)) if (t.kind === 'plugin-feature') out.push([`CLAP_PLUGIN_FEATURES_TERMS#${n}`, t]);
  for (const [n, t] of Object.entries(read('data/formats/lv2/core.json').LV2_CORE_TERMS.terms)) if (t.kind === 'plugin-class') out.push([`LV2_CORE_TERMS#${n}`, t]);
  return out;
};
const unmapped = (rows, all) => all.filter(([ref]) => (rows.get(ref) ?? []).length !== 1).map(([ref]) => ref);

test('every CLAP plugin feature and LV2 plugin class the scan can emit maps onto one feature word or other', () => {
  const all = terms();
  assert.ok(all.length >= 78, `the probe sees the terms: ${all.length}`);
  assert.equal(all.filter(([ref]) => ref.startsWith('CLAP')).length, 39);
  assert.deepEqual(unmapped(table(), all), []);
  assert.deepEqual(FEATURES.slice(0, 4), read('schema/omx-contract.schema.json').$defs.plugin.properties.features.items.enum, 'the four feature words stay');
  // and the table names nothing the terms do not
  assert.deepEqual([...table().keys()].filter((ref) => !all.some(([r]) => r === ref)), []);
  // a mapped term is used, not supported-later
  assert.deepEqual(all.filter(([, t]) => t.status !== 'used').map(([r]) => r), []);
});

test('sabotage: a feature dropped from the table, or named twice, is seen', () => {
  const map = read('data/plugin-features.json');
  delete map.PLUGIN_FEATURE_AUDIO_EFFECT.words.clapReverb;
  assert.deepEqual(unmapped(table(map), terms()), ['CLAP_PLUGIN_FEATURES_TERMS#reverb']);
  const twice = read('data/plugin-features.json');
  twice.PLUGIN_FEATURE_OTHER.words.clapReverb = { word: 'clap.reverb', from: ['CLAP_PLUGIN_FEATURES_TERMS#reverb'] };
  assert.deepEqual(unmapped(table(twice), terms()), ['CLAP_PLUGIN_FEATURES_TERMS#reverb']);
});

test('an instrument class is only one that takes notes: generators and oscillators are other', () => {
  const rows = table();
  assert.deepEqual(rows.get('LV2_CORE_TERMS#InstrumentPlugin'), ['instrument']);
  for (const c of ['Generator', 'Oscillator', 'Constant', 'Function']) assert.deepEqual(rows.get(`LV2_CORE_TERMS#${c}Plugin`), ['other'], c);
  assert.deepEqual(rows.get('CLAP_PLUGIN_FEATURES_TERMS#compressor'), ['audio-effect']);
});

test('the panel families and widgets, and the names of the scan documents, are declared here (#157)', () => {
  const panel = read('data/panel.json');
  const ws = (it) => Object.values(it.words).map((w) => w.word);
  assert.deepEqual(ws(panel.PANEL_FAMILIES), ['none', 'gate', 'dynamics', 'limiter', 'deesser', 'eq', 'filter', 'drive', 'modulation', 'delay', 'reverb', 'pitch']);
  assert.deepEqual(ws(panel.PANEL_WIDGETS), ['auto', 'knob', 'fader', 'switch', 'selector']);
  assert.deepEqual(ws(panel.PANEL_STANDARD_WIDGETS), ['knob', 'fader', 'switch', 'selector', 'meter', 'curve', 'xy', 'display']);
  const scan = read('data/scan.json');
  assert.deepEqual(ws(scan.SCAN_FIELD_SCOPES), ['plugin', 'param', 'audio_in', 'audio_out', 'note_in', 'note_out', 'port', 'panel', 'section', 'control', 'role', 'display', 'placement_default']);
  assert.deepEqual(ws(scan.SCAN_DOCUMENTS), ['CLAP_SCAN_DOCUMENT', 'FIELD_DUMP']);
  assert.match(scan.SCAN_DOCUMENTS.words.clapScanDocument.doc, /Owned by omx-clap-core/);
  assert.match(scan.SCAN_FIELD_SCOPES.doc, /owned by plugin-qualify/);
});
