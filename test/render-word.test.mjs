// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
// The render word (docs/render.md): an owner's file says how its own header spells its items, and the c render reads
// the word and names no item. Over a fixture package, so no owner's file is needed: the whole header byte for byte,
// one perturbation per word, `render --package`, and one refusal per rule.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, test } from 'node:test';
import { main } from '../bin/omx-contract.mjs';
import { SCHEMA_MAJOR, installedSchemaUrl, sha256 } from '../lib/contract-dir.mjs';
import { loadData, packageVersion, resolveData } from '../lib/data.mjs';
import { SCHEMA_VERSION, validateData } from '../lib/validate.mjs';
import { renderC } from '../render/c.mjs';
import { DATA, ROOT, UNION } from './helpers.mjs';

const SCRATCH = mkdtempSync(join(tmpdir(), 'omx-contract-render-'));
after(() => rmSync(SCRATCH, { recursive: true, force: true }));
let n = 0;

/** The fixture owner's file: a sheet and a codes item, and the word that spells them. */
const acme = () => ({
  $schema: '../schema/omx-contract.schema.json',
  render: {
    c: [{
      header: 'acme_limits.h',
      guard: 'ACME_LIMITS_H',
      project: 'acme-core',
      banner: ['Rendered from the acme declarations.', 'Re-render, never edit.'],
      brief: 'The limits and codes of the acme core.',
      includes: ['stddef.h'],
      numbers: { comment: 'the numbers the core reads', prefix: 'ACME_', omit: ['adapter*'], levels: '*Dbfs' },
      codes: { comment: 'the refusals the core returns', prefix: 'ACME_CODE_' },
    }],
    ts: { module: 'acme-core' },
  },
  ACME_LIMITS: {
    kind: 'sheet',
    doc: 'The acme core\'s numbers.',
    value: { queueDepth: 16, clampDbfs: 12, floorDbfs: -6.5, adapterRing: 64 },
    docs: { queueDepth: 'the records the queue holds' },
  },
  ACME_CODES: {
    kind: 'codes',
    doc: 'The acme core\'s refusals.',
    codes: { tooBig: { code: 'hosting.acme.too-big', doc: 'the input is too big' }, gone: { code: 'hosting.acme.gone' } },
  },
});

const FILE = 'data/acme.json';
const texts = (edit) => {
  const doc = acme();
  edit?.(doc, doc.render.c[0]);
  return { [FILE]: JSON.stringify(doc) };
};
const header = (edit) => renderC(resolveData(loadData(null, texts(edit))), { pkg: 'acme' }).find((f) => f.path === 'acme_limits.h')?.text;
const problems = (edit) => validateData(loadData(null, texts(edit))).map((p) => `${p.item}:${p.rule}:${p.message}`);

const EXPECTED = `/* SPDX-License-Identifier: GPL-3.0-or-later */
/*
 * This file is part of acme-core.
 *
 * acme-core is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * acme-core is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with acme-core.  If not, see <http://www.gnu.org/licenses/>.
 *
 * Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
 */

#ifndef ACME_LIMITS_H
#define ACME_LIMITS_H
/*
 * GENERATED: DO NOT EDIT BY HAND.
 * Rendered from the acme declarations.
 * Re-render, never edit.
 */

/** @file
 * @brief The limits and codes of the acme core. */

#include <stddef.h>

/** the numbers the core reads */
#define ACME_QUEUE_DEPTH 16u  ///< the records the queue holds
#define ACME_CLAMP_DBFS 12.0f
#define ACME_FLOOR_DBFS -6.5f

/** the refusals the core returns */
#define ACME_CODE_TOO_BIG "hosting.acme.too-big"  ///< the input is too big
#define ACME_CODE_GONE "hosting.acme.gone"

#endif /* ACME_LIMITS_H */
`;

test('the word renders the whole header, byte for byte, beside omx_contract_limits.h', () => {
  assert.equal(header(), EXPECTED);
  assert.equal(renderC(resolveData(loadData(null, texts()))).find((f) => f.path === 'omxcontract/acme_limits.h').text, EXPECTED);
  assert.deepEqual(problems(), []);
});

