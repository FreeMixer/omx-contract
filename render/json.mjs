// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
/**
 * The `json` target: the resolved data (every reference and derivation evaluated) for readers in
 * other languages, which need no resolver of their own. Beside the items, `kernels` lists each
 * kernel's controls in their declared order (name, kind, the global each resolves to, the table of a
 * table field, `rearms` when changing it re-arms the kernel's state) and, where it declares any, its readouts, so a
 * reader needs no kernel file. `formerNames`, present while a renamed list keeps its former name, maps each former
 * name to `{ name, removedIn }`: the item to read instead, and the release that drops the entry. It names the item and
 * never repeats its values.
 */

import { renderVocabularySchema } from './vocabulary.mjs';

/** Every file of the `json` target: `[{ path, text }]`: the resolved data and the vocabulary's schema fragment. */
export function renderJson(resolved, version) {
  const items = {};
  for (const r of resolved.values()) {
    const { name, ...rest } = r;
    items[name] = rest;
  }
  const doc = { name: '@openmixer/omx-contract', version, items };
  if (resolved.kernels) doc.kernels = resolved.kernels;
  const former = [...resolved.values()].filter((r) => r.kind === 'list' && r.formerly);
  if (former.length) doc.formerNames = Object.fromEntries(former.map((r) => [r.formerly.name, { name: r.name, removedIn: r.formerly.removedIn }]));
  const files = [{ path: 'omx-contract.json', text: `${JSON.stringify(doc, null, 2)}\n` }];
  const vocabulary = renderVocabularySchema(resolved, version);
  if (vocabulary) files.push({ path: 'omx-vocabulary.schema.json', text: vocabulary });
  return files;
}
