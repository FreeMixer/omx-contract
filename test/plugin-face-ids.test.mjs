// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
/**
 * The ids a plugin face gives its own controls: OMX_PLUGIN_FACE_IDS of data/plugin-face.json, rendered to
 * omx_plugin_face_ids.h. The CLAP bypass id and the LV2 enabled and latency indices are permanent: a host keeps bypass
 * automation by the id, so a value here is never changed. The table below is the one 3.9.0 first shipped.
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { loadData, resolveData } from '../lib/data.mjs';
import { renderC } from '../render/c.mjs';
import { ROOT, scratchDir, texts, resolvedOf } from './helpers.mjs';

const SHIPPED = { bypassClapId: 0x7fff0000, enabledLv2Index: 0, latencyLv2Index: 1 };
const declared = () => resolveData(loadData(join(ROOT, 'data'))).get('OMX_PLUGIN_FACE_IDS');
const header = () => readFileSync(join(ROOT, 'include/omxcontract/omx_plugin_face_ids.h'), 'utf8');

test('the face ids are the ones first shipped, and no field is added or dropped', () => {
  assert.deepEqual(declared().value, SHIPPED);
});

test('the bypass id lies below INT32_MAX and far past any declaration; enabled and latency are two distinct ports', () => {
  const v = declared().value;
  assert.ok(v.bypassClapId < 2 ** 31 - 1 && v.bypassClapId >= 0x10000);
  assert.notEqual(v.enabledLv2Index, v.latencyLv2Index);
});

test('the header defines the three ids, and no other', () => {
  const defs = new Map([...header().matchAll(/^#define OMX_PLUGIN_FACE_(\w+) (\d+)u\b/gm)].map((m) => [m[1], Number(m[2])]));
  assert.deepEqual(Object.fromEntries(defs), { BYPASS_CLAP_ID: SHIPPED.bypassClapId, ENABLED_LV2_INDEX: 0, LATENCY_LV2_INDEX: 1 });
});

const cc = (process.env.CC ?? 'cc').split(' ');
test('a C reader sees the ids from the installed header', { skip: spawnSync(cc[0], [...cc.slice(1), '--version']).status !== 0 && 'no cc' }, () => {
  const dir = scratchDir('omx-plugin-face-ids-');
  writeFileSync(join(dir, 't.c'), `#include <omxcontract/omx_plugin_face_ids.h>
_Static_assert(OMX_PLUGIN_FACE_BYPASS_CLAP_ID == 0x7FFF0000u, "the bypass id");
_Static_assert(OMX_PLUGIN_FACE_ENABLED_LV2_INDEX == 0u && OMX_PLUGIN_FACE_LATENCY_LV2_INDEX == 1u, "the first two ports");
int main(void) { return 0; }
`);
  const r = spawnSync(cc[0], [...cc.slice(1), '-std=c11', '-Wall', '-Wextra', '-Werror', '-I', join(ROOT, 'include'), join(dir, 't.c'), '-o', join(dir, 't')], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(spawnSync(join(dir, 't')).status, 0);
});

test('sabotage: a bypass id moved in the data is not the shipped id, and the committed header goes stale', () => {
  const t = texts((d) => { d['data/plugin-face.json'].OMX_PLUGIN_FACE_IDS.value.bypassClapId = 51; });
  assert.notEqual(resolvedOf(t).get('OMX_PLUGIN_FACE_IDS').value.bypassClapId, SHIPPED.bypassClapId);
  const text = renderC(resolvedOf(t)).find((f) => f.path === 'omxcontract/omx_plugin_face_ids.h').text;
  assert.notEqual(text, header());
});
