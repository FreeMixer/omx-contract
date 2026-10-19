// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
// `omx-contract links --check` (docs/contract-dir.md): the source links of the definitions checked against an owner's
// tree. A fixture tree holds a define, an enum, a function, a static table and a TS const; each refusal code has its
// sabotage arm, and the good links pass with the values they hold.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, test } from 'node:test';
import { CONTRACT_CODES } from '../lib/codes.mjs';
import { loadData } from '../lib/data.mjs';
import { checkLinks, definitions, parseLink } from '../lib/links.mjs';
import { validateData } from '../lib/validate.mjs';
import { DATA_ITEMS, ROOT } from './helpers.mjs';

const TREE = mkdtempSync(join(tmpdir(), 'omx-links-'));
const OTHER = mkdtempSync(join(tmpdir(), 'omx-links-other-'));
after(() => { rmSync(TREE, { recursive: true, force: true }); rmSync(OTHER, { recursive: true, force: true }); });
const put = (root, rel, text) => { mkdirSync(dirname(join(root, rel)), { recursive: true }); writeFileSync(join(root, rel), text); };

put(TREE, 'include/omxdsp/omx_k.h', `/* OMX_K_MAX_MS is the longest; a comment that names omx_k_plan( { is no definition */
#define OMX_K_MAX_MS 100
#define OMX_K_Q 0.70710678f
#define OMX_K_NAME "kay"
#define OMX_K_SQUARE(x) ((x) * (x))
#define OMX_K_TWICE 1
#define OMX_K_TWICE 1
enum omx_k_kind {
  OMX_K_KIND_PEAK = 0,
  OMX_K_KIND_LOW_SHELF,
  OMX_K_KIND_HIGH_SHELF,
  OMX_K_KIND_COUNT
};
void omx_k_plan(int n);
`);
put(TREE, 'src/omx_k.c', `#include "omxdsp/omx_k.h"
struct omx_k_row { int maxVoices; };
static const struct omx_k_row omx_k_table[] = { { 4 } };
void
omx_k_plan(int n)
{
  if (omx_k_other(n)) { return; }
  int ms = OMX_K_MAX_MS_DOUBLE;
  (void)ms;
}
int omx_k_other(int n) { return n > 0; }
int omx_k_travel_clamp(int v) { return v > OMX_K_TRAVEL_MAX ? OMX_K_TRAVEL_MAX : v; }
`);
put(OTHER, 'src/k.ts', `export const K_RATES = [44100, 48000] as const;
export const K_LIMIT = 7;
`);

const items = (extra = {}) => ({
  $schema: '../schema/omx-contract.schema.json',
  K_MAX_MS: { kind: 'scalar', doc: 'd', unit: 'ms', value: 100, source: { from: 'include/omxdsp/omx_k.h#OMX_K_MAX_MS', impl: 'src/omx_k.c#omx_k_plan' } },
  K_Q: { kind: 'scalar', doc: 'd', unit: '', value: 0.7071067811865476, source: { from: 'include/omxdsp/omx_k.h#OMX_K_Q', impl: 'include/omxdsp/omx_k.h#OMX_K_Q' } },
  K_KINDS: { kind: 'set', doc: 'd', ids: ['peak', 'lowShelf', 'highShelf'], source: { from: 'include/omxdsp/omx_k.h#enum omx_k_kind', impl: 'include/omxdsp/omx_k.h#enum omx_k_kind' } },
  K_TRAVEL: { kind: 'travels', doc: 'd', travel: { min: 0, max: 100, unit: 'ms' }, source: { from: { max: 'include/omxdsp/omx_k.h#OMX_K_MAX_MS' }, impl: 'src/omx_k.c#omx_k_travel_clamp' } },
  K_RATES: { kind: 'list', doc: 'd', unit: '', values: [44100, 48000], source: { from: 'src/k.ts#K_RATES', impl: 'src/k.ts#K_RATES', at: 'openmixer@6ee8a9b' } },
  ...extra,
});
const dataOf = (doc) => loadData(null, { 'data/x.json': JSON.stringify(doc) });
const codesOf = (doc, opts = {}) => checkLinks(dataOf(doc), { root: TREE, ...opts }).problems.map((p) => `${p.item}:${p.code}`);
const raised = new Set();
const arm = (doc, item, name, opts) => {
  const got = codesOf(doc, opts);
  assert.deepEqual(got, [`${item}:${CONTRACT_CODES[name]}`]);
  raised.add(CONTRACT_CODES[name]);
};

