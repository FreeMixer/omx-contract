// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
// The verbs kind (docs/contract-dir.md "A package's verbs"): a package declares its verbs by a file in its own
// directory, with no change to omx-contract. The fixture package (test/fixtures/package-verbs/, four verbs as
// plugin-hostd 0.11.0 and omx-clap-core declare them) is installed beside omx-contract's data/ the way an owner's
// release installs it, read back, rendered from the installed directory, and broken once per refusal.
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { main } from '../bin/omx-contract.mjs';
import { CONTRACT_CODES, ContractRefusal } from '../lib/codes.mjs';
import { SCHEMA_MAJOR, loadContractDir, sha256 } from '../lib/contract-dir.mjs';
import { loadData, packageVersion, resolveData } from '../lib/data.mjs';
import { packageVocabularyC } from '../render/vocabulary.mjs';
import { classify, refusal } from '../lib/semver.mjs';
import { SCHEMA_VERSION, fileProblems, validateData } from '../lib/validate.mjs';
import { renderC } from '../render/c.mjs';
import { renderJson } from '../render/json.mjs';
import { renderTs } from '../render/ts.mjs';
import { DATA, ROOT, resolvedOf, texts } from './helpers.mjs';

const SCRATCH = mkdtempSync(join(tmpdir(), 'omx-contract-verbs-'));
after(() => rmSync(SCRATCH, { recursive: true, force: true }));
let n = 0;
const FIXTURE = join(ROOT, 'test/fixtures/package-verbs');
const GOLDEN = join(ROOT, 'test/golden/verbs');
const PKG = 'verbs-fixture';
const VERB_CODES = Object.entries(CONTRACT_CODES).filter(([k]) => k.startsWith('verb')).map(([, c]) => c);

const quiet = (fn) => {
  const { log, error } = console;
  console.log = () => {};
  console.error = () => {};
  try { return fn(); } finally { console.log = log; console.error = error; }
};

const install = (pkg, from, root, version = '1.0.0') => execFileSync('sh', [join(ROOT, 'tools/install-contract-dir.sh'), pkg, version, String(SCHEMA_MAJOR), from, root, 'data'], { stdio: 'ignore' });

/** A contract directory holding omx-contract's data/ and the fixture package, each as its install writes it. */
function installed() {
  const root = join(SCRATCH, `cd-${n++}`);
  execFileSync('sh', [join(ROOT, 'tools/install-contract-dir.sh'), '-x', 'codes.json', 'omx-contract', packageVersion(ROOT), String(SCHEMA_MAJOR), DATA, root, 'data'], { stdio: 'ignore' });
  install(PKG, FIXTURE, root);
  return root;
}

/** A copy of the fixture tree with `edit(files)` applied to its parsed files ({ 'verbs.json': doc, ... }). */
function fixtureWith(edit) {
  const dir = join(SCRATCH, `fx-${n++}`);
  cpSync(FIXTURE, dir, { recursive: true });
  const files = Object.fromEntries(readdirSync(dir).map((f) => [f, JSON.parse(readFileSync(join(dir, f), 'utf8'))]));
  edit(files);
  for (const [f, doc] of Object.entries(files)) writeFileSync(join(dir, f), `${JSON.stringify(doc, null, 2)}\n`);
  return dir;
}

const codesRaised = new Set();
/** The code the read refuses with; the read returns nothing. */
function refusalOf(root) {
  try {
    loadContractDir({ dir: root });
  } catch (e) {
    assert.ok(e instanceof ContractRefusal, `a refusal, not ${e.message}`);
    codesRaised.add(e.code);
    return e.code;
  }
  assert.fail('the read was not refused');
}

/** The contract directory of omx-contract and the fixture with `edit` applied; `extra` installs more packages. */
function brokenDir(edit, extra = () => {}) {
  const root = join(SCRATCH, `cd-${n++}`);
  execFileSync('sh', [join(ROOT, 'tools/install-contract-dir.sh'), '-x', 'codes.json', 'omx-contract', packageVersion(ROOT), String(SCHEMA_MAJOR), DATA, root, 'data'], { stdio: 'ignore' });
  install(PKG, fixtureWith(edit), root);
  extra(root);
  return root;
}

