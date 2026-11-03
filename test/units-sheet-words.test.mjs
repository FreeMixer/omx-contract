// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
/**
 * The words of the LV2 units sheet (data/formats/lv2/units.json). A reader takes a unit's spelling from the sheet,
 * never from a table of its own, so every unit the sheet calls used carries a word, and that word is one the
 * descriptor vocabulary admits (schema/omx-contract.schema.json, $defs.descriptorUnit). A unit not used yet carries
 * none: a reader falls back to the plugin's own symbol for it.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const ROOT = join(import.meta.dirname, '..');
const read = (p) => JSON.parse(readFileSync(join(ROOT, p), 'utf8'));

export function unitWordFaults(terms, admitted) {
  const bad = [];
  for (const [name, t] of Object.entries(terms)) {
    if (t.kind !== 'unit') continue;
    if (t.status === 'used' && !('word' in t)) bad.push(`${name} is used and carries no word`);
    if ('word' in t && !admitted.has(t.word)) bad.push(`${name}'s word ${JSON.stringify(t.word)} is no descriptor unit`);
  }
  return bad;
}

function admittedWords() {
  const defs = read('schema/omx-contract.schema.json').$defs;
  const words = new Set(defs.unit.enum);
  for (const alt of defs.descriptorUnit.anyOf) for (const w of alt.enum ?? []) words.add(w);
  words.delete('unknown');
  return words;
}

const terms = () => read('data/formats/lv2/units.json').LV2_UNITS_TERMS.terms;

test('every used unit of the sheet carries a word the descriptor vocabulary admits', () => {
  assert.deepEqual(unitWordFaults(terms(), admittedWords()), []);
});

test('a used unit without a word, or with a word outside the vocabulary, is refused', () => {
  const t = structuredClone(terms());
  delete t.coef.word;
  assert.deepEqual(unitWordFaults(t, admittedWords()), ['coef is used and carries no word']);
  const u = structuredClone(terms());
  u.db.word = 'decibel';
  assert.deepEqual(unitWordFaults(u, admittedWords()), ['db\'s word "decibel" is no descriptor unit']);
});