test('a link splits into path, tag, symbol and selectors', () => {
  assert.deepEqual(parseLink('include/omxdsp/omx_eq_design.h#enum omx_eq_kind'), { path: 'include/omxdsp/omx_eq_design.h', tag: 'enum', symbol: 'omx_eq_kind', selectors: [] });
  assert.deepEqual(parseLink('a/b.h#omx_hrp_family_search[guitar].maxVoices').selectors, [{ key: 'guitar' }, { field: 'maxVoices' }]);
  assert.equal(parseLink('no-symbol'), undefined);
});

test('definitions: a define, an enum body, a function body (a prototype and a call are none), a table, a TS const', () => {
  const h = definitions(`#define A 1\nint f(int);\nint g(void) { return f(1); }\nint f(int x)\n{\n  return x;\n}\nstatic int T[2] = { 1, 2 };\n`, 'f');
  assert.deepEqual(h.map((d) => d.kind), ['function']);
  assert.match(h[0].text, /return x;\n\}$/);
  assert.deepEqual(definitions('static int T[2] = { 1, 2 };\nif (T == 0) {}\n', 'T').map((d) => d.kind), ['var']);
  assert.deepEqual(definitions('export const A = 3;\n', 'A').map((d) => [d.kind, d.text]), [['const', 'export const A = 3;']]);
  assert.equal(definitions('/* #define A 1 */\n// int A = 2;\n', 'A').length, 0, 'a comment defines nothing');
});

test('the good links pass, with the value each defines; at-links are unchecked until --at names their tree', () => {
  const r = checkLinks(dataOf(items()), { root: TREE });
  assert.deepEqual(r.problems, []);
  assert.equal(r.checked, 8);
  assert.deepEqual(r.unchecked, ['K_RATES src/k.ts#K_RATES (at openmixer@6ee8a9b)', 'K_RATES src/k.ts#K_RATES (at openmixer@6ee8a9b)']);
  assert.equal(r.none, 0);
  const at = checkLinks(dataOf(items()), { root: TREE, trees: { openmixer: OTHER } });
  assert.deepEqual(at.problems, []);
  assert.equal(at.checked, 10);
  assert.deepEqual(at.unchecked, []);
});

test('contract.source.absent: the link\'s path is not in the tree, or leaves it', () => {
  arm(items({ K_A: { kind: 'scalar', doc: 'd', unit: '', value: 1, source: { impl: 'src/gone.c#omx_k_plan' } } }), 'K_A', 'sourceAbsent');
  arm(items({ K_A: { kind: 'scalar', doc: 'd', unit: '', value: 1, source: { impl: '../outside.c#omx_k_plan' } } }), 'K_A', 'sourceAbsent');
});

test('contract.source.symbol-absent: the symbol was renamed or moved', () => {
  arm(items({ K_A: { kind: 'scalar', doc: 'd', unit: '', value: 1, source: { impl: 'src/omx_k.c#omx_k_plan_renamed' } } }), 'K_A', 'sourceSymbolAbsent');
  arm(items({ K_A: { kind: 'scalar', doc: 'd', unit: '', value: 1, source: { impl: 'include/omxdsp/omx_k.h#struct omx_k_kind' } } }), 'K_A', 'sourceSymbolAbsent');
});

test('contract.source.ambiguous: the path defines the symbol twice', () => {
  arm(items({ K_A: { kind: 'scalar', doc: 'd', unit: '', value: 1, source: { from: 'include/omxdsp/omx_k.h#OMX_K_TWICE' } } }), 'K_A', 'sourceAmbiguous');
});

test('contract.source.differs: the code holds another value than the definition', () => {
  const doc = items();
  doc.K_MAX_MS.value = 101;
  arm(doc, 'K_MAX_MS', 'sourceDiffers');
  const set = items();
  set.K_KINDS.ids = ['peak', 'highShelf', 'lowShelf'];
  arm(set, 'K_KINDS', 'sourceDiffers');
  const field = items();
  field.K_TRAVEL.travel.max = 99;
  arm(field, 'K_TRAVEL', 'sourceDiffers');
  const f32 = items();
  f32.K_Q.value = 0.7071;
  arm(f32, 'K_Q', 'sourceDiffers');
  const list = items();
  list.K_RATES.values = [44100, 96000];
  assert.deepEqual(codesOf(list, { trees: { openmixer: OTHER } }), [`K_RATES:${CONTRACT_CODES.sourceDiffers}`]);
});

test('contract.source.unevaluable: a selector into a table, a function, a macro with parameters', () => {
  for (const from of ['src/omx_k.c#omx_k_table[0].maxVoices', 'src/omx_k.c#omx_k_plan', 'include/omxdsp/omx_k.h#OMX_K_SQUARE']) {
    arm(items({ K_A: { kind: 'scalar', doc: 'd', unit: '', value: 4, source: { from } } }), 'K_A', 'sourceUnevaluable');
  }
});

