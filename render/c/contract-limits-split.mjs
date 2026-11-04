// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
/**
 * The split of a contract-limits render (contract-limits-render.mjs) by owner: the ONE render of a consumer's
 * declarations, cut by membership in the INSTALLED owners' C headers. Each owner header (omx-contract's own
 * `<omxcontract/omx_contract_limits.h>`, omx-dsp's `<omxdsp/omxdsp_definitions.h>`) is re-rendered unit by
 * unit, and every unit no owner carries goes to the consumer's own header.
 *
 * A UNIT is what one definition spells: a `#define OMX_<NAME> <value>` line, a stage's law array, or a
 * multi-line block (the law enum, the declared-rate block, the running scalar table). A unit is **foreign**
 * iff an owner's header defines one of the identifiers it defines; every other unit is the consumer's.
 * Nothing here lists a name: the class is read off the owners' headers themselves.
 *
 *   owner render      each owner's header with every unit it defines re-rendered from the consumer's
 *                     declaration: equal to the installed header while the two agree, and the check
 *                     names every unit that differs and the owner to change it in.
 *   consumer header   includes every owner's header, then every unit no owner carries and the running
 *                     list of every declared scalar (`OMX_COMPILED_SCALARS(X)`). A unit that defines
 *                     some names an owner carries and some no owner carries belongs to neither and is
 *                     refused.
 */

/** omx-contract's header inside its include directory. */
export const CONTRACT_HEADER = 'omxcontract/omx_contract_limits.h';

/** omx-dsp's definitions header inside its include directory. */
export const DSP_DEFINITIONS_HEADER = 'omxdsp/omxdsp_definitions.h';

/** The path every message names for a change to an owner's definition, by owner. */
export const OWNER_PATHS = {
  'omx-contract': 'change it in FreeMixer/omx-contract\'s data, release omx-contract, then raise the omx-contract ' +
    'floor the consumer\'s packaging declares (and the owners built against it), in that order',
  'omx-dsp': 'change it in FreeMixer/omx-dsp\'s data (its definitions, rendered as omxdsp/omxdsp_definitions.h), ' +
    'release omx-dsp, then raise the omxdsp floor the consumer\'s packaging declares, in that order',
};

/** The owners' headers the split reads, in include order: omx-contract's first (omx-dsp's includes it). */
export const OWNER_HEADERS = [
  { owner: 'omx-contract', header: CONTRACT_HEADER },
  { owner: 'omx-dsp', header: DSP_DEFINITIONS_HEADER },
];

