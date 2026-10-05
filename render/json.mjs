// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
/**
 * The `json` target: the resolved data (every reference and derivation evaluated) for readers in
 * other languages, which need no resolver of their own.
 */

/** Every file of the `json` target: `[{ path, text }]`. */
export function renderJson(resolved, version) {
  const items = {};
  for (const r of resolved.values()) {
    const { name, ...rest } = r;
    items[name] = rest;
  }
  return [{ path: 'omx-contract.json', text: `${JSON.stringify({ name: '@openmixer/omx-contract', version, items }, null, 2)}\n` }];
}
