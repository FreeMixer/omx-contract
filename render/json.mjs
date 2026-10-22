// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
/**
 * The `json` target: the resolved data (every reference and derivation evaluated) for readers in
 * other languages, which need no resolver of their own. Every item carries `package` (docs/kernel-files.md), the
 * package that declares it: the one `resolved.packageOf` names, or `omx-contract` where that is undefined (a plain
 * data directory, or an item of omx-contract's own tree in a merged read). Beside the items, `kernels` lists each
 * kernel's controls in their declared order (name, kind, the global each resolves to, the table of a
 * table field, `rearms` when changing it re-arms the kernel's state) and, where it declares any, its readouts, so a
 * reader needs no kernel file.
 */

import { SCHEMA_PACKAGE } from '../lib/contract-dir.mjs';
import { renderVocabularySchema } from './vocabulary.mjs';

/** Every file of the `json` target: `[{ path, text }]`: the resolved data and the vocabulary's schema fragment. */
export function renderJson(resolved, version) {
  const items = {};
  for (const r of resolved.values()) {
    const { name, rel, ...rest } = r;
    items[name] = { rel, package: resolved.packageOf.get(name) ?? SCHEMA_PACKAGE, ...rest };
  }
  const doc = { name: '@openmixer/omx-contract', version, items };
  if (resolved.kernels) doc.kernels = resolved.kernels;
  const files = [{ path: 'omx-contract.json', text: `${JSON.stringify(doc, null, 2)}\n` }];
  const vocabulary = renderVocabularySchema(resolved, version);
  if (vocabulary) files.push({ path: 'omx-vocabulary.schema.json', text: vocabulary });
  return files;
}
