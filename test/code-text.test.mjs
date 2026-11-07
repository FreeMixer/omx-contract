// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
// A code's sentence, one per language beside the code, written by the code's owner (docs/data-layout.md, spec 7.11).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadData } from '../lib/data.mjs';
import { classify } from '../lib/semver.mjs';
import { validateData } from '../lib/validate.mjs';
import { renderC } from '../render/c.mjs';
import { renderJson } from '../render/json.mjs';
import { resolvedOf, texts } from './helpers.mjs';

const FILE = 'data/hosting.json';
const withText = (d, c = d[FILE].HOSTING_CODES.codes.noteInput) => {
  c.text = { en: 'No contract directory at {path}', ca: 'No hi ha cap directori de contracte a {path}' };
  c.args = ['path'];
  return c;
};
const problems = (fn) => validateData(loadData(null, texts(fn))).map((p) => `${p.item}:${p.rule}`);

test('a code with no text stays green', () => assert.deepEqual(problems(() => {}), []));

test('a code with en and ca and the same placeholders, all in args, is green', () => assert.deepEqual(problems((d) => { withText(d); }), []));

test('fixture en-without-ca: a code with en and no ca is red', () => {
  const p = problems((d) => { delete withText(d).text.ca; });
  assert.ok(p.some((x) => x.startsWith('HOSTING_CODES')), p.join());
});

test('fixture ca-without-en: a code with ca and no en is red', () => assert.ok(problems((d) => { delete withText(d).text.en; }).length > 0));

test('fixture placeholder-sets-differ: en and ca using different placeholder sets is red', () => {
  assert.ok(problems((d) => { withText(d).text.ca = 'No hi ha cap directori'; }).includes('HOSTING_CODES:code-text-placeholders'));
  assert.ok(problems((d) => { const c = withText(d); c.args = ['path', 'name']; c.text.ca += ' {name}'; }).includes('HOSTING_CODES:code-text-placeholders'));
});

test('fixture placeholder-not-in-args: a placeholder that is not in args is red', () => {
  assert.ok(problems((d) => { withText(d).args = []; }).includes('HOSTING_CODES:code-text-arg'));
  assert.ok(problems((d) => { delete withText(d).args; }).includes('HOSTING_CODES:code-text-arg'), 'no args at all');
});

test('text with no placeholders needs no args', () => assert.deepEqual(problems((d) => { const c = withText(d); c.text = { en: 'No directory', ca: 'Cap directori' }; delete c.args; }), []));

test('an arg name is lowerCamel and listed once', () => {
  assert.ok(problems((d) => { withText(d).args = ['Path']; }).length > 0);
  assert.ok(problems((d) => { withText(d).args = ['path', 'path']; }).length > 0);
});

test('the json render carries text and args beside the code', () => {
  const json = JSON.parse(renderJson(resolvedOf(texts((d) => { withText(d); })), '0.0.0').find((f) => f.path === 'omx-contract.json').text);
  assert.equal(json.items.HOSTING_CODES.value.noteInput.text.ca, 'No hi ha cap directori de contracte a {path}');
  assert.deepEqual(json.items.HOSTING_CODES.value.noteInput.args, ['path']);
});

test('semver: a text added to a code is MINOR, reworded PATCH, an arg changed MAJOR', () => {
  const base = resolvedOf(texts((d) => { withText(d); }));
  const lvl = (fn) => classify(base, resolvedOf(texts((d) => { fn(withText(d)); }))).level;
  assert.equal(classify(resolvedOf(texts()), base).level, 'minor');
  assert.equal(lvl((c) => { c.text.en = 'No contract directory at {path}.'; }), 'patch');
  assert.equal(lvl((c) => { c.args = ['dir']; c.text = { en: '{dir}', ca: '{dir}' }; }), 'major');
});

test('the C vocabulary header, the vocabulary schema and an owner header carry text and args beside the code', () => {
  const t = texts((d) => {
    d['data/zz-words.json'] = { $schema: '../schema/omx-contract.schema.json', ZZ_CODES: { kind: 'codes', doc: 'd', codes: { gone: { code: 'hosting.zz.gone', text: { en: 'Gone: {what}', ca: 'Perdut: {what}' }, args: ['what'] }, bare: { code: 'hosting.zz.bare' } } } };
  });
  const r = resolvedOf(t);
  const h = renderC(r).find((f) => f.path === 'omxcontract/omx_vocabulary.h').text;
  assert.match(h, /^#define OMX_HOSTING_ZZ_GONE_TEXT_EN "Gone: \{what\}"$/m);
  assert.match(h, /^#define OMX_HOSTING_ZZ_GONE_TEXT_CA "Perdut: \{what\}"$/m);
  assert.match(h, /^#define OMX_HOSTING_ZZ_GONE_ARGS_INIT \{ "what" \}$/m);
  assert.doesNotMatch(h, /ZZ_BARE_TEXT/, 'a code with no text gains nothing');
  const schema = JSON.parse(renderJson(r, '0.0.0').find((f) => f.path === 'omx-vocabulary.schema.json').text);
  assert.deepEqual(schema.$defs.ZZ_CODES['x-omx-texts'], { 'hosting.zz.gone': { text: { en: 'Gone: {what}', ca: 'Perdut: {what}' }, args: ['what'] } });
  const own = renderC(resolvedOf(texts((d) => { withText(d); }))).find((f) => f.path === 'omxcontract/clap_host_limits.h').text;
  assert.match(own, /_TEXT_EN "No contract directory at \{path\}"/);
  assert.match(own, /_TEXT_CA "No hi ha cap directori de contracte a \{path\}"/);
});
