// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
/**
 * The whole LV2 and CLAP vocabulary is mapped (docs/data-layout.md): every term of the inventory has its entry and its
 * status, and no entry names a term the inventory lacks. The inventory is the installed sources', checked where they
 * are installed.
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { coverageProblems, readFiles, readInventory } from '../tools/data-layout.mjs';
import { defaultClapInclude, defaultLv2Dir, inventories, parseNTriples, readClapHeader, readLv2, readLv2Dir } from '../tools/format-inventory.mjs';
import { DATA, ROOT, scratchDir } from './helpers.mjs';

const INVENTORY = join(ROOT, 'inventory');
const files = () => structuredClone(readFiles(DATA));
const doc = (fs, rel) => fs.find((f) => f.rel === rel).doc;
const statuses = (fs) => fs.filter((f) => f.rel.startsWith('formats/')).flatMap((f) => Object.values(Object.values(f.doc)[1].terms).map((t) => t.status));

test('every LV2 term and CLAP identifier of the inventory is mapped, with a status, and nothing more', () => {
  const inv = readInventory(INVENTORY);
  assert.deepEqual(coverageProblems(files(), inv), []);
  const lv2 = Object.values(inv.lv2.specs).reduce((n, s) => n + s.terms.length, 0);
  const clap = Object.values(inv.clap.headers).reduce((n, h) => n + h.length, 0);
  assert.ok(lv2 >= 452 && clap >= 297, `${lv2} LV2 terms, ${clap} CLAP identifiers`);
  const st = statuses(files());
  assert.equal(st.length, lv2 + clap);
  for (const s of st) assert.ok(['used', 'supported-later', 'out-of-scope'].includes(s), s);
});

test('sabotage: a term taken out of the mapping, and one the format does not define, are named', () => {
  const inv = readInventory(INVENTORY);
  let fs = files();
  delete doc(fs, 'formats/lv2/worker.json').LV2_WORKER_TERMS.terms.schedule;
  assert.deepEqual(coverageProblems(fs, inv), ['formats/lv2/worker.json: http://lv2plug.in/ns/ext/worker#schedule is not mapped']);
  fs = files();
  delete doc(fs, 'formats/clap/ext/params.json').CLAP_EXT_PARAMS_TERMS.terms.paramIsStepped;
  assert.deepEqual(coverageProblems(fs, inv), ['formats/clap/ext/params.json: CLAP_PARAM_IS_STEPPED is not mapped (as paramIsStepped)']);
  fs = files();
  doc(fs, 'formats/clap/ext/tail.json').CLAP_EXT_TAIL_TERMS.terms.invented = { id: 'CLAP_INVENTED', kind: 'constant', status: 'used', by: ['x:y'] };
  assert.deepEqual(coverageProblems(fs, inv), ['formats/clap/ext/tail.json: invented is no identifier of the installed clap/ext/tail.h']);
});

test('sabotage: a term without its status, a wrong URI and a wrong version are named', () => {
  const inv = readInventory(INVENTORY);
  let fs = files();
  delete doc(fs, 'formats/lv2/urid.json').LV2_URID_TERMS.terms.map.status;
  assert.deepEqual(coverageProblems(fs, inv), ['formats/lv2/urid.json: map has no status']);
  fs = files();
  doc(fs, 'formats/lv2/urid.json').LV2_URID_TERMS.terms.map.uri = 'http://lv2plug.in/ns/ext/urid#mapped';
  assert.deepEqual(coverageProblems(fs, inv), ['formats/lv2/urid.json: map maps http://lv2plug.in/ns/ext/urid#mapped, the term is http://lv2plug.in/ns/ext/urid#map']);
  fs = files();
  doc(fs, 'formats/clap/process.json').CLAP_PROCESS_TERMS.version = '1.2.9';
  assert.deepEqual(coverageProblems(fs, inv), ['formats/clap/process.json: version 1.2.9, the installed CLAP is 1.2.10']);
});

test('sabotage: a newer format installed, one term more, is named until it is mapped', () => {
  const inv = readInventory(INVENTORY);
  inv.lv2.specs.worker.terms.push({ uri: 'http://lv2plug.in/ns/ext/worker#wake', name: 'wake', types: ['lv2:Feature'] });
  inv.clap.headers['ext/tail'].push({ name: 'CLAP_TAIL_FOREVER', group: 'enum', value: null });
  assert.deepEqual(coverageProblems(files(), inv), [
    'formats/lv2/worker.json: http://lv2plug.in/ns/ext/worker#wake is not mapped',
    'formats/clap/ext/tail.json: CLAP_TAIL_FOREVER is not mapped (as tailForever)',
  ]);
});

test('the inventory reads N-Triples and CLAP declarations as the tool writes them', () => {
  assert.deepEqual(parseNTriples('<http://a#b> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://c#D> .\n<http://a#b> <http://e#f> "x \\"y\\""@en .\n'),
    [['http://a#b', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://c#D'], ['http://a#b', 'http://e#f', '"x \\"y\\""']]);
  const h = `/* a */ static const CLAP_CONSTEXPR char CLAP_EXT_X[] =\n  "clap.x/1"; // b\nenum clap_x_flags { CLAP_X_A = 1 << 0, CLAP_X_B = 1 << 1, };\n#define CLAP_PLUGIN_FEATURE_Y "y"\nstatic const CLAP_CONSTEXPR uint16_t CLAP_X_ID = 0;\n`;
  assert.deepEqual(readClapHeader(h), [
    { name: 'CLAP_EXT_X', group: 'string', value: 'clap.x/1' },
    { name: 'CLAP_X_A', group: 'clap_x_flags', value: '1 << 0' },
    { name: 'CLAP_X_B', group: 'clap_x_flags', value: '1 << 1' },
    { name: 'CLAP_PLUGIN_FEATURE_Y', group: 'string', value: 'y' },
    { name: 'CLAP_X_ID', group: 'const', value: '0' },
  ].sort((a, b) => h.indexOf(a.name) - h.indexOf(b.name)));
});