test('contract.source.unread: the connector does not name the item', () => {
  arm(items({ K_LIMIT: { kind: 'scalar', doc: 'd', unit: '', value: 1, source: { impl: 'src/omx_k.c#omx_k_other' } } }), 'K_LIMIT', 'sourceUnread');
  // the enum is K_KINDS's twin: an impl that is the item's own from link holds it; any other enum must name it
  const twin = items();
  twin.K_KINDS.source.impl = 'include/omxdsp/omx_k.h#enum omx_k_kind';
  assert.deepEqual(codesOf(twin), []);
  delete twin.K_KINDS.source.from;
  arm(twin, 'K_KINDS', 'sourceUnread');
  // the function body names OMX_K_MAX_MS_DOUBLE, a name derived from OMX_K_MAX_MS: K_MAX_MS is read there
  assert.deepEqual(codesOf(items()).filter((c) => c.startsWith('K_MAX_MS')), []);
});

test('contract.source.none only with --require-impl; a file\'s source stands for its items', () => {
  const doc = items({ K_BARE: { kind: 'scalar', doc: 'd', unit: '', value: 1 } });
  assert.deepEqual(codesOf(doc), []);
  arm(doc, 'K_BARE', 'sourceNone', { requireImpl: true });
  const filed = { ...items(), source: { impl: 'src/omx_k.c#omx_k_plan' }, K_MAX_MS_DOUBLE: { kind: 'scalar', doc: 'd', unit: 'ms', value: 200 } };
  assert.deepEqual(codesOf(filed, { requireImpl: true }), []);
});

test('the CLI: links --check exits 1 naming the code first, 0 over a clean tree; the shipped data carries no link yet', () => {
  const dir = mkdtempSync(join(tmpdir(), 'omx-links-cli-'));
  const doc = items();
  doc.K_MAX_MS.value = 101;
  put(dir, 'data/x.json', JSON.stringify(doc));
  const run = (...a) => spawnSync(process.execPath, [join(ROOT, 'bin/omx-contract.mjs'), 'links', ...a], { encoding: 'utf8' });
  const bad = run('--check', '--root', TREE, '--data', join(dir, 'data'), '--json');
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /^contract\.source\.differs data\/x\.json: K_MAX_MS: include\/omxdsp\/omx_k\.h#OMX_K_MAX_MS: /m);
  assert.deepEqual(JSON.parse(bad.stdout.split('\n')[0]).problems.map((p) => p.code), ['contract.source.differs']);
  put(dir, 'data/x.json', JSON.stringify(items()));
  assert.equal(run('--check', '--root', TREE, '--data', join(dir, 'data')).status, 0);
  const shipped = run('--check', '--root', ROOT);
  assert.equal(shipped.status, 0);
  assert.match(shipped.stdout, new RegExp(`0 links checked .* ${DATA_ITEMS} items with no impl link`));
  assert.equal(run('--check', '--root', ROOT, '--require-impl').status, 1, 'every shipped item lacks its impl link today');
  rmSync(dir, { recursive: true, force: true });
});

put(TREE, 'src/names.c', `int gate_clamp(float r) { return r < OMX_GATE_RATIO_MIN; }
float pan_clamp(float p) { return p > OMX_PAN_PAN_MAX ? OMX_PAN_PAN_MAX : p; }
int stage_warm(void) { return CLAP_HOST_WARMUP_BLOCKS; }
const char *stage_refusal(void) { return CLAP_HOST_CODE_NOTE_INPUT; }
int stage_worker(void) { return CLAP_HOST_WORKER_RING_BYTES; }
int kernel_taps(void) { return OMX_FX_TAPS_MAX; }
int unrelated(void) { return OMX_OTHER_THING; }
`);

