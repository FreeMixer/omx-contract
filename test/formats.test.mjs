// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
// The format identifiers (render/formats.mjs): the CLAP identifiers and numbers and the LV2 namespaces a consumer
// used to type by hand are rendered to C, ts and py from the mapped terms, and the one validate() is exported.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { loadData, resolveData } from '../lib/data.mjs';
import { validate } from '../lib/schema-validate.mjs';
import { renderFormatsHeader, renderFormatsPy } from '../render/formats.mjs';
import { renderC } from '../render/c.mjs';
import { renderTs } from '../render/ts.mjs';
import { DATA, ROOT, editData, scratchData, scratchDir } from './helpers.mjs';

const own = () => resolveData(loadData(DATA));
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');
const scratch = (edit) => { const d = scratchData(); edit && editData(d, 'formats/clap/ext/remote-controls.json', edit); return resolveData(loadData(d)); };

test('golden: omx_formats.h and omx_contract.py are the render of data/formats/', () => {
  assert.equal(renderFormatsHeader(own()), read('include/omxcontract/omx_formats.h'));
  assert.equal(renderFormatsPy(own()), read('share/omx-contract/omx_contract.py'));
});

test('the remote controls page size is the number 8, in C, ts and py', async () => {
  assert.match(renderFormatsHeader(own()), /^#define OMX_CLAP_REMOTE_CONTROLS_COUNT 8u$/m);
  assert.match(renderFormatsPy(own()), /^ {4}"CLAP_REMOTE_CONTROLS_COUNT": 8,$/m);
  const dir = scratchDir('omx-formats-');
  for (const f of renderTs(own())) writeFileSync(join(dir, f.path), f.text);
  const mod = await import(pathToFileURL(join(dir, 'omx-contract.js')).href);
  assert.equal(mod.CLAP_NUMBERS.CLAP_REMOTE_CONTROLS_COUNT, 8);
  assert.equal(mod.CLAP_IDS.CLAP_EXT_REMOTE_CONTROLS, 'clap.remote-controls/2');
  assert.equal(mod.LV2_NAMESPACES.CORE, 'http://lv2plug.in/ns/lv2core#');
  assert.equal(mod.LV2_SPECIFICATIONS.PORT_PROPS, 'http://lv2plug.in/ns/ext/port-props');
});

test('sabotage: the page size changed in the data changes every render, so a stale golden goes red', () => {
  const r = scratch((d) => { d.CLAP_EXT_REMOTE_CONTROLS_TERMS.terms.remoteControlsCount.value = 9; });
  assert.match(renderFormatsHeader(r), /OMX_CLAP_REMOTE_CONTROLS_COUNT 9u/);
  assert.notEqual(renderFormatsHeader(r), read('include/omxcontract/omx_formats.h'));
  assert.notEqual(renderFormatsPy(r), read('share/omx-contract/omx_contract.py'));
});

test('every namespace is its specification and a #, and every term of it is written after it', () => {
  const lv2 = [...own().values()].filter((r) => r.kind === 'terms' && r.format === 'lv2');
  assert.ok(lv2.length > 20, 'the scan found the LV2 specifications');
  for (const r of lv2) for (const [n, t] of Object.entries(r.value)) assert.ok(t.uri === r.spec || t.uri.startsWith(`${r.spec}#`), `${r.name} ${n}`);
});

test('the identifiers are unique: no define twice, no key twice', () => {
  const h = renderFormatsHeader(own());
  const names = [...h.matchAll(/^#define (OMX_\w+) /gm)].map((m) => m[1]);
  assert.ok(names.length > 100);
  assert.equal(new Set(names).size, names.length);
  const all = renderC(own()).filter((f) => f.path !== 'omxcontract/omx_formats.h').map((f) => f.text).join('\n');
  for (const n of names) assert.ok(!new RegExp(`^#define ${n}[ (]`, 'm').test(all), `${n} is defined by another header too`);
});

const cc = (process.env.CC ?? 'cc').split(' ');
test('the header compiles, and a C reader sees the values and walks the list', { skip: spawnSync(cc[0], [...cc.slice(1), '--version']).status !== 0 && 'no cc' }, () => {
  const dir = scratchDir('omx-formats-c-');
  writeFileSync(join(dir, 't.c'), `#include <stdio.h>
#include <string.h>
#include <omxcontract/omx_formats.h>
static int n;
#define COUNT(id, v) n += (strncmp(id, "CLAP_", 5) == 0 && v[0] != 0);
int main(void) {
  OMX_CLAP_IDS(COUNT)
  return (strcmp(OMX_CLAP_EXT_REMOTE_CONTROLS, "clap.remote-controls/2") == 0 && OMX_CLAP_REMOTE_CONTROLS_COUNT == 8u
          && strcmp(OMX_LV2_NS_CORE, "http://lv2plug.in/ns/lv2core#") == 0 && n > 100) ? 0 : 1;
}
`);
  const build = spawnSync(cc[0], [...cc.slice(1), '-std=c11', '-Wall', '-Wextra', '-Werror', '-I', join(ROOT, 'include'), join(dir, 't.c'), '-o', join(dir, 't')], { encoding: 'utf8' });
  assert.equal(build.status, 0, build.stderr);
  assert.equal(spawnSync(join(dir, 't')).status, 0);
});

test('the py render runs and holds the values', { skip: spawnSync('python3', ['--version']).status !== 0 && 'no python3' }, () => {
  const r = spawnSync('python3', ['-I', '-c', `import runpy; m = runpy.run_path(${JSON.stringify(join(ROOT, 'share/omx-contract/omx_contract.py'))}); import sys; sys.exit(0 if m["CLAP_NUMBERS"]["CLAP_REMOTE_CONTROLS_COUNT"] == 8 and m["LV2_NAMESPACES"]["CORE"].endswith("lv2core#") else 1)`]);
  assert.equal(r.status, 0, String(r.stderr));
});

test('render --target py --check: the committed module is the render, and drift is named', () => {
  const run = (...a) => spawnSync('node', [join(ROOT, 'bin/omx-contract.mjs'), 'render', '--target', 'py', '--out', ...a], { encoding: 'utf8' });
  assert.equal(run(join(ROOT, 'share/omx-contract'), '--check').status, 0);
  const dir = scratchDir('omx-py-');
  writeFileSync(join(dir, 'omx_contract.py'), `${read('share/omx-contract/omx_contract.py')}# drift\n`);
  const bad = run(dir, '--check');
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /omx_contract\.py differs/);
});

const SCHEMA = { $schema: 'https://json-schema.org/draft/2020-12/schema', type: 'object', required: ['name'], additionalProperties: false, properties: { name: { type: 'string', pattern: '^[a-z]+$' }, n: { type: ['integer', 'null'] } } };

test('validate(schema, doc): ok for a document that conforms, every refusal listed with its path and keyword', () => {
  assert.deepEqual(validate(SCHEMA, { name: 'abc', n: null }), { ok: true, errors: [] });
  const r = validate(SCHEMA, { name: 'A1', extra: 1 });
  assert.equal(r.ok, false);
  assert.deepEqual(r.errors.map((e) => `${e.path || '/'}:${e.code}`).sort(), ['/:additionalProperties', '/name:pattern']);
  assert.deepEqual(validate(SCHEMA, {}).errors.map((e) => e.code), ['required']);
});

test('validate: a misspelt keyword in the schema throws instead of passing everything, and a schema is compiled once', () => {
  assert.throws(() => validate({ type: 'object', requird: ['x'] }, {}), /strict mode|unknown keyword/i);
  assert.equal(validate(SCHEMA, { name: 'a' }).ok, validate(SCHEMA, { name: 'b' }).ok);
});

test('validate is exported as @openmixer/omx-contract/validate and reads the contract\'s own schema', async () => {
  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.exports['./validate'], './lib/schema-validate.mjs');
  const { validate: v } = await import(pathToFileURL(join(ROOT, pkg.exports['./validate'])).href);
  const schema = JSON.parse(read('schema/omx-contract.schema.json'));
  assert.equal(v(schema, { SOME: { kind: 'nonsense' } }).ok, false);
  assert.equal(v(schema, JSON.parse(read('data/rates.json'))).ok, true);
});