/** The path every message names for a contract change. */
export const CONTRACT_PATH = OWNER_PATHS['omx-contract'];

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
    if ((m = /^enum (\w+) \{$/.exec(l))) names.add(m[1]);
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

/** Every identifier a header defines, wherever it stands (a macro, an enum and its members, an array, a
 * function). */
export function contractNames(text) {
  return new Set(definedIn(text.split('\n')));
}

const textOf = (u) => u.lines.join('\n');

/** `pinned` as the split reads it: one header text (omx-contract's), or `[{ owner, header, text }]` in include order. */
function owners(pinned) {
  return typeof pinned === 'string' ? [{ owner: 'omx-contract', header: CONTRACT_HEADER, text: pinned }] : pinned;
}

/**
 * Cut the full render against the owners' installed headers. Returns each owner's render (`renders`, in
 * `pinned`'s order; `contract` is omx-contract's), the consumer's header (`console`), and the generated name
 * sets of each class (`contractNames` are the foreign ones, whichever owner defines them). `generator` is the
 * command the consumer regenerates its header with, named in that header's banner.
 */
export function splitContractLimits({ full, pinned, generator = 'the consumer\'s contract-limits generator' }) {
  const heads = owners(pinned);
  const F = limitUnits(full);
  const units = (items) => items.filter((u) => u.frame === undefined);
  const carried = new Set(heads.flatMap((h) => [...contractNames(h.text)]));
  const isContract = (u) => u.names.some((n) => carried.has(n));
  for (const u of units(F)) {
    const missing = u.names.filter((n) => !carried.has(n));
    if (isContract(u) && missing.length > 0) {
      const owner = heads.find((h) => u.names.some((n) => contractNames(h.text).has(n)))?.owner ?? 'omx-contract';
      throw new Error(`contract-limits-split: ${u.key} defines ${u.names.filter((n) => carried.has(n)).join(', ')}, which the ` +
        `installed ${owner} carries, and ${missing.join(', ')}, which it does not — one unit cannot be in both headers: ${OWNER_PATHS[owner] ?? CONTRACT_PATH}`);
    }
  }

  // ---- each owner's render: its installed header, its units re-rendered from the declaration ------
  const fresh = new Map(units(F).map((u) => [u.key, u]));
  const renders = heads.map((h) => limitUnits(h.text).map((item) => (item.frame !== undefined ? item.frame : textOf(fresh.get(item.key) ?? item))).join('\n'));

  // ---- the consumer's header ------------------------------------------------------------------
  const added = units(F).filter((u) => !isContract(u) && u.key !== 'OMX_DECLARED_SCALARS').map(textOf);
  const table = fresh.get('OMX_DECLARED_SCALARS');
  if (!table) throw new Error('contract-limits-split: the render carries no running scalar table');
  const scalars = table.lines.flatMap((l) => /^ {2}\{ "(\w+)", \(double\)OMX_\1 \},$/.exec(l)?.[1] ?? []);
  const console_ = `// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
#ifndef OMX_CONSOLE_LIMITS_H
#define OMX_CONSOLE_LIMITS_H
/*
 * GENERATED — DO NOT EDIT BY HAND.
 * Split by omx-contract's contract-limits-split from the consumer's declarations: the CONSOLE limits —
 * every generated unit no installed owner's header defines (${heads.map((h) => `<${h.header}>`).join(', ')}).
 * Owned by the consumer alone: a console limit lands here with no library release and no floor bump.
 * Every source reading a generated limit includes THIS header, never an owner's.
 * Regenerate: ${generator}, then commit the result.
 */
${heads.map((h) => `#include <${h.header}>`).join('\n')}

/* Console limits no installed owner's header carries. */
${added.join('\n')}

/* The running check: EVERY declared scalar, an owner's and the console's, sorted by name.
 * OMX_COMPILED_SCALARS(X) expands X(<NAME>) once per scalar; a table built from it with the macro
 * OMX_<NAME> itself carries what the binary COMPILED. */
#define OMX_COMPILED_SCALAR_COUNT ${scalars.length}u
#define OMX_COMPILED_SCALARS(X) \\
${scalars.map((n, i) => `  X(${n})${i < scalars.length - 1 ? ' \\' : ''}`).join('\n')}

#endif /* OMX_CONSOLE_LIMITS_H */
`;

  const contractUnitNames = new Set(units(F).filter(isContract).flatMap((u) => u.names));
  const consoleNames = new Set(units(F).filter((u) => !isContract(u)).flatMap((u) => u.names));
  return { contract: renders[0], renders, console: console_, contractNames: contractUnitNames, consoleNames, added: added.length };
}

/**
 * The owner check: null when an owner's render equals its installed header, else the message naming the
 * units that differ and that owner's release path (omx-contract's by default).
 */
export function pinVerdict(contract, pinned, owner = 'omx-contract') {
  if (contract === pinned) return null;
  const a = new Map(limitUnits(contract).filter((u) => u.frame === undefined).map((u) => [u.key, textOf(u)]));
  const b = new Map(limitUnits(pinned).filter((u) => u.frame === undefined).map((u) => [u.key, textOf(u)]));
  const keys = [...new Set([...a.keys(), ...b.keys()])].filter((k) => a.get(k) !== b.get(k)).sort();
  return `contract-limits: the consumer's declaration differs from the installed ${owner} (${keys.join(', ') || 'frame text'}) — ` +
    `a limit an owner declares reaches the consumer only through that owner: ${OWNER_PATHS[owner] ?? CONTRACT_PATH}`;
}

/** Every owner's check over a split of `pinned` (`[{ owner, header, text }]`): the messages of those that differ. */
export function pinVerdicts(split, pinned) {
  return owners(pinned).map((h, i) => pinVerdict(split.renders[i], h.text, h.owner)).filter((v) => v !== null);
}
