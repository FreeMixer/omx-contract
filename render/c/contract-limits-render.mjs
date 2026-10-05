// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
// Moved unchanged from openmixer harness/contract-limits-render.mjs at 6c6e709f4429 (omx-contract spec
// §3.4): a frozen export of openmixer's whole sheet renders through it byte for byte (test/round-trip.test.mjs).
/**
 * The RENDER half of `contract-limits-gen.mjs`: the header text as a pure function of the
 * declaration sheet it is handed. Split out so the declaration-perturbation ratchet (R-094,
 * `packages/server/src/declaration-perturbation-conformance.test.ts`) can render the header over
 * a PERTURBED sheet and see whether every define follows it — the generator itself imports the
 * built modules and calls this, so there is one renderer and no second copy.
 */
/** The `coreLimits`-sourced facts with a native (C) meaning — the four F7 names: pan, delay,
 * reverb, drive. Other `coreLimits` facts (eq, fbs, hrp, gateKey, align) have no stage header
 * counterpart to resolve here and are out of this generator's scope. */
const CORE_STAGE_FACTS = ['pan', 'delay', 'reverb', 'drive'];

/** law kebab-case token -> C enum member (`no-gain-added` -> `OMX_LAW_NO_GAIN_ADDED`). */
function lawEnumName(law) {
  return `OMX_LAW_${law.toUpperCase().replace(/-/g, '_')}`;
}

/** fact name -> C array name (`dynamics` -> `OMX_STAGE_LAWS_DYNAMICS`). */
function stageArrayName(fact) {
  return `OMX_STAGE_LAWS_${fact.toUpperCase()}`;
}

/** a limit-table field name -> a C constant prefix (`thresholdDb` -> `THRESHOLD_DB`). */
function fieldConstName(field) {
  return field.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toUpperCase();
}

function numLiteral(n) {
  // A whole number still gets a decimal point — this header feeds float comparisons in C, and
  // an integer literal compared against a float is a silent promotion, never a typo to chase.
  return Number.isInteger(n) ? `${n}.0` : `${n}`;
}

function genLimitBlock(prefix, table) {
  const lines = [];
  for (const [field, limit] of Object.entries(table)) {
    const c = fieldConstName(field);
    lines.push(`#define OMX_${prefix}_${c}_MIN ${numLiteral(limit.min)}f`);
    lines.push(`#define OMX_${prefix}_${c}_MAX ${numLiteral(limit.max)}f`);
    lines.push(`#define OMX_${prefix}_${c}_DEFAULT ${numLiteral(limit.default)}f`);
  }
  return lines.join('\n');
}

/**
 * Same shape as {@link genLimitBlock}, for a `coreLimits` fact's entry in `CORE_LIMITS` — DEFAULT
 * is emitted only where the travel declares one (`PAN_RANGE`/`DIVERGENCE_RANGE` and the reverb
 * cut corners carry no come-up value; a control's default is a presentation fact, not every
 * `coreLimits` travel's business).
 */
function genCoreLimitBlock(CORE_LIMITS, fact) {
  const table = CORE_LIMITS.get(fact);
  if (!table) throw new Error(`contract-limits-gen: CORE_LIMITS has no entry for '${fact}'`);
  const prefix = fact.toUpperCase();
  const lines = [];
  for (const [field, limit] of Object.entries(table)) {
    const c = fieldConstName(field);
    lines.push(`#define OMX_${prefix}_${c}_MIN ${numLiteral(limit.min)}f`);
    lines.push(`#define OMX_${prefix}_${c}_MAX ${numLiteral(limit.max)}f`);
    if (limit.default !== undefined) {
      lines.push(`#define OMX_${prefix}_${c}_DEFAULT ${numLiteral(limit.default)}f`);
    }
  }
  return lines.join('\n');
}

/**
 * The CLAP host object's extension ids (plugin-qualify's OMX_CLAP_HOST_EXTENSIONS; clap-hosting-path §5):
 * what the live host provides, pinned so C can never provide less than the verdict promised. A
 * NULL-terminated array of string literals, one per id, in the declared order.
 */