test('the fixture installs into a contract directory and reads back: four verbs, their refusals resolved to the code and the resp', () => {
  const root = installed();
  const m = JSON.parse(readFileSync(join(root, String(SCHEMA_MAJOR), PKG, 'MANIFEST.json'), 'utf8'));
  assert.deepEqual(Object.keys(m.files).sort(), ['errors.json', 'verbs.json']);
  for (const [f, h] of Object.entries(m.files)) assert.equal(sha256(readFileSync(join(root, String(SCHEMA_MAJOR), PKG, f))), h);
  const data = loadContractDir({ dir: root });
  assert.equal(data.items.get('HOST_VERBS').pkg, PKG);
  const r = resolveData(data).get('HOST_VERBS');
  assert.equal(r.kind, 'verbs');
  assert.deepEqual(Object.values(r.value).map((v) => v.verb), ['track_info', 'remote_pages', 'param_info', 'chain']);
  assert.deepEqual(r.value.chain.codes.map((c) => c.resp), [-518, -519, -520, -521, -902]);
  assert.equal(r.value.paramInfo.codes[1].code, 'reply.plugin-hostd.no-param-contract');
  assert.deepEqual(r.value.chain.implementedBy, { 'plugin-hostd': 'required', 'omx-clap-host': 'required', 'mod-host': 'unsupported' });
  assert.equal(quiet(() => main(['validate', '--contract-dir', root])), 0);
  assert.equal(quiet(() => main(['fmt', '--check', '--contract-dir', root])), 0);
});

test('the fixture states the schema floor this reader reads (a release that moves the schema moves the floor with it)', () => {
  for (const f of readdirSync(FIXTURE)) {
    assert.equal(JSON.parse(readFileSync(join(FIXTURE, f), 'utf8')).requires['omx-contract-schema'], `>= ${SCHEMA_VERSION}`, f);
  }
});

