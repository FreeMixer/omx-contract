// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
// The descriptor words of 3.0.0 (docs/descriptors.md): the extension bag, plugin.doc and the ratio unit on a
// descriptor, and the formatMap kind, one format's mapping table. Each is read when well formed and refused, by the
// schema or by its rule, one arm per rule.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { loadData, resolveData } from '../lib/data.mjs';
import { formatDoc } from '../lib/fmt.mjs';
import { fileProblems, validateData } from '../lib/validate.mjs';
import { renderC } from '../render/c.mjs';
import { renderJson } from '../render/json.mjs';
import { renderTs } from '../render/ts.mjs';
import { ROOT, texts } from './helpers.mjs';

const authored = () => JSON.parse(readFileSync(join(ROOT, 'test/fixtures/descriptors/authored-omx-delay.json'), 'utf8'));
const problemsOf = (doc) => fileProblems({ rel: 'descriptors/x.json', text: '', doc, installed: true }).map((p) => `${p.code ?? p.rule}:${p.message}`);

test('a descriptor carries the extension bag per format, a one-line plugin.doc and the ratio unit', () => {
  const doc = authored();
  doc.plugin.doc = 'A stereo delay with ping-pong.';
  doc.extensions = { clap: { 'clap_plugin_descriptor.features': ['delay', 'stereo'] }, lv2: { 'rdf:type': 'lv2:DelayPlugin' } };
  doc.controls[1].travel.unit = 'ratio';
  assert.deepEqual(problemsOf(doc), []);
  const bad = (edit, want) => {
    const d = structuredClone(doc);
    edit(d);
    assert.ok(problemsOf(d).some((p) => want.test(p)), `${want}: ${JSON.stringify(problemsOf(d))}`);
  };
  bad((d) => { d.extensions.vst3 = { x: 1 }; }, /contract\.file\.invalid|schema:.*\/extensions must be equal to one of the allowed values|propertyName/);
  bad((d) => { d.extensions.clap = {}; }, /\/extensions\/clap must NOT have fewer than 1 properties/);
  bad((d) => { d.extensions = {}; }, /\/extensions must NOT have fewer than 1 properties/);
  bad((d) => { d.plugin.doc = 'two\nlines'; }, /\/plugin\/doc must match pattern/);
  bad((d) => { d.controls[1].travel.unit = 'ratios'; }, /\/travel\/unit/);
});

/** A format map in a file of its own, beside the union's terms (LV2_UNITS_TERMS and the CLAP files). */
const MAP = 'data/maps/lv2.json';
const map = () => ({
  $schema: '../../schema/omx-contract.schema.json',
  ACME_LV2_MAP: {
    kind: 'formatMap',
    doc: 'How an LV2 scan becomes a descriptor.',
    format: 'lv2',
    rows: {
      'units:unit': { term: 'LV2_UNITS_TERMS#unit', word: { word: 'controls[].travel.unit', transform: 'lookup', values: { 'units:db': 'dB', 'units:hz': 'Hz' } } },
      'units:khz': { term: 'LV2_UNITS_TERMS#khz', word: { word: 'controls[].travel.unit', transform: 'scale-by', factor: 1000 } },
      'doap:license': { from: 'http://usefulinc.com/ns/doap#license', extension: true },
      'rdfs:comment': { from: 'https://www.w3.org/TR/rdf-schema/#ch_comment', word: { word: 'plugin.doc', transform: 'identity' } },
      'units:conversion': { term: 'LV2_UNITS_TERMS#conversion', dropped: { ruling: 'docs/descriptors.md#units: a unit converts by our words, never by its own' } },
    },
  },
});
const withMap = (edit) => texts((d) => { d[MAP] = map(); edit?.(d[MAP].ACME_LV2_MAP.rows, d[MAP].ACME_LV2_MAP); });
const problems = (t) => validateData(loadData(null, t)).map((p) => `${p.item}:${p.rule}:${p.message}`);