test('an impl names its item by any C name the render spells for it: a limit table\'s field, an alias, a kernel macro, an owner\'s prefix', () => {
  const at = (sym) => ({ impl: `src/names.c#${sym}` });
  const doc = (impl) => ({
    $schema: '../schema/omx-contract.schema.json',
    render: { c: [{ header: 'clap_host_limits.h', guard: 'CLAP_HOST_LIMITS_H', project: 'p', banner: ['b'], brief: 'b', numbers: { comment: 'c', prefix: 'CLAP_HOST_', omit: ['worker*'] }, codes: { comment: 'c', prefix: 'CLAP_HOST_CODE_' } }] },
    STAGE_LIMITS: { kind: 'sheet', doc: 'd', value: { warmupBlocks: 64, workerRingBytes: 16384 }, source: at(impl.STAGE_LIMITS ?? 'stage_warm') },
    STAGE_CODES: { kind: 'codes', doc: 'd', codes: { noteInput: { code: 'hosting.clap.note-input' } }, source: at(impl.STAGE_CODES ?? 'stage_refusal') },
  });
  const other = (impl) => ({
    $schema: '../../schema/omx-contract.schema.json',
    controls: [{ name: 'pan', kind: 'travel', global: 'PAN_RANGE', doc: 'd', travel: { min: -1, max: 1 }, c: { alias: { fact: 'pan', field: 'pan' } }, source: at(impl.PAN_RANGE ?? 'pan_clamp') }],
    tables: { GATE_LIMITS: { doc: 'd', source: at(impl.GATE_LIMITS ?? 'gate_clamp') } },
    constants: { FX_TAPS_KERNEL: { kind: 'sheet', doc: 'd', value: { max: 4 }, source: at(impl.FX_TAPS_KERNEL ?? 'kernel_taps') } },
  });
  const run = (impl = {}) => {
    const k = other(impl);
    k.controls.push({ name: 'ratio', kind: 'travel', table: 'GATE_LIMITS', travel: { min: 1, max: 10 } });
    const data = loadData(null, { 'data/x.json': JSON.stringify(doc(impl)), 'data/kernels/fx.json': JSON.stringify(k) });
    return checkLinks(data, { root: TREE }).problems.map((p) => `${p.item}:${p.code}`);
  };
  assert.deepEqual(run(), [], 'GATE_LIMITS by OMX_GATE_RATIO_MIN, PAN_RANGE by OMX_PAN_PAN_MAX, FX_TAPS_KERNEL by OMX_FX_TAPS_MAX, the sheet by CLAP_HOST_*, the codes by CLAP_HOST_CODE_*');
  // sabotage: each item's connector reads something else, and is refused as unread
  const unread = CONTRACT_CODES.sourceUnread;
  for (const item of ['GATE_LIMITS', 'PAN_RANGE', 'FX_TAPS_KERNEL', 'STAGE_LIMITS', 'STAGE_CODES']) assert.deepEqual(run({ [item]: 'unrelated' }), [`${item}:${unread}`], item);
  assert.deepEqual(run({ STAGE_LIMITS: 'stage_worker' }), [`STAGE_LIMITS:${unread}`], 'an omitted field is no C name of the item');
  raised.add(unread);
});

test('a link may carry its own at: an impl in the owner\'s tree beside a from in another tree at the commit it was read', () => {
  put(TREE, 'src/limit.c', 'int k_limit_clamp(int v) { return v > OMX_K_LIMIT ? OMX_K_LIMIT : v; }\n');
  const doc = items({ K_LIMIT: { kind: 'scalar', doc: 'd', unit: '', value: 7, source: { impl: 'src/limit.c#k_limit_clamp', from: { link: 'src/k.ts#K_LIMIT', at: 'openmixer@6ee8a9b' } } } });
  const r = checkLinks(dataOf(doc), { root: TREE });
  assert.deepEqual(r.problems, []);
  assert.ok(r.unchecked.includes('K_LIMIT src/k.ts#K_LIMIT (at openmixer@6ee8a9b)'), 'the from lies in a tree not named');
  assert.ok(!r.unchecked.some((u) => u.startsWith('K_LIMIT src/limit.c')), 'the impl, at no at of its own, is the owner\'s and checked');
  assert.deepEqual(checkLinks(dataOf(doc), { root: TREE, trees: { openmixer: OTHER } }).problems, [], 'named, the from is read there and holds 7');
  doc.K_LIMIT.value = 8;
  assert.deepEqual(codesOf(doc, { trees: { openmixer: OTHER } }), [`K_LIMIT:${CONTRACT_CODES.sourceDiffers}`], 'and a moved value is red');
  const map = items({ K_TRAVEL: { ...items().K_TRAVEL, source: { impl: 'src/omx_k.c#omx_k_travel_clamp', from: { max: { link: 'src/k.ts#K_LIMIT', at: 'openmixer@6ee8a9b' } } } } });
  assert.deepEqual(codesOf(map, { trees: { openmixer: OTHER } }), [`K_TRAVEL:${CONTRACT_CODES.sourceDiffers}`], 'a field of a from map with its own at: K_LIMIT 7 is not the max 100');
  assert.deepEqual(validateData(dataOf(doc)).filter((p) => p.rule === 'schema'), [], 'the schema takes { link, at }');
  const bad = items({ K_X: { kind: 'scalar', doc: 'd', unit: '', value: 1, source: { from: { link: 'src/k.ts#K_LIMIT', at: 'not a package' } } } });
  assert.ok(validateData(dataOf(bad)).some((p) => p.item === 'K_X' && p.rule === 'schema'), 'an at that is no <package>@<version> is refused');
});

test('every source code has its arm', () => {
  const source = Object.entries(CONTRACT_CODES).filter(([k]) => k.startsWith('source')).map(([, c]) => c);
  assert.deepEqual(source.filter((c) => !raised.has(c)), []);
  assert.equal(source.length, 7);
});