test('rendered from the installed directory: the C header, the package header (committed under test/golden/verbs), ts and json', async () => {
  const root = installed();
  const resolved = resolveData(loadContractDir({ dir: root }));
  const c = renderC(resolved);
  const whole = c.find((f) => f.path === 'omxcontract/omx_host_verbs.h');
  assert.ok(whole, 'the whole read renders omx_host_verbs.h');
  assert.equal(whole.text, readFileSync(join(GOLDEN, 'omx_host_verbs.h'), 'utf8'));
  for (const [macro, value] of [['OMX_VERB_TRACK_INFO', '"track_info"'], ['OMX_VERB_TRACK_INFO_FMT', '"track_info %i %s %s ..."'],
    ['OMX_VERB_PARAM_INFO_FMT', '"param_info %i %s"'], ['OMX_VERB_CHAIN_CODES_INIT', '{ -518, -519, -520, -521, -902 }']]) {
    assert.match(whole.text, new RegExp(`^#define ${macro} ${value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'm'), macro);
  }
  assert.match(whole.text, /\{ OMX_VERB_CHAIN, OMX_VERB_CHAIN_FMT, OMX_VERB_CHAIN_REPLY, \{ OMX_HOST_VERB_REQUIRED, OMX_HOST_VERB_REQUIRED, OMX_HOST_VERB_UNSUPPORTED \} \},/);
  // the package's own render, which the owner commits: the CLI from the installed directory, held to the golden
  assert.equal(quiet(() => main(['render', '--target', 'c', '--package', PKG, '--contract-dir', root, '--out', join(GOLDEN, 'c'), '--check'])), 0);
  const out = join(SCRATCH, `pkg-${n++}`);
  assert.equal(quiet(() => main(['render', '--target', 'c', '--package', PKG, '--contract-dir', root, '--out', out])), 0);
  assert.deepEqual(readdirSync(out).sort(), ['verbs_fixture_host_verbs.h', 'verbs_fixture_vocabulary.h']);
  // omx-contract's own data declares no verb, so its committed renders carry no verbs header
  assert.ok(!renderC(resolveData(loadData(DATA))).some((f) => f.path.endsWith('host_verbs.h')));
  const ts = renderTs(resolved).find((f) => f.path === 'omx-contract.js');
  const tsDir = join(SCRATCH, `ts-${n++}`);
  quiet(() => main(['render', '--target', 'ts', '--contract-dir', root, '--out', tsDir]));
  assert.equal(readFileSync(join(tsDir, 'omx-contract.js'), 'utf8'), ts.text);
  const mod = await import(`file://${join(tsDir, 'omx-contract.js')}`);
  assert.equal(mod.HOST_VERBS.chain.format, 'chain %i %i ...');
  assert.deepEqual(mod.VERB_HOSTS_WORDS, ['plugin-hostd', 'omx-clap-host', 'mod-host']);
  const json = JSON.parse(renderJson(resolved, '0.0.0')[0].text);
  assert.equal(json.items.HOST_VERBS.value.paramInfo.reply, 'resp 0 <unit> <scale> <min> <max> <default> <step> <stable_symbol>');
  assert.equal(json.items.HOST_VERBS.value.paramInfo.codes[0].resp, -103);
});

test('the committed headers compile together, and the run-time table answers what each host owes', (t) => {
  // make check compiles them too, with no node, where the suite runs with no cc (.github/workflows/ci.yml)
  if (spawnSync('cc', ['--version']).status !== 0) { t.skip('no cc'); return; }
  const src = join(SCRATCH, `t-${n++}.c`);
  writeFileSync(src, `#include "omx_host_verbs.h"
#include "c/verbs_fixture_host_verbs.h"
#include <stdio.h>
int main(void) {
  if (omx_host_verb_level(OMX_VERB_CHAIN, OMX_HOST_VERB_HOST_OMX_CLAP_HOST) != OMX_HOST_VERB_REQUIRED) return 1;
  if (omx_host_verb_level(OMX_VERB_TRACK_INFO, OMX_HOST_VERB_HOST_MOD_HOST) != OMX_HOST_VERB_UNSUPPORTED) return 2;
  if (verbs_fixture_host_verb_level("param_info", OMX_HOST_VERB_HOST_PLUGIN_HOSTD) != OMX_HOST_VERB_OPTIONAL) return 3;
  if (omx_host_verb_find("no_such_verb") != NULL || omx_host_verb_level("no_such_verb", 0) != OMX_HOST_VERB_UNSUPPORTED) return 4;
  static const int codes[] = OMX_VERB_CHAIN_CODES_INIT;
  if (sizeof codes / sizeof codes[0] != OMX_VERB_CHAIN_CODES_COUNT || codes[0] != -518) return 5;
  printf("%s|%s\\n", OMX_VERB_PARAM_INFO_FMT, omx_host_verb_find(OMX_VERB_REMOTE_PAGES)->reply);
  return OMX_HOST_VERB_COUNT == 4u ? 0 : 6;
}
`);
  const bin = join(SCRATCH, `t-${n++}`);
  execFileSync('cc', ['-std=c11', '-Wall', '-Wextra', '-Werror', '-I', GOLDEN, src, '-o', bin]);
  assert.equal(execFileSync(bin, { encoding: 'utf8' }), 'param_info %i %s|resp <count>\n');
});

test('a verb declared by two packages is refused: contract.verb.duplicate (one owner)', () => {
  const root = brokenDir(() => {}, (r) => {
    const other = fixtureWith((f) => {
      delete f['errors.json'];
      const v = f['verbs.json'];
      v.OTHER_VERBS = { ...v.HOST_VERBS, verbs: { trackInfo: { ...v.HOST_VERBS.verbs.trackInfo, codes: undefined } } };
      delete v.OTHER_VERBS.verbs.trackInfo.codes;
      delete v.HOST_VERBS;
    });
    rmSync(join(other, 'errors.json'), { force: true });
    install('other-host', other, r);
  });
  assert.equal(refusalOf(root), CONTRACT_CODES.verbDuplicate);
  assert.throws(() => loadContractDir({ dir: root }), /track_info: already declared by OTHER_VERBS.trackInfo \(other-host\), and again by verbs-fixture: a verb has one owner/);
});

test('a format whose first word is not the verb is refused: contract.verb.format', () => {
  assert.equal(refusalOf(brokenDir((f) => { f['verbs.json'].HOST_VERBS.verbs.remotePages.format = 'remote_page %i'; })), CONTRACT_CODES.verbFormat);
});

test('an unknown host word is refused: contract.verb.host-unknown', () => {
  assert.equal(refusalOf(brokenDir((f) => { f['verbs.json'].HOST_VERBS.verbs.chain.implementedBy.jalv = 'optional'; })), CONTRACT_CODES.verbHostUnknown);
});

test('an unknown code is refused by code: contract.verb.code-unknown for a name or an item that is no code, contract.ref.* for an item no file declares or requires', () => {
  assert.equal(refusalOf(brokenDir((f) => { f['verbs.json'].HOST_VERBS.verbs.chain.codes[0].ref = 'PLUGIN_HOSTD_REPLY_CODES.chainGone'; })), CONTRACT_CODES.verbCodeUnknown);
  const words = brokenDir((f) => { f['verbs.json'].HOST_VERBS.verbs.chain.codes[0].ref = 'VERB_HOSTS.pluginHostd'; });
  assert.equal(refusalOf(words), CONTRACT_CODES.verbCodeUnknown);
  assert.throws(() => loadContractDir({ dir: words }), /code VERB_HOSTS\.pluginHostd: VERB_HOSTS is a words item, no codes item/);
  assert.equal(refusalOf(brokenDir((f) => { f['verbs.json'].HOST_VERBS.verbs.chain.codes[0].ref = 'NO_SUCH_CODES.chainDuplicate'; })), CONTRACT_CODES.refUnresolved);
  // the codes of another package, named without requiring it
  const root = brokenDir((f) => { delete f['errors.json'].PLUGIN_HOSTD_REPLY_CODES; }, (r) => {
    const other = fixtureWith((f) => { delete f['verbs.json']; delete f['errors.json'].MOD_HOST_REPLY_CODES; });
    rmSync(join(other, 'verbs.json'), { force: true });
    install('plugin-hostd', other, r);
  });
  assert.equal(refusalOf(root), CONTRACT_CODES.refUndeclared);
});

test('every verb code was raised by an arm above', () => {
  assert.equal(VERB_CODES.length, 4);
  assert.deepEqual(VERB_CODES.filter((c) => !codesRaised.has(c)), []);
});

test('validate refuses the same in a data directory, each under its rule', () => {
  const base = { $schema: '../schema/omx-contract.schema.json' };
  const fx = Object.fromEntries(readdirSync(FIXTURE).map((f) => [f, JSON.parse(readFileSync(join(FIXTURE, f), 'utf8'))]));
  const read = (edit) => {
    const t = texts();
    const docs = JSON.parse(JSON.stringify(fx));
    edit(docs);
    for (const [f, d] of Object.entries(docs)) t[`data/fixture-${f}`] = JSON.stringify({ ...d, $schema: base.$schema });
    return validateData(loadData(null, t)).map((p) => p.rule);
  };
  assert.deepEqual(read(() => {}), []);
  assert.deepEqual(read((d) => { d['verbs.json'].HOST_VERBS.verbs.chain.format = 'chains %i'; }), ['verb-format']);
  assert.deepEqual(read((d) => { d['verbs.json'].HOST_VERBS.verbs.chain.implementedBy.jalv = 'required'; }), ['verb-host']);
  assert.deepEqual(read((d) => { d['verbs.json'].HOST_VERBS.verbs.chain.codes[0].ref = 'MOD_HOST_REPLY_CODES.gone'; }), ['verb-code']);
  assert.deepEqual(read((d) => { d['verbs.json'].HOST_VERBS.verbs.again = d['verbs.json'].HOST_VERBS.verbs.chain; }), ['verb-duplicate']);
  assert.deepEqual(read((d) => { d['verbs.json'].HOST_VERBS.verbs.chain.codes[0].ref = 'NO_SUCH.code'; }), ['reference']);
});

test('the schema holds a verb closed: its fields, its levels, a reply code with its resp and no resp on any other code', () => {
  const probs = (items) => [...new Set(fileProblems({ rel: 'data/x.json', text: '', doc: { $schema: '../schema/omx-contract.schema.json', ...items } }).map((p) => p.item))];
  const verb = () => JSON.parse(JSON.stringify(JSON.parse(readFileSync(join(FIXTURE, 'verbs.json'), 'utf8')).HOST_VERBS));
  const ok = verb();
  assert.deepEqual(probs({ V: ok }), []);
  for (const edit of [
    (v) => { v.verbs.chain.extra = 1; },
    (v) => { v.verbs.chain.implementedBy['mod-host'] = 'absent'; },
    (v) => { v.verbs.chain.verb = 'Chain'; },
    (v) => { v.verbs.chain.format = 'chain %d'; },
    (v) => { v.verbs.chain.reply = 'ok'; },
    (v) => { v.verbs.chain.codes = [{ ref: 'NOT_A_CODE' }]; },
    (v) => { delete v.verbs.chain.implementedBy; },
    (v) => { delete v.verbs.chain.doc; },
    (v) => { v.verbs.Chain = v.verbs.chain; },
  ]) {
    const v = verb();
    edit(v);
    assert.deepEqual(probs({ V: v }), ['V'], String(edit));
  }
  const codes = (c) => ({ kind: 'codes', doc: 'd', codes: { a: c } });
  assert.deepEqual(probs({ C: codes({ code: 'reply.x.y', resp: -1 }) }), []);
  assert.deepEqual(probs({ C: codes({ code: 'reply.x.y' }) }), ['C'], 'a reply code carries its resp');
  assert.deepEqual(probs({ C: codes({ code: 'hosting.x.y', resp: -1 }) }), ['C'], 'only a reply code carries a resp');
  assert.deepEqual(probs({ C: codes({ code: 'reply.x.y', resp: 0 }) }), ['C'], 'a refusal is negative');
});

test('semver: the verbs kind and a verb added are MINOR; a verb removed is MAJOR, in the development phase too', () => {
  const withFixture = (edit = () => {}) => {
    const t = texts();
    const docs = Object.fromEntries(readdirSync(FIXTURE).map((f) => [f, JSON.parse(readFileSync(join(FIXTURE, f), 'utf8'))]));
    edit(docs['verbs.json'].HOST_VERBS.verbs, docs);
    for (const [f, d] of Object.entries(docs)) t[`data/fixture-${f}`] = JSON.stringify({ ...d, $schema: '../schema/omx-contract.schema.json' });
    return resolvedOf(t);
  };
  const before = resolvedOf(texts());
  const base = withFixture();
  assert.equal(classify(before, base).level, 'minor', 'a package adds its verbs: an item added');
  const level = (edit) => classify(base, withFixture(edit));
  assert.equal(level((v) => { v.presetList = { ...v.remotePages, verb: 'preset_list', format: 'preset_list %i' }; }).level, 'minor');
  const gone = level((v) => { delete v.paramInfo; });
  assert.equal(gone.level, 'major');
  assert.deepEqual(gone.changes.map((c) => c.what), ['HOST_VERBS.paramInfo removed (verb param_info)']);
  assert.equal(classify(withFixture(), resolvedOf(texts())).level, 'major', 'the whole verbs item removed');
  assert.match(refusal('major', '3.3.0', '3.3.1'), /MAJOR, and 3\.3\.0 -> 3\.3\.1 is a patch bump/);
  assert.equal(refusal('major', '3.3.0', '3.4.0', { developmentPhase: null }), 'the changes since 3.3.0 are MAJOR, and 3.3.0 -> 3.4.0 is a minor bump');
  assert.equal(level((v) => { v.chain.format = 'chain %i ...'; }).level, 'major');
  assert.equal(level((v) => { v.chain.reply = 'resp <chain>'; }).level, 'major');
  assert.equal(level((v) => { v.trackInfo.implementedBy['mod-host'] = 'optional'; }).level, 'minor', 'a host given an optional verb');
  assert.equal(level((v) => { v.trackInfo.implementedBy['omx-clap-host'] = 'required'; }).level, 'major', 'a host owes more');
  assert.equal(level((v) => { v.chain.implementedBy['plugin-hostd'] = 'optional'; }).level, 'major', 'a controller is owed less');
  assert.equal(level((v) => { v.chain.codes.pop(); }).level, 'major', 'a refusal removed');
  assert.equal(level((v) => { v.remotePages.codes = [{ ref: 'MOD_HOST_REPLY_CODES.invalidOperation' }]; }).level, 'minor', 'a refusal added');
  assert.equal(level((v) => { v.chain.doc = 'reworded'; }).level, 'patch');
  assert.equal(level((v, d) => { d['errors.json'].MOD_HOST_REPLY_CODES.codes.invalidOperation.resp = -901; }).level, 'major', 'a refusal\'s resp moved');
});

test('every reply code with a resp is a _RESP macro of its own number in the package vocabulary header, and a code without one has none', () => {
  const root = installed();
  const resolved = resolveData(loadContractDir({ dir: root }));
  const pkg = packageVocabularyC(resolved, PKG)[0].text;
  const codes = [...resolved.values()].filter((r) => r.kind === 'codes').flatMap((r) => Object.values(r.value));
  const withResp = codes.filter((c) => c.resp !== undefined);
  assert.ok(withResp.length >= 2, 'the fixture declares reply codes with a resp: the check can see them');
  const macros = [...pkg.matchAll(/^#define (OMX_REPLY_\w+_RESP) \((-\d+)\)$/gm)].map((m) => [m[1], Number(m[2])]);
  for (const c of withResp.filter((x) => pkg.includes(`"${x.code}"`))) {
    const name = `OMX_${c.code.replace(/[^A-Za-z0-9]+/g, '_').toUpperCase()}_RESP`;
    assert.deepEqual(macros.find(([m]) => m === name), [name, c.resp], c.code);
  }
  assert.equal(macros.length, withResp.filter((x) => pkg.includes(`"${x.code}"`)).length, 'one _RESP per code that has a resp');
});
