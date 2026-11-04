// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
/**
 * The published contract-limits renderer and split: a consumer imports them from this package by name, renders its
 * whole sheet once and cuts it by the owners' installed headers.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { renderContractLimits } from '@openmixer/omx-contract/contract-limits-render';
import { limitUnits, pinVerdicts, splitContractLimits } from '@openmixer/omx-contract/contract-limits-split';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const frozen = () => {
  const s = JSON.parse(readFileSync(join(ROOT, 'test/fixtures/frozen-limits-sheet.json'), 'utf8')).sheet;
  return { ...s, CORE_LIMITS: new Map(Object.entries(s.CORE_LIMITS)) };
};

test('the published renderer is the one the round-trip proves, and renders the stage facts a consumer names', () => {
  const pin = readFileSync(join(ROOT, 'test/fixtures/limits-0.1.3/omx_contract_limits.h'), 'utf8');
  assert.equal(renderContractLimits(frozen()), pin, 'positive control: the default facts render the frozen header');
  const pan = renderContractLimits({ ...frozen(), coreStageFacts: ['pan'] });
  const block = (text) => text.split('\n/* ').find((part) => part.includes('coreLimits-sourced fact'));
  assert.match(block(pan), /^#define OMX_PAN_PAN_MIN /m);
  assert.doesNotMatch(block(pan), /^#define OMX_(DELAY|REVERB|DRIVE)_/m, 'a fact the consumer does not name has no block');
  assert.match(block(pin), /^#define OMX_DRIVE_/m, 'positive control: the default facts carry the drive block');
});

const OWNER = `#ifndef OWNER_H
#define OWNER_H
#define OMX_A_MAX 1.0f
#define OMX_B_MAX 2.0f
#endif
`;
const FULL = `#ifndef FULL_H
#define FULL_H
#define OMX_A_MAX 1.0f
#define OMX_B_MAX 3.0f
#define OMX_C_MAX 4.0f
#ifdef OMX_DECLARED_SCALARS_TABLE
  { "A_MAX", (double)OMX_A_MAX },
  { "C_MAX", (double)OMX_C_MAX },
#endif
#endif
`;

test('the split gives an owner its own units and the consumer every other one', () => {
  const pinned = [{ owner: 'omx-contract', header: 'omxcontract/omx_contract_limits.h', text: OWNER }];
  const split = splitContractLimits({ full: FULL, pinned, generator: 'make limits' });
  assert.deepEqual([...split.contractNames].sort(), ['OMX_A_MAX', 'OMX_B_MAX']);
  assert.deepEqual([...split.consoleNames].sort(), ['OMX_C_MAX', 'OMX_DECLARED_SCALARS_TABLE'].filter((n) => split.consoleNames.has(n)).sort());
  assert.match(split.console, /^#include <omxcontract\/omx_contract_limits\.h>$/m);
  assert.match(split.console, /^#define OMX_C_MAX 4\.0f$/m);
  assert.doesNotMatch(split.console, /^#define OMX_A_MAX/m, 'an owner\'s unit stays out of the consumer header');
  assert.match(split.console, /Regenerate: make limits,/);
  assert.match(split.console, /^#define OMX_COMPILED_SCALAR_COUNT 2u$/m);
  const [verdict] = pinVerdicts(split, pinned);
  assert.match(verdict, /differs from the installed omx-contract \(OMX_B_MAX\)/, 'a unit that differs from its owner is named');
  assert.deepEqual(pinVerdicts(splitContractLimits({ full: FULL.replace('OMX_B_MAX 3.0f', 'OMX_B_MAX 2.0f'), pinned }), pinned), [],
    'positive control: agreeing units give no verdict');
});

test('a unit split between an owner and the consumer is refused, and a unit defined twice too', () => {
  const pinned = [{ owner: 'omx-contract', header: 'h', text: 'typedef enum {\n  OMX_LAW_A = 0,\n} omx_contract_law_t;\n' }];
  const full = `typedef enum {\n  OMX_LAW_A = 0,\n  OMX_LAW_B,\n} omx_contract_law_t;\n${FULL}`;
  assert.throws(() => splitContractLimits({ full, pinned }), /OMX_LAW_B, which it does not/);
  assert.throws(() => limitUnits('#define OMX_X 1\n#define OMX_X 2\n'), /OMX_X is defined twice/);
});
