// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
/**
 * A renamed list keeps its former name for one release (its item's `formerly`): the C render defines the old macros as
 * the new ones, the ts render binds the old export to the new one, the json render maps the old name to the new item.
 * None of them copies the values, so moving a value moves both names; validate and semver read the word too.
 */
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { main } from '../bin/omx-contract.mjs';
import { atLeast } from '../lib/contract-dir.mjs';
import { loadData, packageVersion, resolveData } from '../lib/data.mjs';
import { DEVELOPMENT_PHASE, classify } from '../lib/semver.mjs';
import { validateData } from '../lib/validate.mjs';
import { renderC } from '../render/c.mjs';
import { renderJson } from '../render/json.mjs';
import { renderTs } from '../render/ts.mjs';
import { DATA, ROOT, UNION, editData, resolvedOf, scratchData, texts } from './helpers.mjs';

// ORACLE_FLOOR_RATES renamed FLOOR_RENAMED, its old name kept until 9.9.0
const rename = (values) => texts((d) => {
  const rates = d['data/rates.json'];
  const { ORACLE_FLOOR_RATES: it, ...rest } = rates;
  d['data/rates.json'] = { ...rest, FLOOR_RENAMED: { ...it, ...(values ? { values } : {}), formerly: { name: 'ORACLE_FLOOR_RATES', removedIn: '9.9.0' } } };
});

