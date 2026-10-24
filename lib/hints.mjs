// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
/**
 * The resource hints (docs/resource-hints.md): the words item that declares an `extension`, and the one place the
 * carriers' types per unit are spelled. The CLAP header and the LV2 Turtle are both rendered from the item; this file
 * is what they and the validator share.
 */

/** The C type and the XSD datatype of a hint's figure, by the word of RESOURCE_UNITS it is given in. */
export const HINT_UNITS = {
  bytes: { c: 'uint64_t', xsd: 'unsignedLong' },
  count: { c: 'uint32_t', xsd: 'unsignedInt' },
  ms: { c: 'uint32_t', xsd: 'unsignedInt' },
  flag: { c: 'bool', xsd: 'boolean' },
};

/** The carrier types of a hint's unit; a unit the carriers have no type for is refused by name, never as a missing property. */
export function unitOf(key, w) {
  const u = HINT_UNITS[w.figureUnit];
  if (u === undefined) throw new Error(`${key}: ${w.figureUnit} is a unit the carriers have no type for (${Object.keys(HINT_UNITS).join(', ')})`);
  return u;
}

/** The `declared` mask of the CLAP structure is a uint32_t: one bit per hint. */
export const MAX_HINTS = 32;

/** The words items of a resolved read that declare an extension, in file order. */
export const hintItems = (resolved) => [...resolved.values()].filter((r) => r.kind === 'words' && r.extension !== undefined);

/** A hint's member name in the CLAP structure: its word in snake case. */
export const memberOf = (word) => word.replace(/-/g, '_');

/** A hint's name in upper snake case, as the bit and the define spell it. */
export const constOf = (key) => key.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toUpperCase();
