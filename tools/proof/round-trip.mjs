#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
/**
 * The round-trip proof (omx-contract spec §4.4 steps 1 and 2), against omx-dsp v0.1.3's committed
 * headers frozen under test/fixtures/omx-dsp-v0.1.3/:
 *
 *   1. the frozen openmixer sheet (test/fixtures/openmixer-f98836216b53.json) renders both headers
 *      byte for byte;
 *   2. the shipped data's render, split with limitUnits, has every unit byte-identical to the unit of
 *      the same key in omx-dsp's header, in the same order, and no unit the header lacks; the units
 *      omx-dsp reads are among them except the three ruling (h) leaves in openmixer; the delay
 *      table's enum, rows and macros are byte-identical. It prints the residue and the banner diff.
 *
 * Usage: node tools/proof/round-trip.mjs [--quiet]; exit 1 when a step fails.
 */
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadData, resolveData } from '../../lib/data.mjs';
import { renderC, renderSheetC } from '../../render/c.mjs';
import { limitUnits } from './limit-units.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const FIX = join(ROOT, 'test/fixtures');
/** Ruling (h), spec §4.1 item 8: read by omx-dsp's biquad test today, never moved. */
export const RULING_H = ['OMX_OPERATOR_EQ_BANDS_RESERVE', 'OMX_FBS_DEFAULT_MAX_AUTO_BANDS', 'OMX_HRP_DEFAULT_MAX_AUTO_BANDS'];

const text = (u) => u.lines.join('\n');
const units = (t) => limitUnits(t).filter((u) => u.frame === undefined);
const frames = (t) => limitUnits(t).filter((u) => u.frame !== undefined).map((u) => u.frame);

/** The proof over `resolved` (default: the shipped data). Returns the report; `ok` is the verdict. */
export function roundTrip(resolved = resolveData(loadData(join(ROOT, 'data')))) {
  const pinLimits = readFileSync(join(FIX, 'omx-dsp-v0.1.3/omx_contract_limits.h'), 'utf8');
  const pinDelay = readFileSync(join(FIX, 'omx-dsp-v0.1.3/omx_delay_params.h'), 'utf8');
  const readUnits = JSON.parse(readFileSync(join(FIX, 'omx-dsp-v0.1.3/read-units.json'), 'utf8')).read.map((r) => r.key);

  // step 1
  const sheet = renderSheetC(JSON.parse(readFileSync(join(FIX, 'openmixer-f98836216b53.json'), 'utf8')));
  const step1 = {
    limits: sheet.find((f) => f.path.endsWith('omx_contract_limits.h')).text === pinLimits,
    delay: sheet.find((f) => f.path.endsWith('omx_delay_params.h')).text === pinDelay,
  };

  // step 2
  const files = renderC(resolved);
  const shipped = files.find((f) => f.path === 'omxcontract/omx_contract_limits.h').text;
  const delay = files.find((f) => f.path === 'omxcontract/params/omx_delay_params.h')?.text ?? '';
  const P = units(pinLimits);
  const S = units(shipped);
  const pin = new Map(P.map((u) => [u.key, u]));
  const ours = new Set(S.map((u) => u.key));
  const differing = S.filter((u) => pin.has(u.key) && text(pin.get(u.key)) !== text(u)).map((u) => u.key);
  const notInPin = S.filter((u) => !pin.has(u.key)).map((u) => u.key);
  const order = P.filter((u) => ours.has(u.key)).map((u) => u.key);
  const inOrder = JSON.stringify(order) === JSON.stringify(S.filter((u) => pin.has(u.key)).map((u) => u.key));
  const residue = P.filter((u) => !ours.has(u.key)).map((u) => u.key);
  const readMissing = readUnits.filter((k) => !ours.has(k));
  const body = (t) => t.split('\n').filter((l) => /^ {2}(OMX_|\{ ")|^#define |^static const omx_plugin_param /.test(l));
  const delayIdentical = JSON.stringify(body(delay)) === JSON.stringify(body(pinDelay));
  const pf = new Set(frames(pinLimits));
  const sf = new Set(frames(shipped));
  const banner = { removed: [...pf].filter((l) => !sf.has(l)), added: [...sf].filter((l) => !pf.has(l)) };
  const step2 = {
    units: S.length, pinUnits: P.length, identical: S.length - differing.length - notInPin.length, differing, notInPin, inOrder,
    read: readUnits.length, readAmong: readUnits.length - readMissing.length, readMissing,
    readMissingIsRulingH: JSON.stringify([...readMissing].sort()) === JSON.stringify([...RULING_H].sort()),
    residue, delayIdentical, banner,
  };
  const ok = step1.limits && step1.delay && !differing.length && !notInPin.length && inOrder && step2.readMissingIsRulingH && delayIdentical
    && residue.length === P.length - S.length;
  return { ok, step1, step2 };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const r = roundTrip();
  const s = r.step2;
  if (!process.argv.includes('--quiet')) {
    console.log(`residue (${s.residue.length} units of omx-dsp's header the contract does not carry):`);
    for (const k of s.residue) console.log(`  ${k}`);
    console.log(`banner and frame lines only omx-dsp's header has (${s.banner.removed.length}):`);
    for (const l of s.banner.removed) console.log(`  - ${l}`);
    console.log(`banner and frame lines only the contract's header has (${s.banner.added.length}):`);
    for (const l of s.banner.added) console.log(`  + ${l}`);
  }
  console.log(`step 1: omx_contract_limits.h ${r.step1.limits ? 'BYTE-IDENTICAL' : 'DIFFERS'}, omx_delay_params.h ${r.step1.delay ? 'BYTE-IDENTICAL' : 'DIFFERS'}`);
  console.log(`step 2: ${s.identical}/${s.units} units byte-identical to omx-dsp's (of ${s.pinUnits}), order ${s.inOrder ? 'kept' : 'BROKEN'}, ` +
    `${s.readAmong}/${s.read} read units among them (missing: ${s.readMissing.join(', ') || 'none'}${s.readMissingIsRulingH ? ', ruling (h)' : ''}), ` +
    `delay rows and macros ${s.delayIdentical ? 'identical' : 'DIFFER'}, residue ${s.residue.length}`);
  if (s.differing.length || s.notInPin.length) console.log(`  differing: ${s.differing.join(', ')}; not in omx-dsp's header: ${s.notInPin.join(', ')}`);
  console.log(`ROUND-TRIP-JSON ${JSON.stringify({ ok: r.ok, step1: r.step1, units: s.units, identical: s.identical, pinUnits: s.pinUnits, read: s.read, readAmong: s.readAmong, residue: s.residue.length, bannerLines: s.banner.removed.length + s.banner.added.length })}`);
  process.exitCode = r.ok ? 0 : 1;
}