test('a formatMap: rows keyed by source field, each one class and a term or a from; the json and ts renders carry it, the c render does not', () => {
  const t = withMap();
  assert.deepEqual(problems(t), []);
  const r = resolveData(loadData(null, t));
  assert.equal(r.get('ACME_LV2_MAP').format, 'lv2');
  assert.deepEqual(r.get('ACME_LV2_MAP').value['units:khz'].word, { word: 'controls[].travel.unit', transform: 'scale-by', factor: 1000 });
  const j = JSON.parse(renderJson(r, '0.0.0')[0].text).items.ACME_LV2_MAP;
  assert.deepEqual([j.kind, j.format, Object.keys(j.value).length], ['formatMap', 'lv2', 5]);
  assert.match(renderTs(r)[0].text, /^export const ACME_LV2_MAP = \{$/m);
  const without = resolveData(loadData(null, texts()));
  assert.deepEqual(renderC(r), renderC(without), 'a map is no C define');
  // the one formatting sorts the rows by field, each row's words in their order
  const formatted = JSON.parse(formatDoc(JSON.parse(t[MAP])));
  assert.deepEqual(Object.keys(formatted.ACME_LV2_MAP.rows), Object.keys(map().ACME_LV2_MAP.rows).sort());
  assert.deepEqual(Object.keys(formatted.ACME_LV2_MAP.rows['units:unit']), ['term', 'word']);
});

test('a source field is the field as the format names it: an element of a fixed array of a struct is <member>[<index>]', () => {
  const clapMap = (keys) => withMap((rows, it) => {
    it.format = 'clap';
    for (const k of Object.keys(rows)) delete rows[k];
    for (const k of keys) rows[k] = { from: 'omx_clap_ext.h#omx_clap_panel_display', extension: true };
  });
  // omx-clap-scan --fields names the two meter ids of a panel display so (omx-clap-core doc/reference.md)
  assert.deepEqual(problems(clapMap(['omx_clap_panel_display.meter_ids[0]', 'omx_clap_panel_display.meter_ids[1]', 'clap_param_info.min_value'])), []);
  const doc = authored();
  doc.extensions = { clap: { 'omx_clap_panel_display.meter_ids[1]': 101 } };
  assert.deepEqual(problemsOf(doc), []);
  for (const key of ['omx_clap_panel_display.meter_ids[]', 'omx_clap_panel_display.meter_ids[x]', 'omx_clap_panel_display.meter_ids[0',
    'omx_clap_panel_display.meter_ids0]', 'omx_clap_panel_display.[0]', 'meter_ids[0][1]', '[0]', 'meter_ids[-1]', 'meter_ids [0]']) {
    assert.ok(problems(clapMap([key])).some((p) => /^ACME_LV2_MAP:schema:.*must match pattern/.test(p)), key);
  }
});

test('a formatMap row is refused with no class, two classes, neither or both of term and from, both values and factor, or code', () => {
  const schema = (edit, why) => assert.ok(problems(withMap(edit)).some((p) => /^ACME_LV2_MAP:schema:/.test(p)), why);
  schema((rows) => { delete rows['units:unit'].word; }, 'no class');
  schema((rows) => { rows['units:unit'].extension = true; }, 'two classes');
  schema((rows) => { delete rows['units:khz'].term; }, 'neither term nor from');
  schema((rows) => { rows['units:khz'].from = 'http://lv2plug.in/ns/extensions/units#khz'; }, 'both term and from');
  schema((rows) => { rows['units:unit'].word.factor = 2; }, 'values and factor');
  schema((rows) => { rows['units:unit'].word.code = 'x => x'; }, 'never code');
  schema((rows) => { rows['units:khz'].word.transform = 'Scale By'; }, 'a transform is a name');
  schema((rows) => { rows['units:unit'].word.word = 'controls[].travel unit'; }, 'a word is a descriptor path');
  schema((rows) => { rows['doap:license'].extension = false; }, 'extension is true or absent');
  schema((rows) => { rows['units:conversion'].dropped = {}; }, 'a drop names its ruling');
  schema((rows, it) => { it.format = 'vst3'; }, 'a format of ours');
});

test('a formatMap row\'s term is a term of a terms item of the map\'s format (rule map-term)', () => {
  const rule = (edit, want) => {
    const got = problems(withMap(edit));
    assert.ok(got.some((p) => /^ACME_LV2_MAP:map-term:/.test(p) && want.test(p)), `${want}: ${JSON.stringify(got)}`);
  };
  rule((rows) => { rows['units:unit'].term = 'ACME_LV2_MAP#unit'; }, /ACME_LV2_MAP is no terms item/);
  rule((rows) => { rows['units:unit'].term = 'LV2_UNITS_TERMS#furlong'; }, /LV2_UNITS_TERMS has no term furlong/);
  const clap = [...loadData(null, texts()).items.values()].find((it) => it.item.kind === 'terms' && it.item.format === 'clap');
  const term = Object.keys(clap.item.terms)[0];
  rule((rows) => { rows['units:unit'].term = `${clap.name}#${term}`; }, /is a clap term, and the map is lv2's/);
});