function genClapHostExtensionsBlock(OMX_CLAP_HOST_EXTENSIONS) {
  if (!Array.isArray(OMX_CLAP_HOST_EXTENSIONS) || OMX_CLAP_HOST_EXTENSIONS.length === 0) {
    throw new Error('contract-limits-gen: OMX_CLAP_HOST_EXTENSIONS is missing from the sheet');
  }
  for (const id of OMX_CLAP_HOST_EXTENSIONS) {
    if (typeof id !== 'string' || !/^[a-z][a-z0-9.\/-]*$/.test(id)) throw new Error(`contract-limits-gen: OMX_CLAP_HOST_EXTENSIONS carries a non-id: ${JSON.stringify(id)}`);
  }
  return [
    `#define OMX_CLAP_HOST_EXTENSION_COUNT ${OMX_CLAP_HOST_EXTENSIONS.length}u`,
    `#define OMX_CLAP_HOST_EXTENSIONS_INIT { ${OMX_CLAP_HOST_EXTENSIONS.map((id) => JSON.stringify(id)).join(', ')}, NULL }`,
  ].join('\n');
}

/**
 * The declared sample rates (core's `STANDARD_SAMPLE_RATES`, row-codecs.ts) as a C array the
 * contracts' `rate-is-declared` PRE reads through `omx_rate_is_declared` — never a literal list.
 */
function genDeclaredRates(STANDARD_SAMPLE_RATES) {
  if (!Array.isArray(STANDARD_SAMPLE_RATES) || STANDARD_SAMPLE_RATES.length === 0) {
    throw new Error('contract-limits-gen: STANDARD_SAMPLE_RATES is missing from the sheet');
  }
  for (const r of STANDARD_SAMPLE_RATES) {
    if (!Number.isInteger(r) || r <= 0) throw new Error(`contract-limits-gen: a declared rate must be a positive integer, got ${r}`);
  }
  return [
    `#define OMX_DECLARED_RATE_COUNT ${STANDARD_SAMPLE_RATES.length}u`,
    `static const float OMX_DECLARED_RATES[OMX_DECLARED_RATE_COUNT] = { ${STANDARD_SAMPLE_RATES.map((r) => `${numLiteral(r)}f`).join(', ')} };`,
  ].join('\n');
}

/**
 * The scalar door's literal law (dsp-primitives §7): an integer value is an integer literal, so it
 * can size a ring or count; any other number is a float literal. A C reader dividing two
 * integer-valued declarations promotes one itself — this generator knows no units.
 */
export function scalarLiteral(n) {
  if (typeof n !== 'number' || !Number.isFinite(n)) throw new Error(`contract-limits-gen: a declared scalar must be a finite number, got ${n}`);
  return Number.isInteger(n) ? `${n}` : `${n}f`;
}

/** The same non-integer as C's own double literal — `OMX_<macro>_DOUBLE`, for a consumer that designs in double. */
export function scalarDoubleLiteral(n) {
  if (typeof n !== 'number' || !Number.isFinite(n) || Number.isInteger(n)) throw new Error(`contract-limits-gen: a double spelling is for a non-integer, got ${n}`);
  return `${n}`;
}

/**
 * ONE block for every declared scalar and sheet leaf (core's declaredScalars over the core barrel
 * and the declarations): `#define OMX_<macro> <literal>`, sorted by macro. This generator names
 * none of them — a kernel's scalars are its exports. A macro another block already defined is a
 * collision, refused.
 */
function genDeclaredScalarsBlock(DECLARED_SCALARS, definedBefore) {
  if (!Array.isArray(DECLARED_SCALARS) || DECLARED_SCALARS.length === 0) {
    throw new Error('contract-limits-gen: the declared-scalar discovery is empty — nothing declared');
  }
  return DECLARED_SCALARS.flatMap(({ macro, value }) => {
    for (const name of [`OMX_${macro}`, `OMX_${macro}_DOUBLE`]) {
      if (definedBefore.has(name)) throw new Error(`contract-limits-gen: ${name} is a declared scalar AND another block's define — rename one`);
    }
    return Number.isInteger(value)
      ? [`#define OMX_${macro} ${scalarLiteral(value)}`]
      : [`#define OMX_${macro} ${scalarLiteral(value)}`, `#define OMX_${macro}_DOUBLE ${scalarDoubleLiteral(value)}`];
  }).join('\n');
}

/**
 * A string as a C string literal (dsp-primitives §7, record sets): `\\`, `\"` and `\?` (no trigraph
 * can form) escaped, `\n`/`\t`/`\r` by name, every other byte outside printable ASCII as a
 * three-digit octal escape of its UTF-8 encoding.
 */
export function cStringLiteral(s) {
  if (typeof s !== 'string') throw new Error(`contract-limits-gen: a C string literal needs a string, got ${typeof s}`);
  const named = { 0x5c: '\\\\', 0x22: '\\"', 0x3f: '\\?', 0x0a: '\\n', 0x09: '\\t', 0x0d: '\\r' };
  let out = '"';
  for (const b of new TextEncoder().encode(s)) {
    if (named[b] !== undefined) out += named[b];
    else if (b >= 0x20 && b <= 0x7e) out += String.fromCharCode(b);
    else out += `\\${b.toString(8).padStart(3, '0')}`;
  }
  return `${out}"`;
}

