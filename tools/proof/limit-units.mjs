// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
// limitUnits and its helpers, moved unchanged from openmixer harness/contract-limits-split.mjs at
// 6c6e709f4429: the unit a header is compared by in the round-trip proof (omx-contract spec §4.4 step 2).

const BLOCKS = [
  // [opening line, closing line, key]
  [/^typedef enum \{$/, /^\} omx_contract_law_t;$/, 'omx_contract_law_t'],
  [/^#ifdef OMX_DECLARED_SCALARS_TABLE$/, /^#endif$/, 'OMX_DECLARED_SCALARS'],
  [/^#ifndef OMX_DECLARED_RATE_COUNT$/, /^#endif$/, 'OMX_DECLARED_RATE_COUNT'],
];

/** Every identifier a block of C defines: macros with a value, enum members, arrays, structs, functions. */
function definedIn(lines) {
  const names = new Set();
  for (const l of lines) {
    let m;
    if ((m = /^#define (\w+)\s+\S/.exec(l))) names.add(m[1]);
    if ((m = /^\s+(OMX_\w+)(?:\s*=\s*\d+)?,$/.exec(l))) names.add(m[1]);
    if ((m = /^\} (\w+);$/.exec(l))) names.add(m[1]);
    if ((m = /^static const (?:struct )?\w+ (\w+)\[/.exec(l))) names.add(m[1]);
    if ((m = /^struct (\w+) \{/.exec(l))) names.add(m[1]);
    if ((m = /^static inline \w+ (\w+)\(/.exec(l))) names.add(m[1]);
  }
  return [...names];
}

/**
 * The header as an ordered list of items: `{ frame: line }` for a line that defines nothing (a
 * comment, the include guard, a blank) and `{ key, names, lines, macro }` for a unit.
 */
export function limitUnits(text) {
  const lines = text.split('\n');
  const items = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const block = BLOCKS.find(([open]) => open.test(line));
    if (block) {
      let j = i;
      while (j < lines.length && !(j > i && block[1].test(lines[j]))) j++;
      if (j === lines.length) throw new Error(`contract-limits-split: the block opened at line ${i + 1} (${line}) never closes`);
      const body = lines.slice(i, j + 1);
      items.push({ key: block[2], names: definedIn(body), lines: body, macro: false });
      i = j;
      continue;
    }
    let m;
    if ((m = /^#define (OMX_\w+)\s+\S/.exec(line))) {
      items.push({ key: m[1], names: [m[1]], lines: [line], macro: true });
    } else if ((m = /^static const omx_contract_law_t (OMX_STAGE_LAWS_\w+)\[\]/.exec(line))) {
      items.push({ key: m[1], names: [m[1]], lines: [line], macro: false });
    } else {
      items.push({ frame: line });
    }
  }
  const seen = new Set();
  for (const u of items) {
    if (u.frame !== undefined) continue;
    if (seen.has(u.key)) throw new Error(`contract-limits-split: ${u.key} is defined twice`);
    seen.add(u.key);
  }
  return items;
}
