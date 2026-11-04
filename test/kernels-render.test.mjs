// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
// The json render's `kernels` (#18): each kernel's controls in their declared order, with kind, the global each
// resolves to, the table of a table field and `rearms`. Added beside `items`, never changing it.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { main } from '../bin/omx-contract.mjs';
import { controlGlobal, loadData, resolveData } from '../lib/data.mjs';
import { formatDoc } from '../lib/fmt.mjs';
import { validateData } from '../lib/validate.mjs';
import { renderJson } from '../render/json.mjs';
import { DATA, RENDERS, ROOT, UNION, editData, scratchData, texts } from './helpers.mjs';

const render = (dir = UNION) => JSON.parse(renderJson(resolveData(loadData(dir)), '0.0.0')[0].text);
const kernelFiles = () => loadData(UNION).files.filter((f) => f.rel.startsWith('data/kernels/'));
const problems = (t) => validateData(loadData(null, t));

test('kernels: every kernel file, in file order, its controls in their declared order', () => {
  const { kernels } = render();
  const files = kernelFiles();
  assert.deepEqual(Object.keys(kernels), files.map((f) => f.rel.replace(/^data\/kernels\//, '').replace(/\.json$/, '')));
  for (const f of files) {
    const k = f.rel.replace(/^data\/kernels\//, '').replace(/\.json$/, '');
    const all = f.doc.controls ?? [];
    const want = all.filter((c) => c.of === undefined).map((c) => {
      const when = all.filter((x) => x.of === c.name).map((x) => ({ control: x.when.control, is: x.when.is, global: controlGlobal(f.rel, x) }));
      return {
        name: c.name,
        kind: c.kind,
        global: c.table ?? controlGlobal(f.rel, c),
        ...(c.table ? { table: c.table } : {}),
        ...(c.rearms ? { rearms: true } : {}),
        ...(c.count ? { count: c.count } : {}),
        ...(when.length ? { when } : {}),
      };
    });
    assert.deepEqual(kernels[k].controls, want, k);
  }
});

test('kernels: each control names the item its value lives in', () => {
  const { items, kernels } = render();
  let n = 0;
  for (const [k, { controls }] of Object.entries(kernels)) {
    for (const c of controls) {
      const it = items[c.global];
      assert.ok(it, `${k}.${c.name}: ${c.global} is an item`);
      assert.equal(it.rel, `data/kernels/${k}.json`, `${k}.${c.name}: ${c.global} is the kernel's own`);
      if (c.kind === 'choice') assert.equal(it.kind, 'set', `${k}.${c.name}`);
      else if (c.table) { assert.equal(c.table, c.global); assert.equal(it.shape, 'table'); assert.ok(c.name in it.value, `${k}.${c.name} is a field of ${c.table}`); }
      else assert.equal(it.shape, 'travel', `${k}.${c.name}`);
      n++;
    }
  }
  assert.ok(n >= 25, `${n} controls: a short list proves nothing`);
});

test('kernels: the control that declares rearms carries it, and no other does', () => {
  const { kernels } = render();
  const rearming = Object.entries(kernels).flatMap(([k, { controls }]) => controls.filter((c) => c.rearms).map((c) => `${k}.${c.name}`));
  assert.deepEqual(rearming, ['swell.lookaheadMs']);
  for (const { controls } of Object.values(kernels)) for (const c of controls) assert.ok(!('rearms' in c) || c.rearms === true);
});

test('kernels is a new key: name, version and items are what a render without it writes', () => {
  const r = resolveData(loadData(UNION));
  const withKernels = JSON.parse(renderJson(r, '0.0.0')[0].text);
  assert.deepEqual(Object.keys(withKernels), ['name', 'version', 'items', 'kernels']);
  delete r.kernels;
  const without = renderJson(r, '0.0.0')[0].text;
  const { kernels, ...rest } = withKernels;
  assert.equal(`${JSON.stringify(rest, null, 2)}\n`, without);
});

test('perturbation: move a control in its kernel file, the render order follows and --check goes red', () => {
  const dir = scratchData();
  const before = render(dir).kernels.wave.controls.map((c) => c.name);
  editData(dir, 'kernels/wave.json', (d) => { d.controls.reverse(); });
  const after = render(dir).kernels.wave.controls.map((c) => c.name);
  assert.deepEqual(after, [...before].reverse());
  assert.equal(main(['render', '--target', 'json', '--out', `${RENDERS}/share/omx-contract`, '--check', '--data', dir]), 1);
});

test('perturbation: drop rearms from the swell, the render loses it and --check goes red', () => {
  const dir = scratchData();
  editData(dir, 'kernels/swell.json', (d) => { for (const c of d.controls) delete c.rearms; });
  const c = render(dir).kernels.swell.controls.find((x) => x.name === 'lookaheadMs');
  assert.ok(c && !('rearms' in c));
  assert.equal(main(['render', '--target', 'json', '--out', `${RENDERS}/share/omx-contract`, '--check', '--data', dir]), 1);
  // rearms is no item: the c and ts renders do not move
  assert.equal(main(['render', '--target', 'c', '--out', `${RENDERS}/include`, '--check', '--data', dir]), 0);
  assert.equal(main(['render', '--target', 'ts', '--out', `${RENDERS}/test/golden/ts`, '--check', '--data', dir]), 0);
});

test('perturbation: declare rearms on another control, the render carries it', () => {
  const dir = scratchData();
  editData(dir, 'kernels/wave.json', (d) => { d.controls.find((c) => c.name === 'rateHz').rearms = true; });
  assert.equal(render(dir).kernels.wave.controls.find((c) => c.name === 'rateHz').rearms, true);
});

test('validation: rearms is a boolean, and only on a control', () => {
  const rule = (t) => problems(t).map((p) => `${p.file}: ${p.rule}: ${p.message}`).join('\n');
  assert.match(rule(texts((d) => { d['data/kernels/swell.json'].controls[4].rearms = 'yes'; })), /swell\.json: shape: controls\[4\] lookaheadMs: rearms "yes" is not a boolean/);
  assert.match(rule(texts((d) => { d['data/kernels/swell.json'].tables.SWELL_LIMITS.rearms = true; })), /swell\.json: shape: tables SWELL_LIMITS: rearms is a control's flag/);
  assert.match(rule(texts((d) => { d['data/kernels/wave.json'].aggregates.WAVE_TRAVELS.rearms = true; })), /wave\.json: shape: aggregates WAVE_TRAVELS: rearms is a control's flag/);
  const constant = Object.keys(JSON.parse(texts()['data/kernels/echo.json']).constants)[0];
  assert.match(rule(texts((d) => { d['data/kernels/echo.json'].constants[constant].rearms = true; })), new RegExp(`echo\\.json: shape: constants ${constant}: rearms is a control's flag`));
  assert.match(rule(texts((d) => { d['data/rates.json'].STANDARD_SAMPLE_RATES.rearms = true; })), /rates\.json: schema: .*additional properties/);
  assert.deepEqual(problems(texts((d) => { d['data/kernels/swell.json'].controls[0].rearms = false; })), []);
});

test('fmt: rearms is written after a control\'s table', () => {
  const doc = { controls: [{ travel: { max: 1, min: 0 }, rearms: true, table: 'T', kind: 'travel', name: 'x' }] };
  assert.deepEqual(Object.keys(JSON.parse(formatDoc(doc)).controls[0]), ['name', 'kind', 'table', 'rearms', 'travel']);
});
