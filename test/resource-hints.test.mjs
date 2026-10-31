// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
/**
 * The resource hints (docs/resource-hints.md): each carrier held equal to the declaration, RESOURCE_HINTS of
 * data/resource-profile.json read as plain JSON, with a sabotage per carrier. A checker returns its problems; the
 * carriers must give none, and the same checker must name the break in a carrier changed by one word, one type, one
 * bit or one property. The renderer was sabotaged too (a swapped bit, a wrong type, a lost property, each seen red,
 * restored); the committed files are held to a fresh render.
 */
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { loadData, resolveData } from '../lib/data.mjs';
import { renderC } from '../render/c.mjs';
import { renderLv2 } from '../render/hints.mjs';
import { renderJson } from '../render/json.mjs';
import { renderTs } from '../render/ts.mjs';
import { DATA, ROOT, texts } from './helpers.mjs';
import { validateData } from '../lib/validate.mjs';

const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const R = 'data/resource-profile.json';
const DECL = JSON.parse(read(R)).RESOURCE_HINTS;
const HINTS = Object.entries(DECL.words);
const dirs = [];
// What the declaration's units mean in each carrier, written out here and not read from the renderer's table, so the
// renderer's table is held to something.
const HINT_UNITS = { bytes: { c: 'uint64_t', xsd: 'integer' }, count: { c: 'uint32_t', xsd: 'integer' }, ms: { c: 'uint32_t', xsd: 'integer' }, flag: { c: 'bool', xsd: 'boolean' } };
const constOf = (key) => key.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toUpperCase();
const memberOf = (word) => word.replace(/-/g, '_');
after(() => dirs.forEach((d) => rmSync(d, { recursive: true, force: true })));

test('the declaration is what the issue wants: a resource, a unit and a basis per hint, the two carriers named', () => {
  assert.equal(HINTS.length, 7);
  assert.equal(DECL.extension.clap, 'org.openmixer.resource-hints.draft/0');
  assert.equal(DECL.extension.lv2.prefix, 'omxres');
  for (const [k, w] of HINTS) {
    assert.ok(w.group && w.figureUnit && w.basis, `${k} states its resource, unit and basis`);
    assert.ok(Object.hasOwn(HINT_UNITS, w.figureUnit), `${k}: ${w.figureUnit} has a carrier type`);
  }
});

// ---- the CLAP header