const serdi = spawnSync('serdi', ['-v'], { encoding: 'utf8' }).error === undefined;
const installed = serdi && existsSync(join(defaultLv2Dir(), 'core.lv2')) && existsSync(join(defaultClapInclude(), 'clap', 'clap.h'));

test('the committed inventory is the installed LV2 and CLAP, where they are installed', { skip: installed ? false : 'no serdi, LV2 bundles or CLAP headers here' }, () => {
  const docs = inventories();
  const inv = readInventory(INVENTORY);
  assert.deepEqual(JSON.parse(docs['lv2.json']), inv.lv2, 'inventory/lv2.json: run node tools/format-inventory.mjs and map what changed');
  assert.deepEqual(JSON.parse(docs['clap.json']), inv.clap, 'inventory/clap.json: run node tools/format-inventory.mjs and map what changed');
});

test('a bundle that is no specification is recorded as unread, and the others are still read (#143)', { skip: serdi ? false : 'no serdi' }, () => {
  const dir = scratchDir('omx-lv2-bundles-');
  const bundle = (name, manifest, extra = {}) => {
    mkdirSync(join(dir, `${name}.lv2`));
    writeFileSync(join(dir, `${name}.lv2`, 'manifest.ttl'), manifest);
    for (const [f, t] of Object.entries(extra)) writeFileSync(join(dir, `${name}.lv2`, f), t);
  };
  const pfx = '@prefix lv2: <http://lv2plug.in/ns/lv2core#> .\n@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .\n';
  bundle('thing', `${pfx}<http://example.org/thing> a lv2:Specification ; lv2:minorVersion 1 ; lv2:microVersion 2 ; rdfs:seeAlso <thing.ttl> .\n`,
    { 'thing.ttl': `${pfx}<http://example.org/thing#t> a lv2:Feature ; rdfs:label "t" .\n` });
  bundle('Airwindows', `${pfx}<urn:airwindows:a> a lv2:Plugin ; lv2:binary <a.so> ; rdfs:seeAlso <a.ttl> .\n<urn:airwindows:b> a lv2:Plugin ; lv2:binary <a.so> ; rdfs:seeAlso <a.ttl> .\n`);
  bundle('empty', `${pfx}<urn:x> rdfs:label "x" .\n`);
  const { specs, unread } = readLv2Dir(dir);
  assert.deepEqual(Object.keys(specs), ['thing']);
  assert.equal(specs.thing.version, '1.2');
  assert.deepEqual(unread.map((u) => u.bundle), ['Airwindows', 'empty']);
  assert.match(unread[0].reason, /plugin bundle/);
  assert.match(unread[1].reason, /names 0 specifications/);
  assert.deepEqual(Object.keys(readLv2(dir)), ['thing']);
});
