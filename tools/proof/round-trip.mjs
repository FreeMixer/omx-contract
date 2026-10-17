#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
/**
 * The round-trip proof, against omx-dsp v0.1.3's committed
 * headers frozen under test/fixtures/omx-dsp-v0.1.3/:
 *
 *   1. the frozen sheet (test/fixtures/frozen-limits-sheet.json) renders the limits header
 *      byte for byte;
 *   2. the shipped data's render, split with limitUnits, has every unit byte-identical to the unit of
 *      the same key in omx-dsp's header, in the same order, and no unit the header lacks; every unit
 *      omx-dsp reads is among them. It prints the residue and the banner diff. (The delay plugin's
 *      parameter header left omx-contract in 1.1.0: omx-plugins renders it from its declaration, so
 *      step 2 compares the limits header alone.)
 *      A unit omx-dsp's header lacks is allowed only when it belongs to an item a later release
 *      added (its answer, or its kernel's answers, say `since` after the first release); a unit of a later item
 *      that omx-dsp's header does hold must still be byte-identical to it, but for the units MOVED_AFTER_PIN
 *      names: a later item whose value the console engine moved after v0.1.3 froze, declared with the value
 *      in use today. Each is reported as moved, and the list is exact: a named unit that is equal again, or
 *      that belongs to an item of the first release, fails the proof.
 *
 * The data it proves is omx-dsp's, which omx-contract carried until 2.14.0: the proof reads data/ together with
 * those files frozen at their 2.14.0 bytes (test/fixtures/owners-2.14.0/), until it moves to omx-dsp beside them.
 *
 * Usage: node tools/proof/round-trip.mjs [--quiet]; exit 1 when a step fails.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TOOL_FILES, entriesOf, loadData, resolveData } from '../../lib/data.mjs';
import { renderC, renderSheetC } from '../../render/c.mjs';
import { itemSince } from '../kernel-recipe.mjs';
import { limitUnits } from './limit-units.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const FIX = join(ROOT, 'test/fixtures');
/** The definitions omx-contract carried until 2.14.0 that their owners now install, at their 2.14.0 bytes. */
export const OWNERS_FIXTURE = 'test/fixtures/owners-2.14.0';

/** Every `.json` under `dir`, as `{ 'data/<rel>': text }`, the tool files at its top left out. */
function textsUnder(dir, pre = '') {
  const out = {};
  for (const f of existsSync(dir) ? readdirSync(dir, { withFileTypes: true }) : []) {
    const rel = pre ? `${pre}/${f.name}` : f.name;
    if (f.isDirectory()) Object.assign(out, textsUnder(join(dir, f.name), rel));
    else if (f.name.endsWith('.json') && !(pre === '' && TOOL_FILES.includes(f.name))) out[`data/${rel}`] = readFileSync(join(dir, f.name), 'utf8');
  }
  return out;
}

/** The data the proof reads: data/ and the owners' fixture, one data directory as 2.14.0 shipped it. */
export const proofData = (root = ROOT) => loadData(null, { ...textsUnder(join(root, 'data')), ...textsUnder(join(root, OWNERS_FIXTURE)) });

const text = (u) => u.lines.join('\n');
const units = (t) => limitUnits(t).filter((u) => u.frame === undefined);
const frames = (t) => limitUnits(t).filter((u) => u.frame !== undefined).map((u) => u.frame);

/**
 * The units of later items whose value moved after omx-dsp v0.1.3 froze, each with the reason. The contract
 * declares the value the console engine uses today; the frozen header keeps the value of its day.
 */
export const MOVED_AFTER_PIN = new Map([
  ['OMX_INPUT_ALIGN_DELAY_RANGE_STEP', 'the input alignment step went from 0.01 ms to 0.0001 ms when the alignment line became a fractional read'],
  ['OMX_INPUT_ALIGN_DELAY_RANGE_STEP_DOUBLE', 'the same step, as a double'],
]);

/** The items added after the first release: every answered item whose `since` (its own, else its kernel's) is later, and every item of the files beside the kernels (rates, primitives, hosting) that says so. */
export function addedAfterFirstRelease(root = ROOT) {
  const recipe = JSON.parse(readFileSync(join(root, 'recipes/kernel.recipe.json'), 'utf8'));
  const dir = join(root, recipe.tree.answersDir);
  const out = new Set();
  for (const f of existsSync(dir) ? readdirSync(dir) : []) {
    const a = JSON.parse(readFileSync(join(dir, f), 'utf8'));
    // `renderedSince`: an item whose C render a later release switched on (its units are new to the header)
    for (const it of a.items) if (itemSince(a, it) !== recipe.tree.firstRelease || (it.renderedSince ?? recipe.tree.firstRelease) !== recipe.tree.firstRelease) out.add(it.name);
  }
  // an item outside the kernels (rates, primitives, hosting) records its release on the item itself
  for (const data of [join(root, 'data'), join(root, OWNERS_FIXTURE)]) {
    for (const f of (existsSync(data) ? readdirSync(data) : []).filter((n) => n.endsWith('.json') && !TOOL_FILES.includes(n)).sort()) {
      for (const [name, it] of entriesOf(f, JSON.parse(readFileSync(join(data, f), 'utf8')))) {
        if (it.since !== undefined && it.since !== recipe.tree.firstRelease) out.add(name);
      }
    }
  }
  return out;
}