/** The problems of a C header against the declaration: the id, the bit and member of each hint, in order, typed. */
export function checkHeader(text) {
  const bad = [];
  const id = /#define OMX_CLAP_EXT_RESOURCE_HINTS_DRAFT "([^"]*)"/.exec(text)?.[1];
  if (id !== DECL.extension.clap) bad.push(`the extension id is ${id}, the declaration says ${DECL.extension.clap}`);
  const bits = [...text.matchAll(/#define OMX_RESOURCE_HINT_([A-Z0-9_]+) \(1u << (\d+)\)/g)].map((m) => [m[1], Number(m[2])]);
  if (bits.length !== HINTS.length) bad.push(`${bits.length} bits for ${HINTS.length} hints`);
  HINTS.forEach(([k], i) => { if (bits[i]?.[0] !== constOf(k) || bits[i]?.[1] !== i) bad.push(`bit ${i} is ${bits[i]?.join('<<')}, the declaration says ${constOf(k)}<<${i}`); });
  const count = /#define OMX_RESOURCE_HINT_COUNT (\d+)u/.exec(text)?.[1];
  if (Number(count) !== HINTS.length) bad.push(`OMX_RESOURCE_HINT_COUNT is ${count}`);
  const body = /typedef struct omx_resource_hints\s*\{([\s\S]*?)\}\s*omx_resource_hints_t;/.exec(text)?.[1] ?? '';
  const members = [...body.matchAll(/^\s*(\w+) (\w+);/gm)].map((m) => [m[1], m[2]]);
  if (members[0]?.join(' ') !== 'uint32_t declared') bad.push(`the first member is ${members[0]?.join(' ')}, not uint32_t declared`);
  HINTS.forEach(([, w], i) => {
    const want = [HINT_UNITS[w.figureUnit].c, memberOf(w.word)].join(' ');
    if (members[i + 1]?.join(' ') !== want) bad.push(`member ${i + 1} is ${members[i + 1]?.join(' ')}, the declaration says ${want}`);
  });
  if (members.length !== HINTS.length + 1) bad.push(`${members.length} members for ${HINTS.length} hints and the mask`);
  return bad;
}

const headerText = () => read('include/omxcontract/omx_resource_hints.h');

test('the CLAP header is the declaration', () => {
  assert.deepEqual(checkHeader(headerText()), []);
});

test('sabotage: a swapped bit, a changed id, a wrong type, a lost member and a changed count are each named', () => {
  const h = headerText();
  const swap = h.replace('OMX_RESOURCE_HINT_FOOTPRINT_AT_REST (1u << 0)', 'OMX_RESOURCE_HINT_FOOTPRINT_AT_REST (1u << 1)');
  assert.ok(checkHeader(swap).length > 0, 'a bit moved');
  assert.ok(checkHeader(h.replace('RESOURCE_HINTS_DRAFT "org.openmixer.resource-hints.draft/0"', 'RESOURCE_HINTS_DRAFT "org.openmixer.resource-hints.draft/1"')).length > 0, 'the id changed');
  assert.ok(checkHeader(h.replace('uint64_t footprint_at_rest', 'uint32_t footprint_at_rest')).length > 0, 'a type narrowed');
  assert.ok(checkHeader(h.replace(/ {4}bool opens_sockets;.*\n/, '')).length > 0, 'a member lost');
  assert.ok(checkHeader(h.replace('OMX_RESOURCE_HINT_COUNT 7u', 'OMX_RESOURCE_HINT_COUNT 6u')).length > 0, 'the count changed');
});

test('the header compiles as C and as C++, and its mask and members hold what the declaration counts', () => {
  const dir = mkdtempSync(join(tmpdir(), 'omx-hints-'));
  dirs.push(dir);
  const src = join(dir, 'h.c');
  writeFileSync(src, `#include <omxcontract/omx_resource_hints.h>
#include <stddef.h>
_Static_assert(OMX_RESOURCE_HINT_COUNT == ${HINTS.length}, "count");
_Static_assert(OMX_RESOURCE_HINT_${constOf(HINTS[HINTS.length - 1][0])} == (1u << ${HINTS.length - 1}), "last bit");
int main(void) { omx_resource_hints_t h = {0}; return (int)(h.declared + sizeof(omx_clap_plugin_resource_hints_t) * 0); }
`);
  execFileSync('cc', ['-std=c11', '-Wall', '-Wextra', '-Werror', `-I${join(ROOT, 'include')}`, src, '-o', join(dir, 'h')]);
  assert.equal(spawnSync(join(dir, 'h')).status, 0);
  writeFileSync(join(dir, 'h.cpp'), `#include <omxcontract/omx_resource_hints.h>\nint main() { omx_resource_hints_t h = {}; return (int)h.declared; }\n`);
  execFileSync('c++', ['-std=c++17', '-Wall', '-Wextra', '-Werror', `-I${join(ROOT, 'include')}`, join(dir, 'h.cpp'), '-o', join(dir, 'hpp')]);
  // the negative control: a header with the count altered fails the same compile
  writeFileSync(join(dir, 'bad.c'), `#include <omxcontract/omx_resource_hints.h>\n_Static_assert(OMX_RESOURCE_HINT_COUNT == ${HINTS.length + 1}, "count");\nint main(void) { return 0; }\n`);
  assert.notEqual(spawnSync('cc', ['-std=c11', `-I${join(ROOT, 'include')}`, join(dir, 'bad.c'), '-o', join(dir, 'bad')]).status, 0);
});

// ---- the LV2 Turtle

/** The triples of the Turtle by property: `{ key: { label, range, resource, unit, basis } }`, read by a small reader of the generated shape. */
function readTurtle(text) {
  const ns = /@prefix (\w+): <([^>]*)> \./.exec(text.replace(/@prefix (?!omxres)\w+:.*\n/g, ''));
  const props = {};
  for (const block of text.split(/\n\n/)) {
    const m = /^(\w+):(\w+)\n/.exec(block);
    if (!m || !/rdf:Property/.test(block)) continue;
    const get = (p) => new RegExp(`${p} (?:"((?:[^"\\\\]|\\\\.)*)"|xsd:(\\w+))`).exec(block);
    props[m[2]] = {
      prefix: m[1], label: get('rdfs:label')?.[1], range: get('rdfs:range')?.[2],
      resource: get(`${m[1]}:resource`)?.[1], unit: get(`${m[1]}:unit`)?.[1], basis: get(`${m[1]}:basis`)?.[1],
    };
  }
  return { prefix: ns?.[1], namespace: ns?.[2], props };
}

/** The problems of the Turtle against the declaration. */
export function checkTurtle(text) {
  const bad = [];
  const t = readTurtle(text);
  const { prefix, namespace } = DECL.extension.lv2;
  if (t.prefix !== prefix || t.namespace !== namespace) bad.push(`the prefix is ${t.prefix}: <${t.namespace}>, the declaration says ${prefix}: <${namespace}>`);
  const keys = Object.keys(t.props);
  if (keys.join() !== HINTS.map(([k]) => k).join()) bad.push(`the properties are ${keys.join(', ')}, the declaration says ${HINTS.map(([k]) => k).join(', ')}`);
  for (const [k, w] of HINTS) {
    const p = t.props[k];
    if (!p) continue;
    const want = { prefix, label: w.word, range: HINT_UNITS[w.figureUnit].xsd, resource: w.group, unit: w.figureUnit, basis: w.basis };
    for (const f of Object.keys(want)) if (p[f] !== want[f]) bad.push(`${k}.${f} is ${p[f]}, the declaration says ${want[f]}`);
  }
  return bad;
}

const turtleText = () => read('share/omx-contract/omx-resource-hints.ttl');

test('the LV2 Turtle is the declaration', () => {
  assert.deepEqual(checkTurtle(turtleText()), []);
});

test('the LV2 Turtle parses as Turtle where a parser is installed, and links the LV2 terms of its resources', () => {
  const dir = mkdtempSync(join(tmpdir(), 'omx-ttl-'));
  dirs.push(dir);
  writeFileSync(join(dir, 'h.ttl'), turtleText());
  const serdi = spawnSync('serdi', ['-i', 'turtle', '-o', 'ntriples', join(dir, 'h.ttl')], { encoding: 'utf8' });
  if (serdi.error?.code === 'ENOENT') return;   // no serdi on this machine: the reader above is the check
  assert.equal(serdi.status, 0, serdi.stderr);
  const lines = serdi.stdout.trim().split('\n');
  const ns = DECL.extension.lv2.namespace;
  for (const [k, w] of HINTS) {
    assert.ok(lines.some((l) => l.startsWith(`<${ns}${k}> <http://www.w3.org/2000/01/rdf-schema#range>`)), `${k} has a range`);
    assert.ok(lines.some((l) => l.startsWith(`<${ns}${k}> <${ns}basis> "${w.basis}"`)), `${k} has its basis`);
  }
  // the negative control: a stray character is a parse error, so the status above is not vacuous
  writeFileSync(join(dir, 'bad.ttl'), `${turtleText()}\nomxres:x a .\n`);
  assert.notEqual(spawnSync('serdi', ['-i', 'turtle', '-o', 'ntriples', join(dir, 'bad.ttl')]).status, 0);
});

test('every term of the Turtle has a label, and no range is a datatype lilv does not know (#144)', () => {
  const t = turtleText();
  const terms = t.split(/\n\n/).filter((b) => /^omxres:\w+\n/.test(b));
  assert.equal(terms.length, 3 + HINTS.length);
  for (const b of terms) assert.match(b, /rdfs:label "[^"]+" ;/, b.split('\n')[0]);
  // lilv reads xsd:integer and xsd:boolean; it logs "Unknown datatype" for xsd:unsignedLong and xsd:unsignedInt
  assert.deepEqual([...new Set([...t.matchAll(/rdfs:range xsd:(\w+)/g)].map((m) => m[1]))].sort(), ['boolean', 'integer']);
  assert.doesNotMatch(t, /unsigned/);
  assert.doesNotMatch(t.replace('xsd:integer', ''), /rdfs:label ""/);
});

test('sord_validate finds nothing to say about the hints vocabulary, where it is installed', () => {
  const lv2 = ['/usr/lib64/lv2', '/usr/lib/lv2', '/usr/local/lib/lv2'].find((d) => existsSync(join(d, 'core.lv2')) && existsSync(join(d, 'schemas.lv2')));
  const probe = spawnSync('sord_validate', [], { encoding: 'utf8' });
  if (!lv2 || probe.error?.code === 'ENOENT') return;
  const files = [...readdirSync(join(lv2, 'schemas.lv2')).filter((f) => f.endsWith('.ttl') && f !== 'manifest.ttl').map((f) => join(lv2, 'schemas.lv2', f)),
    ...readdirSync(join(lv2, 'core.lv2')).filter((f) => f.endsWith('.ttl') && f !== 'manifest.ttl').map((f) => join(lv2, 'core.lv2', f)), join(ROOT, 'share/omx-contract/omx-resource-hints.ttl')];
  const out = spawnSync('sord_validate', files, { encoding: 'utf8' });
  const ours = out.stderr.split(/\n(?=error|warning)/).filter((e) => e.includes('openmixer.org/ns/resource-hints'));
  assert.deepEqual(ours, []);
  // the control: the validator does read the file, so a term without a label is named
  const bad = join(mkdtempSync(join(tmpdir(), 'omx-ttl-')), 'bad.ttl');
  dirs.push(dirname(bad));
  writeFileSync(bad, turtleText().replace(/ {4}rdfs:label "resource" ;\n/, ''));
  const control = spawnSync('sord_validate', [...files.slice(0, -1), bad], { encoding: 'utf8' });
  assert.match(control.stderr, /resource-hints#resource> has no label/);
});

test('sabotage: a lost property, a changed range, a changed unit and a changed namespace are each named', () => {
  const t = turtleText();
  assert.ok(checkTurtle(t.replace(/omxres:opensSockets\n[\s\S]*?basis "declared" \.\n\n/, '')).length > 0, 'a property lost');
  assert.ok(checkTurtle(t.replace('xsd:integer', 'xsd:decimal')).length > 0, 'a range changed');
  assert.ok(checkTurtle(t.replace('omxres:unit "ms"', 'omxres:unit "s"')).length > 0, 'a unit changed');
  assert.ok(checkTurtle(t.replace(/(@prefix omxres: <)[^>]*/, '$1https://example.org/x#')).length > 0, 'the namespace changed');
});

// ---- TypeScript and JSON

/** The problems of the ts module's RESOURCE_HINTS and RESOURCE_HINTS_WORDS against the declaration. */
export function checkTs(mod) {
  const bad = [];
  if (JSON.stringify(mod.RESOURCE_HINTS_WORDS) !== JSON.stringify(HINTS.map(([, w]) => w.word))) bad.push('RESOURCE_HINTS_WORDS differs from the declared words');
  for (const [k, w] of HINTS) {
    const g = mod.RESOURCE_HINTS?.[k];
    for (const f of ['word', 'group', 'figureUnit', 'basis']) if (g?.[f] !== w[f]) bad.push(`RESOURCE_HINTS.${k}.${f} is ${g?.[f]}, the declaration says ${w[f]}`);
  }
  if (Object.keys(mod.RESOURCE_HINTS ?? {}).join() !== HINTS.map(([k]) => k).join()) bad.push('RESOURCE_HINTS names other hints');
  return bad;
}

/** The problems of the json render (omx-contract.json and the vocabulary schema fragment) against the declaration. */
export function checkJson(resolvedJson, vocabularySchema) {
  const bad = [];
  const item = resolvedJson.items?.RESOURCE_HINTS;
  if (JSON.stringify(item?.extension) !== JSON.stringify(DECL.extension)) bad.push('the extension differs');
  if (Object.keys(item?.value ?? {}).join() !== HINTS.map(([k]) => k).join()) bad.push('the hints differ');
  for (const [k, w] of HINTS) for (const f of ['word', 'group', 'figureUnit', 'basis']) if (item?.value?.[k]?.[f] !== w[f]) bad.push(`${k}.${f} differs`);
  if (JSON.stringify(vocabularySchema.$defs?.RESOURCE_HINTS?.enum) !== JSON.stringify(HINTS.map(([, w]) => w.word))) bad.push('the schema enum differs');
  return bad;
}

const tsModule = () => import(pathToFileURL(join(ROOT, 'test/golden/ts/omx-contract.js')).href);
const jsonFiles = () => [JSON.parse(read('share/omx-contract/omx-contract.json')), JSON.parse(read('share/omx-contract/omx-vocabulary.schema.json'))];

test('the ts module and the json render are the declaration', async () => {
  assert.deepEqual(checkTs(await tsModule()), []);
  assert.deepEqual(checkJson(...jsonFiles()), []);
});

test('sabotage: a changed word in the ts module or the json is named', async () => {
  const mod = { ...(await tsModule()) };
  mod.RESOURCE_HINTS_WORDS = mod.RESOURCE_HINTS_WORDS.map((w) => (w === 'opens-sockets' ? 'opens-socket' : w));
  assert.ok(checkTs(mod).length > 0);
  mod.RESOURCE_HINTS = { ...mod.RESOURCE_HINTS, sharedLoad: { ...mod.RESOURCE_HINTS.sharedLoad, figureUnit: 'ms' } };
  assert.ok(checkTs(mod).some((p) => /sharedLoad.figureUnit/.test(p)));
  const [doc, schema] = jsonFiles();
  doc.items.RESOURCE_HINTS.value.activateTime.basis = 'measured';
  assert.ok(checkJson(doc, schema).some((p) => /activateTime.basis/.test(p)));
  const [doc2, schema2] = jsonFiles();
  schema2.$defs.RESOURCE_HINTS.enum.pop();
  assert.ok(checkJson(doc2, schema2).length > 0);
});

// ---- the committed files are the render; the validator's extension rule

test('the committed header, Turtle, ts and json are a fresh render of the data', () => {
  const resolved = resolveData(loadData(DATA));
  const c = renderC(resolved).find((f) => f.path === 'omxcontract/omx_resource_hints.h');
  assert.equal(c.text, headerText());
  assert.equal(renderLv2(resolved)[0].text, turtleText());
  assert.equal(renderJson(resolved, JSON.parse(read('package.json')).version)[0].text, read('share/omx-contract/omx-contract.json'));
  assert.equal(renderTs(resolved)[0].text, read('test/golden/ts/omx-contract.js'));
});

const problems = (t) => validateData(loadData(null, t));
const has = (t, rule) => problems(t).some((p) => p.item === 'RESOURCE_HINTS' && p.rule === rule);

test('the validator refuses an extension whose hint has no resource, unit or basis, or a unit the carriers cannot type', () => {
  assert.deepEqual(problems(texts()), []);
  for (const f of ['group', 'figureUnit', 'basis']) assert.ok(has(texts((d) => { delete d[R].RESOURCE_HINTS.words.sharedLoad[f]; }), 'extension'), f);
  assert.ok(has(texts((d) => { d[R].RESOURCE_HINTS.words.sharedLoad.figureUnit = 'us'; }), 'extension'));
  // a second item declaring an extension is refused: the carriers render one
  assert.ok(problems(texts((d) => { d[R].RESOURCE_BASES.extension = d[R].RESOURCE_HINTS.extension; })).some((p) => p.rule === 'extension'));
  assert.ok(has(texts((d) => { for (let i = 0; i < 26; i++) d[R].RESOURCE_HINTS.words[`extra${String.fromCharCode(97 + i)}`] = { word: `extra-${i}`, group: 'cpu', figureUnit: 'count', basis: 'declared' }; }), 'extension'));
});