/** One record-set field as its C initialiser value: a string literal, a 0/1 boolean or the scalar literal. */
function setFieldLiteral(v) {
  if (typeof v === 'string') return cStringLiteral(v);
  if (typeof v === 'boolean') return v ? '1' : '0';
  return scalarLiteral(v);
}

/**
 * ONE block for every declared record set (core's declaredSets over the core barrel and the
 * declarations): `OMX_<SET>_COUNT` and `OMX_<SET>_INIT`, one `{ … }` row per declared row, rows and
 * fields in declaration order. A set with a field this door cannot render is refused whole, and a
 * macro another block defines is a collision, refused.
 */
function genDeclaredSetsBlock(DECLARED_SETS, definedElsewhere) {
  if (!Array.isArray(DECLARED_SETS) || DECLARED_SETS.length === 0) {
    throw new Error('contract-limits-gen: the declared-set discovery is empty — nothing declared');
  }
  return DECLARED_SETS.map(({ name, fields, rows }) => {
    for (const macro of [`OMX_${name}_COUNT`, `OMX_${name}_INIT`]) {
      if (definedElsewhere.has(macro)) throw new Error(`contract-limits-gen: ${macro} is a declared set AND another block's define — rename one`);
    }
    let body;
    try {
      body = rows.map((row) => {
        if (!Array.isArray(row) || row.length !== fields.length) throw new Error(`a row carries ${row?.length} values for ${fields.length} fields`);
        return `{ ${row.map(setFieldLiteral).join(', ')} }`;
      });
    } catch (e) {
      throw new Error(`contract-limits-gen: OMX_${name}_INIT refused — ${e.message}`);
    }
    return [`#define OMX_${name}_COUNT ${rows.length}u`, `#define OMX_${name}_INIT { ${body.join(', ')} }`].join('\n');
  }).join('\n');
}

/**
 * ONE block for every declared number list (core's declaredLists; dsp-primitives §7):
 * `OMX_<LIST>_COUNT` and `OMX_<LIST>_INIT { a, b, … }`, values in declaration order, each the
 * scalar literal. A list with a non-finite element is refused whole; a macro another block defines
 * is a collision, refused.
 */
function genDeclaredListsBlock(DECLARED_LISTS, definedElsewhere) {
  if (!Array.isArray(DECLARED_LISTS) || DECLARED_LISTS.length === 0) {
    throw new Error('contract-limits-gen: the declared-list discovery is empty — nothing declared');
  }
  return DECLARED_LISTS.map(({ name, values }) => {
    for (const macro of [`OMX_${name}_COUNT`, `OMX_${name}_INIT`]) {
      if (definedElsewhere.has(macro)) throw new Error(`contract-limits-gen: ${macro} is a declared list AND another block's define — rename one`);
    }
    if (!values.every((v) => typeof v === 'number' && Number.isFinite(v))) {
      throw new Error(`contract-limits-gen: OMX_${name}_INIT refused — an element is not a finite number`);
    }
    return [`#define OMX_${name}_COUNT ${values.length}u`, `#define OMX_${name}_INIT { ${values.map(scalarLiteral).join(', ')} }`].join('\n');
  }).join('\n');
}

/**
 * The ONE sheet `renderContractLimits` is handed: the core barrel namespace, every door DISCOVERED
 * over it and the declarations barrel by the barrel's own discovery functions (`nativeLimitTables`
 * over `<PREFIX>_LIMITS`, `declaredScalars`, `declaredSets`, `declaredLists`), then `extra` — the
 * names that are not in the core barrel (`OMX_CLAP_HOST_EXTENSIONS`) or a test's override of one
 * door. The generator and every render test build the sheet here, so a new door is added once,
 * never appended to a hand list per caller (2026-09-15-no-stored-derivations.md §9).
 */
export function contractLimitsSheet(coreNs, declarations, extra = {}) {
  return {
    ...coreNs,
    NATIVE_LIMIT_TABLES: coreNs.nativeLimitTables(coreNs, declarations),
    DECLARED_SCALARS: coreNs.declaredScalars(coreNs, declarations),
    DECLARED_SETS: coreNs.declaredSets(coreNs, declarations),
    DECLARED_LISTS: coreNs.declaredLists(coreNs, declarations),
    ...extra,
  };
}