test('perturbation: every word of render.c moves the header', () => {
  const moved = (edit, re) => {
    const out = header(edit);
    assert.notEqual(out, EXPECTED);
    assert.match(out, re);
  };
  moved((d, c) => { c.guard = 'ACME_OTHER_H'; }, /^#ifndef ACME_OTHER_H\n#define ACME_OTHER_H$[\s\S]*^#endif \/\* ACME_OTHER_H \*\/$/m);
  moved((d, c) => { c.project = 'acme-host'; }, /^ \* This file is part of acme-host\.$/m);
  moved((d, c) => { c.brief = 'Another brief.'; }, /^ \* @brief Another brief\. \*\/$/m);
  moved((d, c) => { c.banner = ['One line only.']; }, /BY HAND\.\n \* One line only\.\n \*\/\n/);
  moved((d, c) => { c.includes = ['stdint.h', 'stddef.h']; }, /^#include <stdint\.h>\n#include <stddef\.h>\n\n/m);
  moved((d, c) => { delete c.includes; }, /@brief The limits and codes of the acme core\. \*\/\n\n\/\*\* the numbers/);
  moved((d, c) => { c.numbers.prefix = 'AC_'; }, /^#define AC_QUEUE_DEPTH 16u /m);
  moved((d, c) => { c.codes.prefix = 'AC_REFUSAL_'; }, /^#define AC_REFUSAL_GONE "hosting\.acme\.gone"$/m);
  moved((d, c) => { delete c.numbers.omit; }, /^#define ACME_ADAPTER_RING 64u$/m);
  moved((d, c) => { c.numbers.omit = ['*Depth']; }, /^#define ACME_CLAMP_DBFS 12\.0f\n#define ACME_FLOOR_DBFS -6\.5f\n#define ACME_ADAPTER_RING 64u$/m);
  moved((d, c) => { c.numbers.levels = 'clampDbfs'; d.ACME_LIMITS.value.floorDbfs = 6; }, /^#define ACME_FLOOR_DBFS 6u$/m);
  moved((d, c) => { c.numbers.comment = 'other numbers'; }, /^\/\*\* other numbers \*\/\n#define ACME_QUEUE_DEPTH/m);
  moved((d, c) => { delete c.codes; }, /^#define ACME_FLOOR_DBFS -6\.5f\n\n#endif/m);
  moved((d, c) => { c.scalars = { comment: 'as the contract spells them' }; }, /^\/\*\* as the contract spells them \*\/\n#define OMX_ACME_ADAPTER_RING 64\n#define OMX_ACME_CLAMP_DBFS 12\n/m);
  assert.ok(renderC(resolveData(loadData(null, texts((d, c) => { c.header = 'acme/limits.h'; })))).some((f) => f.path === 'omxcontract/acme/limits.h'), 'the header is where the word puts it');
  assert.equal(renderC(resolveData(loadData(null, texts((d, c) => { c.scalars = { comment: 'x' }; })))).some((f) => f.path === 'omxcontract/acme_limits.h'), false, 'a header of OMX_ names is not written twice by the whole read');
});

test('perturbation: a moved number, code or prose of the items moves the header', () => {
  assert.match(header((d) => { d.ACME_LIMITS.value.queueDepth = 32; }), /^#define ACME_QUEUE_DEPTH 32u /m);
  assert.match(header((d) => { d.ACME_CODES.codes.gone.code = 'hosting.acme.lost'; }), /^#define ACME_CODE_GONE "hosting\.acme\.lost"$/m);
  assert.match(header((d) => { d.ACME_LIMITS.docs.queueDepth = 'records'; }), /^#define ACME_QUEUE_DEPTH 16u {2}\/\/\/< records$/m);
});

test('refused, by rule: what the word cannot spell, and words the schema does not know', () => {
  const has = (edit, re) => assert.ok(problems(edit).some((p) => re.test(p)), `${re} in ${JSON.stringify(problems(edit))}`);
  has((d) => { delete d.ACME_CODES; }, /render-c:.*acme_limits\.h: a codes section with no codes item to render/);
  has((d) => { delete d.ACME_LIMITS; }, /render-c:.*acme_limits\.h: a numbers section with no sheet to render/);
  has((d, c) => { delete c.numbers.prefix; }, /schema:.*\/render\/c\/0\/numbers must have required property 'prefix'/);
  has((d, c) => { delete c.numbers; delete c.codes; }, /schema:.*\/render\/c\/0 must match a schema in anyOf/);
  has((d) => { d.ACME_LIMITS.value.queueDepth = 2.5; }, /render-c:.*ACME_LIMITS\.queueDepth is neither a level/);
  has((d) => { d.ACME_LIMITS.value.queueDepth = -1; }, /render-c:.*ACME_LIMITS\.queueDepth is neither a level/);
  has((d) => { d.ACME_LIMITS.docs.queueDepth = 'two\nlines'; }, /render-c:.*no one-line description/);
  has((d, c) => { c.lua = 'other'; }, /schema:.*\/render\/c\/0 must NOT have additional properties/);
  has((d, c) => { c.scope = 'world'; }, /schema:.*\/render\/c\/0\/scope must be equal to one of the allowed values/);
  has((d, c) => { delete c.project; }, /schema:.*must have required property 'project'/);
  has((d, c) => { c.banner = ['ends a comment */ here']; }, /schema:.*\/render\/c\/0\/banner\/0 must match pattern/);
  has((d) => { d.render.ts = {}; }, /schema:.*\/render\/ts must have required property 'module'/);
  has((d, c) => { delete c.guard; }, /schema:.*must have required property 'guard'/);
  has((d) => { d.render.lua = {}; }, /schema:.*\/render must NOT have additional properties/);
});

test('two files that declare one header are refused, naming both', () => {
  const t = { ...texts(), 'data/acme2.json': JSON.stringify({ ...acme(), ACME_LIMITS: undefined, ACME_CODES: undefined, ACME2_LIMITS: { kind: 'sheet', doc: 'more', value: { depth: 1 } } }) };
  const probs = validateData(loadData(null, t)).map((p) => `${p.rule}:${p.message}`);
  assert.ok(probs.some((p) => /^render-c:data\/acme2\.json and data\/acme\.json both declare the header acme_limits\.h$/.test(p)), JSON.stringify(probs));
});

/** A contract directory: omx-contract's data/ as installed, and the package acme holding the fixture file. */
function directory() {
  const root = join(SCRATCH, `cd-${n++}`);
  execFileSync('sh', [join(ROOT, 'tools/install-contract-dir.sh'), '-x', 'codes.json', 'omx-contract', packageVersion(ROOT), String(SCHEMA_MAJOR), DATA, root, 'data'], { stdio: 'ignore' });
  const dir = join(root, String(SCHEMA_MAJOR), 'acme');
  const doc = { ...acme(), $schema: installedSchemaUrl(SCHEMA_MAJOR), requires: { 'omx-contract-schema': `>= ${SCHEMA_VERSION}` } };
  const text = `${JSON.stringify(doc, null, 2)}\n`;
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'acme.json'), text);
  writeFileSync(join(dir, 'MANIFEST.json'), JSON.stringify({ package: 'acme', version: '1.2.3', schemaMajor: SCHEMA_MAJOR, tree: 'data', files: { 'acme.json': sha256(Buffer.from(text)) } }));
  return root;
}

const quiet = (fn) => {
  const { log, error } = console;
  console.log = () => {};
  console.error = () => {};
  try { return fn(); } finally { console.log = log; console.error = error; }
};

test('render --package: the owner renders only its own headers, at their own paths; --check holds them, the rest of its tree aside', async () => {
  const root = directory();
  const out = join(SCRATCH, `out-${n++}`);
  assert.equal(quiet(() => main(['render', '--target', 'c', '--contract-dir', root, '--package', 'acme', '--out', out])), 0);
  assert.deepEqual(readdirSync(out), ['acme_limits.h'], 'one header, no omx_contract_limits.h');
  assert.equal(readFileSync(join(out, 'acme_limits.h'), 'utf8'), EXPECTED);
  writeFileSync(join(out, 'acme.c'), 'int acme;\n');
  assert.equal(quiet(() => main(['render', '--target', 'c', '--contract-dir', root, '--package', 'acme', '--out', out, '--check'])), 0, 'the owner\'s other files are not extra');
  writeFileSync(join(out, 'acme_limits.h'), EXPECTED.replace('16u', '17u'));
  assert.equal(quiet(() => main(['render', '--target', 'c', '--contract-dir', root, '--package', 'acme', '--out', out, '--check'])), 1, 'an edited header is red');
  assert.equal(quiet(() => main(['render', '--target', 'c', '--contract-dir', root, '--package', 'omx-contract', '--out', join(SCRATCH, `none-${n++}`)])), 0);
  assert.equal(quiet(() => main(['render', '--target', 'c', '--contract-dir', root, '--package', 'nobody', '--out', out])), 2, 'a package that is not installed is a usage error');
  assert.equal(quiet(() => main(['render', '--target', 'json', '--contract-dir', root, '--package', 'acme', '--out', out])), 2, 'json is the whole read');
  const ts = join(SCRATCH, `ts-${n++}`);
  assert.equal(quiet(() => main(['render', '--target', 'ts', '--contract-dir', root, '--package', 'acme', '--out', ts])), 0);
  assert.deepEqual(readdirSync(ts).sort(), ['acme-core.d.ts', 'acme-core.js'], 'the module the word names');
  const js = readFileSync(join(ts, 'acme-core.js'), 'utf8');
  assert.match(js, /^\/\/ GENERATED by `omx-contract render --target ts --package acme` from acme's data\/acme\.json, do not edit\.$/m);
  assert.match(js, /^export const ACME_LIMITS = /m);
  assert.doesNotMatch(js, /STANDARD_SAMPLE_RATES/, 'only the file\'s items');
  const mod = await import(`file://${join(ts, 'acme-core.js')}`);
  assert.deepEqual(Object.keys(mod).sort(), ['ACME_CODES', 'ACME_LIMITS']);
  assert.equal(mod.ACME_LIMITS.queueDepth, 16);
  const whole = join(SCRATCH, `whole-${n++}`);
  assert.equal(quiet(() => main(['render', '--target', 'c', '--contract-dir', root, '--out', whole])), 0);
  assert.equal(readFileSync(join(whole, 'omxcontract/acme_limits.h'), 'utf8'), EXPECTED, 'the whole read places it beside omx_contract_limits.h');
  assert.match(readFileSync(join(whole, 'omxcontract/omx_contract_limits.h'), 'utf8'), /^#define OMX_ACME_QUEUE_DEPTH 16$/m, 'and its numbers are items like any other');
});

test('a data directory is the package it is rendered for: an owner renders from its own tree', () => {
  const dir = join(SCRATCH, `tree-${n++}`);
  mkdirSync(join(dir, 'data'), { recursive: true });
  mkdirSync(join(dir, 'schema'));
  writeFileSync(join(dir, 'schema/omx-contract.schema.json'), readFileSync(join(ROOT, 'schema/omx-contract.schema.json')));
  writeFileSync(join(dir, FILE), `${JSON.stringify(acme(), null, 2)}\n`);
  const out = join(dir, 'src');
  mkdirSync(dirname(join(out, 'x')), { recursive: true });
  assert.equal(quiet(() => main(['render', '--target', 'c', '--data', join(dir, 'data'), '--package', 'acme', '--out', out])), 0);
  assert.equal(readFileSync(join(out, 'acme_limits.h'), 'utf8'), EXPECTED);
});

test('the tool names no item an owner installs: the owner\'s file is the only place its spelling and its rules live', () => {
  // The console engine's renderer, moved unchanged, writes the frozen header of the round-trip proof: its prose is that
  // header's bytes (tools/proof/round-trip.mjs), not a rule of the tool.
  const FROZEN = 'render/c/contract-limits-render.mjs';
  const sources = ['lib', 'render', 'render/c', 'bin'].flatMap((d) => readdirSync(join(ROOT, d)).filter((f) => f.endsWith('.mjs')).map((f) => [`${d}/${f}`, readFileSync(join(ROOT, d, f), 'utf8')]))
    .filter(([file]) => file !== FROZEN);
  const own = new Set(loadData(DATA).items.keys());
  const owned = [...loadData(UNION).items.keys()].filter((n) => !own.has(n));
  assert.ok(owned.includes('HOSTED_STAGE_LIMITS') && owned.includes('GATE_LIMITS'), 'positive control: the owners\' items');
  const named = owned.filter((name) => sources.some(([, text]) => new RegExp(`\\b${name}\\b`).test(text)));
  // The default EQ rule, the EQ band counts' rule and the band budget were the last (#1841): the rule left for omx-dsp,
  // the counts are the generic count and sheet-default rules, the budget a check its owner declares (docs/contract-dir.md).
  assert.deepEqual(named, [], 'no rule, render or comment of the tool names an owner\'s item');
});

/** An owner's data directory: a kernel, a sheet, and the file that carries its omx-style word. */
const omxOwner = (edit) => {
  const word = { $schema: '../schema/omx-contract.schema.json', render: { c: [{ header: 'acme/acme_definitions.h', guard: 'ACME_DEFINITIONS_H', project: 'acme', banner: ['Rendered from acme\'s definitions.', 'Re-render, never edit.'], brief: 'The acme definitions.', includes: ['math.h'], scope: 'package', limits: {} }] } };
  const t = {
    'data/render.json': word,
    'data/kernels/acme.json': {
      $schema: '../../schema/omx-contract.schema.json',
      controls: [{ name: 'gain', kind: 'travel', doc: 'the gain', travel: { min: -12, max: 12, unit: 'dB', default: 0 } }],
      readouts: [{ name: 'level', doc: 'the level', unit: 'dBFS', min: -60, max: 0, scale: 'linear', rateHz: 30 }],
    },
    'data/acme-sheet.json': { $schema: '../schema/omx-contract.schema.json', ACME_TABLE_LIMITS: { kind: 'travels', doc: 'a table', fields: { ratio: { min: 1, max: 20, default: 4 } } } },
  };
  edit?.(t, word.render.c[0]);
  return Object.fromEntries(Object.entries(t).map(([k, v]) => [k, JSON.stringify(v)]));
};

test('a package-scope limits header frames the OMX_* defines of every item of its package, as the whole read spells them', () => {
  const t = omxOwner();
  const scales = JSON.stringify({ $schema: '../schema/omx-contract.schema.json', PARAM_SCALES: JSON.parse(readFileSync(join(DATA, 'primitives.json'), 'utf8')).PARAM_SCALES });
  const r = resolveData(loadData(null, { ...t, 'data/primitives.json': scales }));
  const [own] = renderC(r, { pkg: 'acme' });
  assert.equal(own.path, 'acme/acme_definitions.h');
  const lines = own.text.split('\n');
  assert.deepEqual(lines.slice(19, 33), [
    '', '#ifndef ACME_DEFINITIONS_H', '#define ACME_DEFINITIONS_H', '/*', ' * GENERATED: DO NOT EDIT BY HAND.',
    ' * Rendered from acme\'s definitions.', ' * Re-render, never edit.', ' */', '', '/** @file', ' * @brief The acme definitions. */', '',
    '#include <math.h>', '',
  ]);
  assert.match(lines[33], /^\/\* Per-parameter numeric travel/, 'the sections of omx_contract_limits.h, each under its own comment');
  assert.match(own.text, /\n#endif \/\* ACME_DEFINITIONS_H \*\/\n$/);
  const defines = lines.filter((l) => l.startsWith('#define OMX_'));
  assert.deepEqual(defines.filter((l) => / OMX_ACME_(TABLE_RATIO|GAIN_RANGE)_(MIN|MAX|DEFAULT) /.test(`${l} `)).length, 6, 'the table and the travel');
  assert.ok(defines.includes('#define OMX_ACME_READOUT_LEVEL_RATE_HZ 30'), 'the kernel\'s readouts');
  const whole = renderC(r).find((f) => f.path === 'omxcontract/omx_contract_limits.h').text.split('\n');
  for (const d of defines) assert.ok(whole.includes(d), `${d} is the whole read's line`);
  assert.ok(defines.includes('#define OMX_PARAM_SCALES_COUNT 3u'), 'a data directory is one package: every item of it, the scales beside the kernel included');
  assert.equal(renderC(r).some((f) => f.path.includes('acme_definitions')), false, 'the whole read holds these defines in omx_contract_limits.h, not twice');
});

test('a package-scope header is cut to its package in a contract directory', () => {
  const root = join(SCRATCH, `cd-${n++}`);
  execFileSync('sh', [join(ROOT, 'tools/install-contract-dir.sh'), '-x', 'codes.json', 'omx-contract', packageVersion(ROOT), String(SCHEMA_MAJOR), DATA, root, 'data'], { stdio: 'ignore' });
  const dir = join(root, String(SCHEMA_MAJOR), 'acme');
  const files = {};
  for (const [rel, text] of Object.entries(omxOwner())) {
    const doc = { ...JSON.parse(text), $schema: installedSchemaUrl(SCHEMA_MAJOR), requires: { 'omx-contract-schema': `>= ${SCHEMA_VERSION}` } };
    const body = `${JSON.stringify(doc, null, 2)}\n`;
    const r = rel.slice('data/'.length);
    mkdirSync(dirname(join(dir, r)), { recursive: true });
    writeFileSync(join(dir, r), body);
    files[r] = sha256(Buffer.from(body));
  }
  writeFileSync(join(dir, 'MANIFEST.json'), JSON.stringify({ package: 'acme', version: '1.0.0', schemaMajor: SCHEMA_MAJOR, tree: 'data', files }));
  const out = join(SCRATCH, `omx-${n++}`);
  assert.equal(quiet(() => main(['render', '--target', 'c', '--contract-dir', root, '--package', 'acme', '--out', out])), 0);
  const h = readFileSync(join(out, 'acme/acme_definitions.h'), 'utf8');
  assert.match(h, /^#define OMX_ACME_TABLE_RATIO_MAX 20\.0f$/m);
  assert.doesNotMatch(h, /^#define OMX_(STANDARD_SAMPLE_RATES|PARAM_SCALES|DECLARED_RATE)/m, 'omx-contract\'s items stay in its own header');
  const two = omxOwner((t) => { t['data/render2.json'] = t['data/render.json']; });
  assert.ok(validateData(loadData(null, two)).some((p) => p.rule === 'render-c' && /both declare the header acme\/acme_definitions\.h/.test(p.message)), 'one header, one declaration');
});