/** The proof over `resolved` (default: proofData()). Returns the report; `ok` is the verdict. */
export function roundTrip(resolved = resolveData(proofData())) {
  const pinLimits = readFileSync(join(FIX, 'omx-dsp-v0.1.3/omx_contract_limits.h'), 'utf8');
  const readUnits = JSON.parse(readFileSync(join(FIX, 'omx-dsp-v0.1.3/read-units.json'), 'utf8')).read.map((r) => r.key);

  // step 1
  const sheet = renderSheetC(JSON.parse(readFileSync(join(FIX, 'frozen-limits-sheet.json'), 'utf8')));
  const step1 = { limits: sheet.find((f) => f.path.endsWith('omx_contract_limits.h')).text === pinLimits };

  // step 2
  const files = renderC(resolved);
  const shipped = files.find((f) => f.path === 'omxcontract/omx_contract_limits.h').text;
  const P = units(pinLimits);
  const S = units(shipped);
  const pin = new Map(P.map((u) => [u.key, u]));
  const ours = new Set(S.map((u) => u.key));
  const unequal = S.filter((u) => pin.has(u.key) && text(pin.get(u.key)) !== text(u)).map((u) => u.key);
  const added = addedAfterFirstRelease();
  const firstRelease = new Set(units(renderC(new Map([...resolved].filter(([n]) => !added.has(n))))
    .find((f) => f.path === 'omxcontract/omx_contract_limits.h').text).map((u) => u.key));
  const moved = unequal.filter((k) => MOVED_AFTER_PIN.has(k) && !firstRelease.has(k));
  const differing = unequal.filter((k) => !moved.includes(k));
  const movedStale = [...MOVED_AFTER_PIN.keys()].filter((k) => !moved.includes(k));
  const addedLater = S.filter((u) => !pin.has(u.key) && !firstRelease.has(u.key)).map((u) => u.key);
  // the units of later items that omx-dsp's header already holds (each compared byte for byte above)
  const heldLater = S.filter((u) => pin.has(u.key) && !firstRelease.has(u.key)).map((u) => u.key);
  const notInPin = S.filter((u) => !pin.has(u.key) && firstRelease.has(u.key)).map((u) => u.key);
  const order = P.filter((u) => ours.has(u.key)).map((u) => u.key);
  const inOrder = JSON.stringify(order) === JSON.stringify(S.filter((u) => pin.has(u.key)).map((u) => u.key));
  const residue = P.filter((u) => !ours.has(u.key)).map((u) => u.key);
  const readMissing = readUnits.filter((k) => !ours.has(k));
  const pf = new Set(frames(pinLimits));
  const sf = new Set(frames(shipped));
  const banner = { removed: [...pf].filter((l) => !sf.has(l)), added: [...sf].filter((l) => !pf.has(l)) };
  const step2 = {
    units: S.length, pinUnits: P.length, identical: S.length - unequal.length - notInPin.length - addedLater.length, differing, moved, movedStale, notInPin, inOrder,
    read: readUnits.length, readAmong: readUnits.length - readMissing.length, readMissing,
    readMissingNone: readMissing.length === 0,
    residue, banner, addedLater, heldLater,
  };
  const ok = step1.limits && !differing.length && !movedStale.length && !notInPin.length && inOrder && step2.readMissingNone
    && residue.length === P.length - (S.length - addedLater.length);
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
  console.log(`step 1: omx_contract_limits.h ${r.step1.limits ? 'BYTE-IDENTICAL' : 'DIFFERS'}`);
  console.log(`step 2: ${s.identical}/${s.units} units byte-identical to omx-dsp's (of ${s.pinUnits}), order ${s.inOrder ? 'kept' : 'BROKEN'}, ` +
    `${s.readAmong}/${s.read} read units among them (missing: ${s.readMissing.join(', ') || 'none'}), ` +
    `residue ${s.residue.length}, ${s.addedLater.length} units of later items`);
  if (s.moved.length) console.log(`  moved after the pin, declared as in use today: ${s.moved.join(', ')}`);
  if (s.differing.length || s.notInPin.length || s.movedStale.length) console.log(`  differing: ${s.differing.join(', ')}; not in omx-dsp's header: ${s.notInPin.join(', ')}; named as moved but not: ${s.movedStale.join(', ')}`);
  console.log(`ROUND-TRIP-JSON ${JSON.stringify({ ok: r.ok, step1: r.step1, units: s.units, identical: s.identical, pinUnits: s.pinUnits, read: s.read, readAmong: s.readAmong, residue: s.residue.length, bannerLines: s.banner.removed.length + s.banner.added.length })}`);
  process.exitCode = r.ok ? 0 : 1;
}