export function renderContractLimits({
  CHANNEL_CONTRACT, LAW_KINDS, NATIVE_LIMIT_TABLES, DECLARED_SCALARS, CORE_LIMITS, OMX_CLAP_HOST_EXTENSIONS, STANDARD_SAMPLE_RATES,
  DECLARED_SETS, DECLARED_LISTS,
}) {
  if (!Array.isArray(NATIVE_LIMIT_TABLES) || NATIVE_LIMIT_TABLES.length === 0) {
    throw new Error('contract-limits-gen: the native limit table registry is empty — nothing registered');
  }

  const facts = Object.keys(CHANNEL_CONTRACT).filter(
    (f) => (CHANNEL_CONTRACT[f].laws ?? []).length > 0,
  );

  const enumLines = LAW_KINDS.map((law, i) => `  ${lawEnumName(law)}${i === 0 ? ' = 0' : ''},`);

  const stageBlocks = facts.map((fact) => {
    const laws = CHANNEL_CONTRACT[fact].laws;
    const names = laws.map((l) => lawEnumName(l.law));
    const arr = stageArrayName(fact);
    return (
      `static const omx_contract_law_t ${arr}[] = { ${names.join(', ')} };\n` +
      `#define ${arr}_COUNT ${names.length}`
    );
  });

  const above = [
    ...NATIVE_LIMIT_TABLES.map(([prefix, table]) => genLimitBlock(prefix, table)),
    ...CORE_STAGE_FACTS.map((f) => genCoreLimitBlock(CORE_LIMITS, f)),
  ].join('\n');
  const definedAbove = new Set([...above.matchAll(/^#define (OMX_\w+) /gm)].map((m) => m[1]));
  const scalarsBlock = genDeclaredScalarsBlock(DECLARED_SCALARS, definedAbove);
  const clapBlock = genClapHostExtensionsBlock(OMX_CLAP_HOST_EXTENSIONS);
  const ratesBlock = genDeclaredRates(STANDARD_SAMPLE_RATES);
  const definedElsewhere = new Set([...[above, scalarsBlock, clapBlock, ratesBlock].join('\n').matchAll(/^#define (OMX_\w+)/gm)].map((m) => m[1]));
  const setsBlock = genDeclaredSetsBlock(DECLARED_SETS, definedElsewhere);
  const listsBlock = genDeclaredListsBlock(DECLARED_LISTS, new Set([...definedElsewhere, ...[...setsBlock.matchAll(/^#define (OMX_\w+)/gm)].map((m) => m[1])]));

  return `// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
#ifndef OMX_CONTRACT_LIMITS_H
#define OMX_CONTRACT_LIMITS_H
/*
 * GENERATED — DO NOT EDIT BY HAND.
 * Produced by harness/contract-limits-gen.mjs from packages/core/src/channel-contract.ts's
 * \`laws\` column (R-056), every table packages/core/src/native-limit-tables.ts's registry
 * holds, packages/core/src/control-bounds.ts's CORE_LIMITS for the pan/delay/reverb/drive
 * facts, EVERY declared scalar and all-number sheet packages/core/src/declared-scalars.ts
 * discovers over the core barrel and @freemixer/declarations (dsp-primitives §7), and
 * packages/core/src/row-codecs.ts's STANDARD_SAMPLE_RATES. Regenerate:
 * \`node harness/contract-limits-gen.mjs\`, then commit the result — see this file's own
 * generator for why it is committed rather than gitignored.
 *
 * A C contract (OMX_PRE/OMX_POST/OMX_INVARIANT) reads a limit from HERE, never a literal:
 * packages/server/src/contract-limits-generated-conformance.test.ts refuses both a stale
 * header and a C literal that duplicates a number this file already declares.
 */

/* The closed law vocabulary (core's LAW_KINDS, fact-declaration.ts) — one member per law. */
typedef enum {
${enumLines.join('\n')}
} omx_contract_law_t;

/* Per-stage law lists, one per channel fact whose row declares \`laws\` — the SAME array
 * harness/contracts-scaffold.mjs's applier and the MCP contract_laws tool read; a stage's
 * OMX_POST tokens implement one or more of these, never a second spelling of the law. */
${stageBlocks.join('\n\n')}

/* Per-parameter numeric travel, one block per table registered in
 * packages/core/src/native-limit-tables.ts (GATE/COMP today; a kernel that registers a table
 * lands here because it is REGISTERED, not because this generator names it). */
${NATIVE_LIMIT_TABLES.map(([prefix, table]) => genLimitBlock(prefix, table)).join('\n\n')}

/* The four coreLimits-sourced facts with a native meaning — pan, delay, reverb, drive
 * (CORE_LIMITS, control-bounds.ts; F7). Not every field here has a C-side literal to replace:
 * the reverb cut corners and the drive stage's five numerics are clamped only on the TS side
 * today (mix_reverb.h's own header comment: "there is no 20 kHz anywhere in the C"), so those
 * defines exist for completeness and for the day a native clamp is added, without yet being
 * read by a stage. */
${CORE_STAGE_FACTS.map((f) => genCoreLimitBlock(CORE_LIMITS, f)).join('\n\n')}

/* EVERY declared scalar and sheet leaf (packages/core/src/declared-scalars.ts over the core barrel
 * and @freemixer/declarations; dsp-primitives §7 the scalar door) — one block, sorted by macro,
 * named by nobody: a kernel's constants are its exports (ROTARY_*, TRANSIENT_*, PITCH_KERNEL,
 * PROGRAM_RELEASE, HOSTED_STAGE_LIMITS, ALLPASS/XOVER_LIMITS, the fdelay kernel's norm and order, …).
 * An integer value is an integer literal, any other a float literal AND its OMX_<macro>_DOUBLE spelling. */
${scalarsBlock}

/* The CLAP host object's extension ids (packages/plugin-qualify/src/hosting-suitability.ts,
 * OMX_CLAP_HOST_EXTENSIONS; 2026-09-26-clap-hosting-path.md §5) — read by mix_clap_host.c. */
${clapBlock}

/* EVERY declared record set (packages/core/src/declared-sets.ts over the core barrel and
 * @freemixer/declarations; dsp-primitives §7) — one block, sorted by set, named by nobody: HOST_VERBS
 * (2026-09-29-host-backend-one-contract.md §4, read by mix_host_backend.test.c against the fork's
 * scenario list), … OMX_<SET>_INIT is one { … } row per declared row, fields in declaration order: a
 * string as a C string literal, a boolean as 0/1, a number as the scalar literal. */
${setsBlock}

/* EVERY declared number list (packages/core/src/declared-lists.ts; dsp-primitives §7) — sorted by
 * list, named by nobody: LATENCY_QUANTA (the quantum grid a bench iterates), STANDARD_SAMPLE_RATES,
 * … A C grid is int qs[OMX_<LIST>_COUNT] = OMX_<LIST>_INIT; a script reads the _INIT line through
 * harness/lib/declared-list.sh. */
${listsBlock}

/* The running check (dsp-primitives §7): every declared scalar by name with the macro ITSELF, so an
 * entry carries what the including binary COMPILED. ONE translation unit defines
 * OMX_DECLARED_SCALARS_TABLE before including this header (declared_scalars.c) and exports it. */
#ifdef OMX_DECLARED_SCALARS_TABLE
struct omx_declared_scalar { const char *name; double value; };
static const struct omx_declared_scalar OMX_DECLARED_SCALARS[] = {
${DECLARED_SCALARS.map(({ macro }) => `  { "${macro}", (double)OMX_${macro} },`).join('\n')}
};
#define OMX_DECLARED_SCALAR_COUNT ${DECLARED_SCALARS.length}u
#endif

#endif /* OMX_CONTRACT_LIMITS_H */

/* The sample rates the console declares (core's STANDARD_SAMPLE_RATES, row-codecs.ts): the set a
 * contract's rate-is-declared precondition accepts, through omx_rate_is_declared(), and the grid a
 * native tool iterates. Guarded on its own so a tool built against a pinned copy of this header
 * (lv2-inprocess-pin.sh) can include this tree's copy after it and gain the rates without mixing
 * the pin's limits. */
#ifndef OMX_DECLARED_RATE_COUNT
${ratesBlock}
/* The declared rates that are whole multiples of \`base\` (a tool's default grid: the 48 kHz family),
 * in declaration order, at most \`cap\` of them; returns how many were written to \`out\`. */
static inline int omx_declared_rates_multiple_of(unsigned base, int *out, int cap) {
  int n = 0;
  for (unsigned k = 0; k < OMX_DECLARED_RATE_COUNT && n < cap; k++)
    if ((unsigned)OMX_DECLARED_RATES[k] % base == 0) out[n++] = (int)OMX_DECLARED_RATES[k];
  return n;
}
#endif
`;
}


// omx-contract: the block renderers above, exported for the data path's header (render/c.mjs). Nothing above changed.
export { genLimitBlock, genCoreLimitBlock, genDeclaredScalarsBlock, genDeclaredListsBlock, genDeclaredRates };
