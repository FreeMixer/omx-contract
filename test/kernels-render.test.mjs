// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
// The json render's `kernels` (#18): each kernel's controls in their declared order, with kind, the global each
// resolves to and the table of a table field. Added beside `items`, never changing it.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { main } from '../bin/omx-contract.mjs';
import { controlGlobal, loadData, resolveData } from '../lib/data.mjs';
import { renderJson } from '../render/json.mjs';
import { DATA, ROOT, editData, scratchData } from './helpers.mjs';

const render = (dir = DATA) => JSON.parse(renderJson(resolveData(loadData(dir)), '0.0.0')[0].text);
const kernelFiles = () => loadData(DATA).files.filter((f) => f.rel.startsWith('data/kernels/'));

test('kernels: every kernel file, in file order, its controls in their declared order', () => {
  const { kernels } = render();
  const files = kernelFiles();
  assert.deepEqual(Object.keys(kernels), files.map((f) => f.rel.replace(/^data\/kernels\//, '').replace(/\.json$/, '')));
  for (const f of files) {
    const k = f.rel.replace(/^data\/kernels\//, '').replace(/\.json$/, '');
    const want = (f.doc.controls ?? []).map((c) => ({
      name: c.name,
      kind: c.kind,
      global: c.table ?? controlGlobal(f.rel, c),
      ...(c.table ? { table: c.table } : {}),
    }));
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
  assert.ok(n >= 100, `${n} controls: a short list proves nothing`);
});

test('kernels is a new key: name, version and items are what a render without it writes', () => {
  const r = resolveData(loadData(DATA));
  const withKernels = JSON.parse(renderJson(r, '0.0.0')[0].text);
  assert.deepEqual(Object.keys(withKernels), ['name', 'version', 'items', 'kernels']);
  delete r.kernels;
  const without = renderJson(r, '0.0.0')[0].text;
  const { kernels, ...rest } = withKernels;
  assert.equal(`${JSON.stringify(rest, null, 2)}\n`, without);
});

test('perturbation: move a control in its kernel file, the render order follows and --check goes red', () => {
  const dir = scratchData();
  const before = render(dir).kernels.tremolo.controls.map((c) => c.name);
  editData(dir, 'kernels/tremolo.json', (d) => { d.controls.reverse(); });
  const after = render(dir).kernels.tremolo.controls.map((c) => c.name);
  assert.deepEqual(after, [...before].reverse());
  assert.equal(main(['render', '--target', 'json', '--out', `${ROOT}/share/omx-contract`, '--check', '--data', dir]), 1);
});