/** The values a macro of `header` expands to, following defines that name another macro. */
function expand(header, macro) {
  const defs = new Map([...header.matchAll(/^#define (OMX_\w+) (.+)$/gm)].map((m) => [m[1], m[2].trim()]));
  let v = defs.get(macro);
  for (let hops = 0; v !== undefined && defs.has(v) && hops < 8; hops++) v = defs.get(v);
  if (v === undefined) return undefined;
  const list = /^\{ (.*) \}$/.exec(v);
  return list ? list[1].split(', ').map(Number) : Number(v.replace(/u$/, ''));
}

test('formerly: the C render defines the old macros as the new ones, never as numbers', () => {
  const h = renderC(resolvedOf(rename()))[0].text;
  assert.match(h, /^#define OMX_ORACLE_FLOOR_RATES_COUNT OMX_FLOOR_RENAMED_COUNT$/m);
  assert.match(h, /^#define OMX_ORACLE_FLOOR_RATES_INIT OMX_FLOOR_RENAMED_INIT$/m);
  assert.match(h, /OMX_ORACLE_FLOOR_RATES_\* is the former name of OMX_FLOOR_RENAMED_\*, kept until 9\.9\.0 removes it/);
  assert.doesNotMatch(h, /OMX_ORACLE_FLOOR_RATES_INIT \{/);
  assert.deepEqual(expand(h, 'OMX_ORACLE_FLOOR_RATES_INIT'), [44100, 48000, 96000, 192000]);
  assert.equal(expand(h, 'OMX_ORACLE_FLOOR_RATES_COUNT'), 4);
});

test('formerly: a value moved moves both names (the alias carries no copy)', () => {
  const h = renderC(resolvedOf(rename([44100, 48000, 96000, 192000, 384000])))[0].text;
  assert.deepEqual(expand(h, 'OMX_ORACLE_FLOOR_RATES_INIT'), expand(h, 'OMX_FLOOR_RENAMED_INIT'));
  assert.equal(expand(h, 'OMX_ORACLE_FLOOR_RATES_COUNT'), 5);
});

test('formerly: the ts render binds the old export to the new one, deprecated', async () => {
  const [js, dts] = renderTs(resolvedOf(rename())).map((f) => f.text);
  assert.match(js, /@deprecated The former name of FLOOR_RENAMED, kept until 9\.9\.0 removes it: read FLOOR_RENAMED\.\n \* @see data\/rates\.json\n \*\/\nexport const ORACLE_FLOOR_RATES = FLOOR_RENAMED;/);
  assert.match(dts, /export declare const ORACLE_FLOOR_RATES: typeof FLOOR_RENAMED;/);
  const mod = await import(`data:text/javascript,${encodeURIComponent(js)}`);
  assert.equal(mod.ORACLE_FLOOR_RATES, mod.FLOOR_RENAMED);
  assert.deepEqual(mod.ORACLE_FLOOR_RATES, [44100, 48000, 96000, 192000]);
});

test('formerly: the json render maps the old name to the item, with no values of its own', () => {
  const doc = JSON.parse(renderJson(resolvedOf(rename()), '0.0.0')[0].text);
  assert.deepEqual(doc.formerNames.ORACLE_FLOOR_RATES, { name: 'FLOOR_RENAMED', removedIn: '9.9.0' });
  assert.equal(doc.items.ORACLE_FLOOR_RATES, undefined);
  assert.deepEqual(doc.items.FLOOR_RENAMED.formerly, { name: 'ORACLE_FLOOR_RATES', removedIn: '9.9.0' });
  assert.equal(JSON.parse(renderJson(resolvedOf(texts((d) => {
    for (const it of Object.values(d['data/rates.json'])) if (typeof it === 'object') delete it.formerly;
  })), '0.0.0')[0].text).formerNames, undefined, 'no rename, no formerNames');
});

test('formerly: validate refuses a former name that is an item, or one two lists claim', () => {
  const rules = (t) => validateData(loadData(null, t)).map((p) => `${p.item}:${p.rule}`);
  assert.deepEqual(rules(rename()), []);
  assert.deepEqual(rules(texts((d) => { d['data/rates.json'].ORACLE_FLOOR_RATES.formerly = { name: 'STANDARD_SAMPLE_RATES', removedIn: '9.9.0' }; })),
    ['ORACLE_FLOOR_RATES:formerly', 'OMX_STANDARD_SAMPLE_RATES_COUNT:c-name-unique', 'OMX_STANDARD_SAMPLE_RATES_INIT:c-name-unique']);
  const twice = texts((d) => {
    d['data/rates.json'].ORACLE_FLOOR_RATES.formerly = { name: 'GONE_RATES', removedIn: '9.9.0' };
    d['data/rates.json'].STANDARD_SAMPLE_RATES.formerly = { name: 'GONE_RATES', removedIn: '9.9.0' };
  });
  assert.equal(rules(twice).filter((r) => r.endsWith(':formerly')).length, 1);
  assert.match(validateData(loadData(null, texts((d) => { d['data/rates.json'].ORACLE_FLOOR_RATES.formerly = { name: 'X', removedIn: 'soon' }; })))[0].message, /pattern/);
});

test('formerly: semver reads a rename with its old name kept as MINOR, and its values held against the old item', () => {
  const base = resolvedOf(texts());
  const r = classify(base, resolvedOf(rename()));
  assert.equal(r.level, 'minor');
  assert.ok(r.changes.some((c) => c.item === 'ORACLE_FLOOR_RATES' && /renamed FLOOR_RENAMED/.test(c.what)));
  assert.equal(classify(base, resolvedOf(rename([44100, 48000, 96000, 191999]))).level, 'major', 'a value changed under the rename is still MAJOR');
  // the alias dropped in a later release: MINOR in the development phase, MAJOR after it
  const dropped = resolveData(loadData(null, texts((d) => {
    const { ORACLE_FLOOR_RATES: it, ...rest } = d['data/rates.json'];
    d['data/rates.json'] = { ...rest, FLOOR_RENAMED: it };
  })));
  assert.equal(classify(resolvedOf(rename()), dropped).level, 'minor');
  assert.equal(classify(resolvedOf(rename()), dropped, { developmentPhase: null }).level, 'major');
});

/** The former names the data still carries at `version`, each as `<OLD> (removedIn x.y.z)`, when `version` reaches its removal. */
const overdue = (resolved, version) => [...resolved.values()].filter((r) => r.formerly && atLeast(version, r.formerly.removedIn))
  .map((r) => `${r.formerly.name} (removedIn ${r.formerly.removedIn}, now ${r.name})`);

// The removal is part of the release it names: releasing that version with the word still there is red here, and the
// fix is to delete the item's `formerly` (its renders follow) and say so in that release's changelog.
test('formerly: no former name outlives the release that removes it', () => {
  assert.deepEqual(overdue(resolveData(loadData(UNION)), packageVersion(ROOT)), [],
    'release the removal: delete each item\'s formerly word and re-render');
  // the arm reads a version: the rename above, at its removal release and after, is overdue; before it, not
  const synthetic = (v) => overdue(resolvedOf(rename()), v).filter((s) => s.startsWith('ORACLE_FLOOR_RATES '));
  assert.deepEqual(synthetic('9.9.0'), ['ORACLE_FLOOR_RATES (removedIn 9.9.0, now FLOOR_RENAMED)']);
  assert.equal(synthetic('10.0.0').length, 1);
  assert.deepEqual(synthetic('9.8.9'), []);
});

/**
 * The former names a release at `version` would remove while a consumer still reads them: a `formerly` with `readers`
 * whose `removedIn` the version reaches. Each as `<OLD> (removedIn x.y.z, read by …)`.
 */
const removedWhileRead = (resolved, version) => [...resolved.values()].filter((r) => r.formerly?.readers && atLeast(version, r.formerly.removedIn))
  .map((r) => `${r.formerly.name} (removedIn ${r.formerly.removedIn}, read by ${r.formerly.readers.join(', ')})`);

// A former name is removed only once no consumer reads it. While `readers` names one, a release that reaches
// `removedIn` is red here, before the removal arm above can ask for the word to be deleted: the fix is to move
// `removedIn` to a later release, or, once every reader has moved, to drop the word with its alias. The readers are
// consumers the development phase registers (lib/semver.mjs), so a reader nobody tracks cannot be recorded
// (FreeMixer/omx-contract#108).
test('formerly: no release reaches removedIn while a registered consumer still reads the former name', () => {
  const resolved = resolveData(loadData(UNION));
  assert.deepEqual(removedWhileRead(resolved, packageVersion(ROOT)), [], 'move removedIn to a later release, or record that the readers have moved');
  for (const r of resolved.values()) {
    for (const reader of r.formerly?.readers ?? []) assert.ok(DEVELOPMENT_PHASE.consumers.includes(reader), `${r.name}.formerly.readers: ${reader} is no registered consumer`);
  }
  // the arm reads a version and the readers: a rename removed in 9.9.0 and still read is red at 9.9.0 and after, not
  // before, and never once nobody reads it
  const withReaders = resolvedOf(texts((d) => {
    const { ORACLE_FLOOR_RATES: it, ...rest } = d['data/rates.json'];
    d['data/rates.json'] = { ...rest, FLOOR_RENAMED: { ...it, formerly: { name: 'ORACLE_FLOOR_RATES', removedIn: '9.9.0', readers: ['omx-dsp'] } } };
  }));
  const floor = (r, v) => removedWhileRead(r, v).filter((x) => x.startsWith('ORACLE_FLOOR_RATES '));
  assert.deepEqual(floor(withReaders, '9.9.0'), ['ORACLE_FLOOR_RATES (removedIn 9.9.0, read by omx-dsp)']);
  assert.deepEqual(floor(withReaders, '9.8.9'), []);
  assert.deepEqual(floor(resolvedOf(rename()), '9.9.0'), []);
});

const NINE = [32000, 44100, 48000, 64000, 88200, 96000, 128000, 176400, 192000];
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

test('ORACLE_FULL_RATES: the nine rates, its doc names no vendor, and the floor and the standard rates lie inside it', () => {
  const r = resolveData(loadData(DATA));
  const full = r.get('ORACLE_FULL_RATES');
  assert.deepEqual(full.value, NINE);
  assert.doesNotMatch(full.doc, /RME/);
  for (const n of ['ORACLE_FLOOR_RATES', 'STANDARD_SAMPLE_RATES']) for (const v of r.get(n).value) assert.ok(NINE.includes(v), `${n} ${v}`);
  // the numbers a reader of its former name, RME_RATES, built against until 2.15.0
  assert.deepEqual(expand(read('test/fixtures/omx-contract-2.10.0/omx_contract_limits.h'), 'OMX_RME_RATES_INIT'), NINE);
});

test('RME_RATES is gone: no item, no former name, in the data and in every committed render (2.19.0, #125)', async () => {
  const r = resolveData(loadData(DATA));
  assert.equal(r.has('RME_RATES'), false);
  assert.deepEqual([...r.values()].filter((x) => x.formerly).map((x) => x.name), []);
  assert.doesNotMatch(read('include/omxcontract/omx_contract_limits.h'), /RME_RATES/);
  const ts = await import(join(ROOT, 'test/golden/ts/omx-contract.js'));
  assert.equal(ts.RME_RATES, undefined);
  assert.doesNotMatch(read('test/golden/ts/omx-contract.d.ts'), /RME_RATES/);
  assert.equal(JSON.parse(read('share/omx-contract/omx-contract.json')).formerNames, undefined);
});

/**
 * The fixture instance of the mechanism: a scratch copy of the data in which ORACLE_FLOOR_RATES is renamed
 * FLOOR_RENAMED, its old name kept until 9.9.0 (`fn(rates)` edits its rates.json further), with its C render written
 * beside it. The renders a reader of the old name builds against are the ones held here, never a real alias.
 */
function aliasFixture(fn) {
  const dir = scratchData();
  editData(dir, 'rates.json', (d) => {
    const it = d.ORACLE_FLOOR_RATES;
    delete d.ORACLE_FLOOR_RATES;
    d.FLOOR_RENAMED = { ...it, formerly: { name: 'ORACLE_FLOOR_RATES', removedIn: '9.9.0' } };
    fn?.(d);
  });
  const out = mkdtempSync(join(tmpdir(), 'omx-contract-formerly-'));
  for (const f of renderC(resolveData(loadData(dir)))) {
    mkdirSync(dirname(join(out, f.path)), { recursive: true });
    writeFileSync(join(out, f.path), f.text);
  }
  return { dir, out, header: () => readFileSync(join(out, 'omxcontract/omx_contract_limits.h'), 'utf8') };
}

test('sabotage: the alias edited by hand into a copy of the numbers is red, though the numbers agree', () => {
  const { dir, out, header } = aliasFixture();
  try {
    const FLOOR = [44100, 48000, 96000, 192000];
    assert.match(header(), /^#define OMX_ORACLE_FLOOR_RATES_INIT OMX_FLOOR_RENAMED_INIT$/m);
    assert.equal(main(['render', '--target', 'c', '--out', out, '--check', '--data', dir]), 0, 'the fixture\'s own render is clean');
    const h = header().replace(/^#define OMX_ORACLE_FLOOR_RATES_INIT .+$/m, `#define OMX_ORACLE_FLOOR_RATES_INIT { ${FLOOR.join(', ')} }`);
    writeFileSync(join(out, 'omxcontract/omx_contract_limits.h'), h);
    assert.deepEqual(expand(h, 'OMX_ORACLE_FLOOR_RATES_INIT'), FLOOR, 'the hand copy holds the same numbers');
    assert.equal(main(['render', '--target', 'c', '--out', out, '--check', '--data', dir]), 1);
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});

test('perturbation: a rate moved in the renamed list moves the old name with it, and --check goes red', () => {
  const { out } = aliasFixture();
  try {
    const moved = aliasFixture((d) => { d.FLOOR_RENAMED.values[0] = 32000; });
    try {
      const r = resolveData(loadData(moved.dir));
      assert.deepEqual(expand(moved.header(), 'OMX_ORACLE_FLOOR_RATES_INIT'), [32000, 48000, 96000, 192000]);
      assert.match(renderTs(r)[0].text, /^export const ORACLE_FLOOR_RATES = FLOOR_RENAMED;$/m);
      assert.equal(main(['render', '--target', 'c', '--out', out, '--check', '--data', moved.dir]), 1);
    } finally {
      rmSync(moved.out, { recursive: true, force: true });
    }
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});
