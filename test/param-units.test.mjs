// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
/**
 * The unit codes of org.openmixer.param-contract/1 (#145): OMX_PARAM_CONTRACT_UNITS of data/param-contract.json, the
 * one declaration. omx-plugins includes the rendered omx_param_units.h, omx-panel and plugin-hostd read the item as
 * data. A code is never changed or reused: the table below is the one omx-plugins shipped as contract/param-units.json
 * (0.15.0), written out here so the declaration is held to something.
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { loadData, resolveData } from '../lib/data.mjs';
import { renderC } from '../render/c.mjs';
import { ROOT, scratchDir, texts, resolvedOf } from './helpers.mjs';

const SHIPPED = {
  none: 0, s: 1, ms: 2, min: 3, bar: 4, beat: 5, frame: 6, m: 7, cm: 8, mm: 9, km: 10, inch: 11, mile: 12, db: 13, pc: 14, coef: 15, hz: 16, khz: 17,
  mhz: 18, bpm: 19, oct: 20, cent: 21, semitone12TET: 22, degree: 23, midiNote: 24, dbfs: 0x100, dbu: 0x101, ratio: 0x102, lufs: 0x103,
};
const declared = () => resolveData(loadData(join(ROOT, 'data'))).get('OMX_PARAM_CONTRACT_UNITS');
const header = () => readFileSync(join(ROOT, 'include/omxcontract/omx_param_units.h'), 'utf8');
const constOf = (t) => t.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toUpperCase();

test('the declared unit codes are the ones omx-plugins shipped, append-only', () => {
  const v = declared().value;
  for (const [t, code] of Object.entries(SHIPPED)) assert.equal(v[t], code, `${t} keeps its code`);
  for (const t of Object.keys(v)) if (!(t in SHIPPED)) assert.ok(v[t] > 0x103, `${t} is appended after the vendor block`);
});

test('the header defines one OMX_CLAP_UNIT_ code per declared unit, and no other', () => {
  const v = declared().value;
  const defs = new Map([...header().matchAll(/^#define OMX_CLAP_UNIT_(\w+) (\d+)u$/gm)].map((m) => [m[1], Number(m[2])]));
  assert.deepEqual([...defs.keys()].sort(), Object.keys(v).map(constOf).sort());
  for (const [t, code] of Object.entries(v)) assert.equal(defs.get(constOf(t)), code, t);
});

test('the doors spell a sheet named OMX_ once: OMX_PARAM_CONTRACT_UNITS_DB, never OMX_OMX_', () => {
  const limits = renderC(resolvedOf(texts())).find((f) => f.path === 'omxcontract/omx_contract_limits.h').text;
  assert.match(limits, /^#define OMX_PARAM_CONTRACT_UNITS_DB 13$/m);
  assert.doesNotMatch(limits, /OMX_OMX_/);
});

const cc = (process.env.CC ?? 'cc').split(' ');
test('a C reader sees the codes from the installed header', { skip: spawnSync(cc[0], [...cc.slice(1), '--version']).status !== 0 && 'no cc' }, () => {
  const dir = scratchDir('omx-param-units-');
  writeFileSync(join(dir, 't.c'), `#include <omxcontract/omx_param_units.h>
_Static_assert(OMX_CLAP_UNIT_NONE == 0 && OMX_CLAP_UNIT_DB == 13 && OMX_CLAP_UNIT_MIDI_NOTE == 24, "LV2 units one to one");
_Static_assert(OMX_CLAP_UNIT_DBFS == 0x100 && OMX_CLAP_UNIT_LUFS == 0x103, "the vendor block");
int main(void) { return OMX_CLAP_UNIT_SEMITONE12_TET == 22 ? 0 : 1; }
`);
  const r = spawnSync(cc[0], [...cc.slice(1), '-std=c11', '-Wall', '-Wextra', '-Werror', '-I', join(ROOT, 'include'), join(dir, 't.c'), '-o', join(dir, 't')], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(spawnSync(join(dir, 't')).status, 0);
});

test('sabotage: a unit whose code changed in the data is not the shipped code, and the committed header goes stale', () => {
  const t = texts((d) => { d['data/param-contract.json'].OMX_PARAM_CONTRACT_UNITS.value.db = 99; });
  const v = resolvedOf(t).get('OMX_PARAM_CONTRACT_UNITS').value;
  assert.notEqual(v.db, SHIPPED.db);
  const text = renderC(resolvedOf(t)).find((f) => f.path === 'omxcontract/omx_param_units.h').text;
  assert.notEqual(text, header());
});
