// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
// The hosting limits and refusal codes and clap_host_limits.h, their render (docs/hosting.md), over omx-clap-core's
// file as the owners' fixture holds it (test/fixtures/owners-2.14.0/hosting.json, its render word included).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { loadData } from '../lib/data.mjs';
import { classify } from '../lib/semver.mjs';
import { validateData } from '../lib/validate.mjs';
import { renderC } from '../render/c.mjs';
import { ROOT, resolvedOf, texts } from './helpers.mjs';

const hosting = 'data/hosting.json';
const render = (t) => renderC(resolvedOf(t)).find((f) => f.path === 'omxcontract/clap_host_limits.h')?.text;
const problems = (t) => validateData(loadData(null, t)).map((p) => `${p.item}:${p.rule}`);
const defines = (text) => text.split('\n').filter((l) => l.startsWith('#define CLAP_HOST_'));

test('the render is the header omx-clap-core commits, byte for byte, its banner the render word\'s', () => {
  const committed = readFileSync(join(ROOT, 'test/fixtures/clap_host_limits-omx-clap-core.h'), 'utf8');
  const out = render(texts());
  assert.ok(defines(committed).length >= 26, 'positive control: the committed header carries the numbers and the codes');
  assert.equal(out, committed);
});

test('render --package omx-clap-core: both headers it commits, the OMX_HOSTED_STAGE_ one with the worker fields, byte for byte', () => {
  const own = renderC(resolvedOf(texts()), { pkg: 'omx-clap-core' });
  // and, a data directory being the package named whole, its vocabulary (test/package-vocabulary.test.mjs)
  assert.deepEqual(own.map((f) => f.path), ['clap_host_limits.h', 'hosted_stage_limits.h', 'omx_clap_core_vocabulary.h']);
  assert.equal(own[0].text, readFileSync(join(ROOT, 'test/fixtures/clap_host_limits-omx-clap-core.h'), 'utf8'));
  assert.equal(own[1].text, readFileSync(join(ROOT, 'test/fixtures/hosted_stage_limits-omx-clap-core.h'), 'utf8'));
  assert.equal(own[1].text.split('\n').filter((l) => l.startsWith('#define OMX_HOSTED_STAGE_')).length, 20);
  assert.match(own[1].text, /^#define OMX_HOSTED_STAGE_WORKER_RING_BYTES 16384$/m);
});

test('a level is a float literal, a count an unsigned one, a code a string, each with its prose', () => {
  const out = render(texts());
  assert.match(out, /^#define CLAP_HOST_CLAMP_DBFS 24\.0f {2}\/\/\/< the level the output is clamped at, in dBFS$/m);
  assert.match(out, /^#define CLAP_HOST_WARMUP_LEVEL_DBFS -6\.0f /m);
  assert.match(out, /^#define CLAP_HOST_PARAM_QUEUE_DEPTH 256u {2}\/\/\/< the records the parameter queue holds$/m);
  assert.match(out, /^#define CLAP_HOST_WARMUP_BLOCKS 64u$/m, 'a number without prose renders bare');
  assert.match(out, /^#define CLAP_HOST_CODE_NOTE_INPUT "hosting\.clap\.note-input" {2}\/\/\/< /m);
  assert.match(out, /^#define CLAP_HOST_CODE_HEADLESS_FAILED "hosting\.clap\.headless-failed"$/m);
  assert.doesNotMatch(out, /WORKER/, 'the LV2 worker numbers are not the CLAP core\'s');
});

test('perturbation: a moved number, a moved code and a moved prose move the render', () => {
  const base = render(texts());
  const moved = (fn) => render(texts(fn));
  assert.match(moved((d) => { d[hosting].HOSTED_STAGE_LIMITS.value.stateMaxBytes = 4096; }), /^#define CLAP_HOST_STATE_MAX_BYTES 4096u /m);
  assert.match(moved((d) => { d[hosting].HOSTED_STAGE_LIMITS.value.clampDbfs = 12; }), /^#define CLAP_HOST_CLAMP_DBFS 12\.0f /m);
  assert.match(moved((d) => { d[hosting].HOSTING_CODES.codes.noteInput.code = 'hosting.clap.note-input-x'; }), /"hosting\.clap\.note-input-x"/);
  assert.match(moved((d) => { d[hosting].HOSTED_STAGE_LIMITS.docs.logBytes = 'the log line, in bytes'; }), /^#define CLAP_HOST_LOG_BYTES 256u {2}\/\/\/< the log line, in bytes$/m);
  assert.notEqual(moved((d) => { d[hosting].HOSTED_STAGE_LIMITS.value.warmupBlocks = 32; }), base);
});

test('the stage limits also render as OMX_HOSTED_STAGE_* in omx_contract_limits.h', () => {
  const h = renderC(resolvedOf(texts()))[0].text;
  assert.match(h, /^#define OMX_HOSTED_STAGE_PARAM_COUNT_MAX 2048$/m);
  assert.match(h, /^#define OMX_HOSTED_STAGE_WORKER_RING_BYTES 16384$/m);
});

test('a malformed declaration is refused, by item and rule', () => {
  assert.ok(problems(texts((d) => { d[hosting].HOSTED_STAGE_LIMITS.docs.noSuchField = 'x'; })).includes('HOSTED_STAGE_LIMITS:sheet-docs'));
  assert.ok(problems(texts((d) => { d[hosting].HOSTING_CODES.codes.noteInput.code = d[hosting].HOSTING_CODES.codes.noAudioInput.code; })).includes('HOSTING_CODES:code-unique'));
  assert.ok(problems(texts((d) => { d[hosting].HOSTING_CODES.codes.noteInput.code = 'Hosting.Clap'; })).some((p) => p.startsWith('HOSTING_CODES')), 'a code outside hosting.<group>.<reason> is refused by the schema');
  assert.ok(problems(texts((d) => { d[hosting].HOSTED_STAGE_LIMITS.value.warmupBlocks = { ref: 'HOSTING_CODES' }; })).some((p) => p.startsWith('HOSTED_STAGE_LIMITS')));
  assert.deepEqual(problems(texts()), []);
});

test('the render refuses a stage number that is neither a level nor a count', () => {
  assert.throws(() => render(texts((d) => { d[hosting].HOSTED_STAGE_LIMITS.value.logBytes = 2.5; })), /neither a level \(\*Dbfs\) nor a non-negative integer/);
  assert.throws(() => render(texts((d) => { d[hosting].HOSTED_STAGE_LIMITS.docs.logBytes = 'two\nlines'; })), /no one-line description/);
});

test('semver: a code reworded is MAJOR, one removed MAJOR outside the development phase and MINOR in it, one added MINOR, its prose PATCH', () => {
  const base = resolvedOf(texts());
  const level = (fn) => classify(base, resolvedOf(texts(fn))).level;
  const released = (fn) => classify(base, resolvedOf(texts(fn)), { developmentPhase: null }).level;
  // a code its writers stop writing is removed, never carried (operator ruling 2026-10-20, omx-contract#130)
  assert.equal(level((d) => { delete d[hosting].HOSTING_CODES.codes.noteInput; }), 'minor');
  assert.equal(released((d) => { delete d[hosting].HOSTING_CODES.codes.noteInput; }), 'major');
  assert.equal(level((d) => { d[hosting].HOSTING_CODES.codes.noteInput.code = 'hosting.clap.note-input-x'; }), 'major');
  assert.equal(level((d) => { d[hosting].HOSTING_CODES.codes.fresh = { code: 'hosting.clap.fresh' }; }), 'minor');
  assert.equal(level((d) => { d[hosting].HOSTING_CODES.codes.noteInput.doc = 'reworded'; }), 'patch');
  assert.equal(level((d) => { d[hosting].HOSTED_STAGE_LIMITS.docs.logBytes = 'reworded'; }), 'patch');
  assert.equal(level((d) => { d[hosting].HOSTED_STAGE_LIMITS.value.logBytes = 512; }), 'major');
});
