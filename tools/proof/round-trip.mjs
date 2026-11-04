#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
/**
 * The round-trip proof of the renderer: the frozen sheet (test/fixtures/frozen-limits-sheet.json) renders omx-dsp
 * v0.1.3's limits header (test/fixtures/limits-0.1.3/omx_contract_limits.h) byte for byte.
 *
 * The second half, the definitions' render against that header unit for unit and every unit v0.1.3 read, proves the
 * definitions rather than the renderer, so it runs where they live: omx-dsp's `make contract-proof`, over its own data
 * and answers.
 *
 * Usage: node tools/proof/round-trip.mjs [--quiet]; exit 1 when it fails.
 */
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderSheetC } from '../../render/c.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const FIX = join(ROOT, 'test/fixtures');

/** The proof against `pinLimits` (default: the fixture). Returns the report; `ok` is the verdict. */
export function roundTrip(pinLimits = readFileSync(join(FIX, 'limits-0.1.3/omx_contract_limits.h'), 'utf8')) {
  const sheet = renderSheetC(JSON.parse(readFileSync(join(FIX, 'frozen-limits-sheet.json'), 'utf8')));
  const step1 = { limits: sheet.find((f) => f.path.endsWith('omx_contract_limits.h')).text === pinLimits };
  return { ok: step1.limits, step1 };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const r = roundTrip();
  console.log(`step 1: omx_contract_limits.h ${r.step1.limits ? 'BYTE-IDENTICAL' : 'DIFFERS'}`);
  console.log(`ROUND-TRIP-JSON ${JSON.stringify({ ok: r.ok, step1: r.step1 })}`);
  process.exitCode = r.ok ? 0 : 1;
}
