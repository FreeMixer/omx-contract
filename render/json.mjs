// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
/**
 * The `json` target: the resolved data (every reference and derivation evaluated) for readers in
 * other languages, which need no resolver of their own. Beside the items, `kernels` lists each
 * kernel's controls in their declared order (name, kind, the global each resolves to, the table of a
 * table field), so a reader needs no kernel file.
 */

/** Every file of the `json` target: `[{ path, text }]`. */
export function renderJson(resolved, version) {
  const items = {};
  for (const r of resolved.values()) {
    const { name, ...rest } = r;
    items[name] = rest;
  }
  const doc = { name: '@openmixer/omx-contract', version, items };
  if (resolved.kernels) doc.kernels = resolved.kernels;
  return [{ path: 'omx-contract.json', text: `${JSON.stringify(doc, null, 2)}\n` }];
}
