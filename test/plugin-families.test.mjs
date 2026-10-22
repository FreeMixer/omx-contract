// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
/**
 * Every CLAP plugin feature (clap/plugin-features.h) and LV2 plugin class (lv2core) carries a `word`
 * (docs/data-layout.md): the contract's own descriptor word it is (`features <audio-effect|instrument
 * |note-effect|analyzer>`), the channel layout it declares (`layout <mono|stereo|surround|ambisonic>`), or, where
 * neither fits, the family it falls in (`family <name>`) — omx-contract#120. No feature or class is left unruled.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadData } from '../lib/data.mjs';
import { DATA } from './helpers.mjs';

const WORD = /^(features (audio-effect|instrument|note-effect|analyzer)|layout [a-z]+|family [A-Za-z]+)$/;

/** Every term of kind `plugin-feature` or `plugin-class`, across every terms item of `data/`, as `[item, term, entry]`. */
function pluginTerms() {
  const out = [];
  for (const { name, item } of loadData(DATA).items.values()) {
    if (item.kind !== 'terms') continue;
    for (const [term, entry] of Object.entries(item.terms)) {
      if (entry.kind === 'plugin-feature' || entry.kind === 'plugin-class') out.push([name, term, entry]);
    }
  }
  return out;
}

test('every CLAP plugin feature and LV2 plugin class carries a word, onto the four descriptor words, a layout or a family', () => {
  const terms = pluginTerms();
  const clap = terms.filter(([n]) => n === 'CLAP_PLUGIN_FEATURES_TERMS');
  const lv2 = terms.filter(([, , e]) => e.kind === 'plugin-class');
  assert.ok(clap.length >= 39, `${clap.length} CLAP plugin features`);
  assert.ok(lv2.length >= 39, `${lv2.length} LV2 plugin classes`);
  const unworded = terms.filter(([, , e]) => !e.word).map(([item, term]) => `${item}#${term}`);
  assert.deepEqual(unworded, [], 'every feature and class names its word');
  const malformed = terms.filter(([, , e]) => !WORD.test(e.word)).map(([item, term, e]) => `${item}#${term}: ${e.word}`);
  assert.deepEqual(malformed, []);
});

test('the four descriptor words are exactly features audio-effect, instrument, note-effect and analyzer', () => {
  const terms = pluginTerms();
  const descriptor = terms.filter(([, , e]) => e.word.startsWith('features ')).map(([, term]) => term);
  assert.deepEqual(descriptor.sort(), ['analyzer', 'audio-effect', 'instrument', 'note-effect']);
});

test('sabotage: a feature or a class without its word is named', () => {
  const data = loadData(DATA);
  const clap = data.items.get('CLAP_PLUGIN_FEATURES_TERMS').item;
  delete clap.terms.chorus.word;
  const unworded = [];
  for (const { name, item } of data.items.values()) {
    if (item.kind !== 'terms') continue;
    for (const [term, entry] of Object.entries(item.terms)) {
      if ((entry.kind === 'plugin-feature' || entry.kind === 'plugin-class') && !entry.word) unworded.push(`${name}#${term}`);
    }
  }
  assert.deepEqual(unworded, ['CLAP_PLUGIN_FEATURES_TERMS#chorus']);
});
