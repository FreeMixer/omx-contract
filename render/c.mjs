// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
/**
 * The `c` target: `omxcontract/omx_contract_limits.h`, and beside it the header each file's `render.c` word declares
 * (docs/render.md); with a package named, only that package's declared headers, at their own paths. Every define of
 * omx_contract_limits.h is spelled by the console engine's
 * renderer, moved unchanged (c/contract-limits-render.mjs); only the frame (banner, section
 * comments) is this repository's. A plugin's parameter header is rendered by omx-plugins from its
 * declaration, by reference to the items here.
 */
import {
  cStringLiteral, genCoreLimitBlock, genDeclaredListsBlock, genDeclaredRates, genDeclaredScalarsBlock, genLimitBlock, renderContractLimits,
  scalarLiteral,
} from './c/contract-limits-render.mjs';
import { ownerNames, renderOwnerHeader } from './c/owner-headers.mjs';
import { doors, isNativeTable } from './doors.mjs';
import { packageItems } from '../lib/data.mjs';
import { renderVocabularyHeader } from './vocabulary.mjs';

const defined = (text) => new Set([...text.matchAll(/^#define (OMX_\w+)/gm)].map((m) => m[1]));

/** The rate tail of the header, outside the include guard. */
function ratesTail(rates) {
  return `
/* The standard sample rates (STANDARD_SAMPLE_RATES, declared in omx-contract's rates.json): the set
 * a rate is checked against and the grid a native tool iterates. Guarded on its own, outside the
 * include guard, so a tool built against an older copy of this header can include this one after
 * it and gain the rates without mixing the two copies' limits. */
#ifndef OMX_DECLARED_RATE_COUNT
${genDeclaredRates(rates)}
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

const constCase = (s) => String(s).replace(/([a-z0-9])([A-Z])/g, '$1_$2').toUpperCase();

/** The enumerator names of one set, in order: `OMX_<SET>_<ID>`. */
export const setEnumerators = (set) => set.ids.map((id) => `OMX_${set.name}_${constCase(id)}`);

/**
 * Every set as a C enum: the id's position is its value for named ids, the number itself for numeric
 * ids; `OMX_<SET>_COUNT`, and `OMX_<SET>_DEFAULT` when the set names a default. A set whose ids carry values adds
 * `OMX_<SET>_UNIT`, `OMX_<SET>_<ID>_VALUE` for each id that carries one, and `omx_<set>_value(id, &out)`, which writes
 * the id's value and returns 1, or returns 0 for an id that carries none: a kernel reads the number from the id
 * (the drive's roll-off corner), never a sentinel.
 */
function genSetValues(set, names) {
  const fn = `omx_${set.name.toLowerCase()}_value`;
  const carried = set.ids.map((id, i) => [names[i], set.values[i]]).filter(([, v]) => v !== null);
  return [
    `#define OMX_${set.name}_UNIT ${cStringLiteral(set.unit)}`,
    ...carried.map(([n, v]) => `#define ${n}_VALUE ${floatLiteral(v)}`),
    `static inline int ${fn}(int id, float *out) {`,
    '  switch (id) {',
    ...carried.map(([n]) => `  case ${n}: *out = ${n}_VALUE; return 1;`),
    '  default: return 0;',
    '  }',
    '}',
  ];
}

function genDeclaredSetsEnums(sets) {
  return sets.map((set) => {
    const names = setEnumerators(set);
    const numeric = typeof set.ids[0] === 'number';
    const members = set.ids.map((id, i) => `  ${names[i]} = ${numeric ? id : i},`);
    const lines = [`enum omx_${set.name.toLowerCase()} {`, ...members, '};', `#define OMX_${set.name}_COUNT ${set.ids.length}u`];
    if (set.default !== undefined) lines.push(`#define OMX_${set.name}_DEFAULT ${names[set.ids.indexOf(set.default)]}`);
    if (set.values) lines.push(...genSetValues(set, names));
    return lines.join('\n');
  }).join('\n');
}

/** A display bound: a float literal, a whole number with its decimal point. */
const floatLiteral = (n) => `${Number.isInteger(n) ? `${n}.0` : n}f`;

/**
 * Every kernel's readouts (docs/readouts.md), kernels in file order: an enum of the readouts, each at its position,
 * `OMX_<KERNEL>_READOUT_COUNT`, and per readout `_MIN`, `_MAX`, `_RATE_HZ`, `_SCALE` and `_UNIT`.
 */
function genReadouts(kernels) {
  return Object.entries(kernels ?? {}).filter(([, k]) => k.readouts?.length).map(([kernel, { readouts }]) => {
    const K = kernel.toUpperCase();
    const names = readouts.map((ro) => `OMX_${K}_READOUT_${constCase(ro.name)}`);
    const lines = [`enum omx_${kernel}_readouts {`, ...names.map((n, i) => `  ${n} = ${i},`), '};', `#define OMX_${K}_READOUT_COUNT ${readouts.length}u`];
    readouts.forEach((ro, i) => lines.push(
      `#define ${names[i]}_MIN ${floatLiteral(ro.min)}`,
      `#define ${names[i]}_MAX ${floatLiteral(ro.max)}`,
      `#define ${names[i]}_RATE_HZ ${scalarLiteral(ro.rateHz)}`,
      `#define ${names[i]}_SCALE OMX_PARAM_SCALES_${constCase(ro.scale)}`,
      `#define ${names[i]}_UNIT ${cStringLiteral(ro.unit)}`,
    ));
    return lines.join('\n');
  }).join('\n');
}

/**
 * The default band centres of an EQ (lib/eq-defaults.mjs is the rule; this is its C spelling, held
 * equal to it for every count by test/eq-defaults.test.mjs). Writes \`count\` centres to \`out\` and returns
 * \`count\`, or returns 0 for a count that is 0 or has no distinct preferred centres.
 */
function eqCentresFunction() {
  return `static inline unsigned omx_eq_default_centres(unsigned count, float *out) {
  static const double r10[] = OMX_ISO_THIRD_OCTAVE_CENTRES_HZ_INIT;
  static const double r20[] = OMX_EQ_CENTRE_SERIES_R20_HZ_INIT;
  static const double four[] = OMX_EQ_DEFAULT_CENTRES_FOUR_BAND_HZ_INIT;
  if (count == 0) return 0;
  if (count == 4) {
    for (unsigned i = 0; i < 4; i++) out[i] = (float)four[i];
    return 4;
  }
  const double lo = log((double)OMX_EQ_FREQ_RANGE_MIN);
  const double span = log((double)OMX_EQ_FREQ_RANGE_MAX / (double)OMX_EQ_FREQ_RANGE_MIN);
  for (unsigned s = 0; s < 2; s++) {
    const double *series = s ? r20 : r10;
    const unsigned n = s ? OMX_EQ_CENTRE_SERIES_R20_HZ_COUNT : OMX_ISO_THIRD_OCTAVE_CENTRES_HZ_COUNT;
    int distinct = count <= n;
    for (unsigned i = 0; distinct && i < count; i++) {
      const double t = lo + span * ((double)i + 0.5) / (double)count;
      unsigned best = 0;
      double best_d = 1e300;
      for (unsigned k = 0; k < n; k++) {
        const double d = fabs(log(series[k]) - t);
        if (d < best_d) { best_d = d; best = k; }
      }
      out[i] = (float)series[best];
      if (i > 0 && out[i] == out[i - 1]) distinct = 0;
    }
    if (distinct) return count;
  }
  return 0;
}

/* The default type of band \`index\` of an EQ with \`count\` bands: a low shelf first, a high shelf last, bells
 * between (a single band is a bell). An OMX_EQ_BAND_TYPES_* member. */
static inline int omx_eq_default_type(unsigned index, unsigned count) {
  if (count < 2) return OMX_EQ_BAND_TYPES_BELL;
  return index == 0 ? OMX_EQ_BAND_TYPES_LOW_SHELF : index == count - 1 ? OMX_EQ_BAND_TYPES_HIGH_SHELF : OMX_EQ_BAND_TYPES_BELL;
}`;
}

/**
 * A list's former names (its item's `formerly`): OMX_<FORMER>_COUNT and OMX_<FORMER>_INIT defined as the list's own
 * defines, never as a second copy of its numbers, each under a line naming the release that removes it.
 */
function genFormerListNames(former) {
  return former.map(({ former: f, name, removedIn }) => [
    `/* OMX_${f}_* is the former name of OMX_${name}_*, kept until ${removedIn} removes it: read OMX_${name}_*. */`,
    `#define OMX_${f}_COUNT OMX_${name}_COUNT`,
    `#define OMX_${f}_INIT OMX_${name}_INIT`,
  ].join('\n')).join('\n');
}

/**
 * The C names the c render spells for each item, `Map<name, Set<C name>>`, beyond OMX_<NAME>_*: a `_LIMITS` table's
 * fields (OMX_<PREFIX>_<FIELD>_MIN/_MAX/_DEFAULT), a `c.alias` (OMX_<FACT>_<FIELD>_*), a list's former name
 * (OMX_<FORMER>_COUNT/_INIT), a declared scalar's macro
 * (OMX_<MACRO>, a sheet's or `_KERNEL` item's leaves included) and the names a file's `render.c` word gives its items
 * (docs/render.md). What `links` takes as naming the item.
 */
export function cNamesOf(resolved) {
  const out = new Map();
  const add = (name, c) => { if (!out.has(name)) out.set(name, new Set()); out.get(name).add(c); };
  const travel = (name, p) => { for (const s of ['MIN', 'MAX', 'DEFAULT']) add(name, `${p}_${s}`); };
  for (const r of resolved.values()) {
    if (isNativeTable(r)) for (const f of Object.keys(r.value)) travel(r.name, `OMX_${r.name.slice(0, -'_LIMITS'.length)}_${constCase(f)}`);
    if (r.c?.alias) travel(r.name, `OMX_${r.c.alias.fact.toUpperCase()}_${constCase(r.c.alias.field)}`);
  }
  for (const f of doors(resolved).FORMER_LIST_NAMES) for (const s of ['COUNT', 'INIT']) add(f.name, `OMX_${f.former}_${s}`);
  for (const s of doors(resolved).DECLARED_SCALARS) {
    const head = s.path.split('.')[0];
    add(head, `OMX_${s.macro}`);
    add(head, `OMX_${s.macro}_DOUBLE`);
  }
  for (const f of resolved.renders ?? []) {
    for (const h of Array.isArray(f.render.c) ? f.render.c : []) for (const n of f.items) for (const [c] of ownerNames(h, resolved.get(n))) add(n, c);
  }
  return out;
}

/**
 * The defines of omx_contract_limits.h over `resolved`, its sections each under its comment: the native tables, the
 * aliases, the declared scalars, lists, the lists' former names and sets, the kernels' readouts and the default EQ
 * rule. What omx-contract's own header holds, and what an owner's `limits` section holds of its own items.
 */
export function limitsSections(resolved) {
  const d = doors(resolved);
  const tables = d.NATIVE_LIMIT_TABLES.map(([prefix, table]) => genLimitBlock(prefix, table)).join('\n\n');
  const coreLimits = new Map(d.ALIASES);
  const aliases = [...coreLimits.keys()].map((fact) => genCoreLimitBlock(coreLimits, fact)).join('\n\n');
  const above = defined([tables, aliases].join('\n'));
  const scalars = d.DECLARED_SCALARS.length ? genDeclaredScalarsBlock(d.DECLARED_SCALARS, above) : '';
  const lists = d.DECLARED_LISTS.length ? genDeclaredListsBlock(d.DECLARED_LISTS, defined([tables, aliases, scalars].join('\n'))) : '';
  const former = d.FORMER_LIST_NAMES.length ? genFormerListNames(d.FORMER_LIST_NAMES) : '';
  const sets = d.DECLARED_SET_ITEMS.length ? genDeclaredSetsEnums(d.DECLARED_SET_ITEMS) : '';
  const readouts = genReadouts(resolved.kernels);
  const centres = resolved.has('EQ_DEFAULT_CENTRES_FOUR_BAND_HZ') ? eqCentresFunction() : '';
  const sections = [
    [tables, `/* Per-parameter numeric travel, one block per \`travels\` table named <PREFIX>_LIMITS:
 * OMX_<PREFIX>_<FIELD>_MIN/_MAX/_DEFAULT, float literals. */`],
    [aliases, `/* The second C spelling of a travel, its item's \`c.alias\` { fact, field }:
 * OMX_<FACT>_<FIELD>_MIN/_MAX/_DEFAULT. Removed by a MAJOR release once no consumer reads it. */`],
    [scalars, `/* Every scalar, sheet leaf and single travel's numbers, one block sorted by macro. An integer value
 * is an integer literal, any other a float literal AND its OMX_<macro>_DOUBLE spelling. */`],
    [lists, `/* Every list rendered to C, sorted by list: OMX_<LIST>_COUNT and OMX_<LIST>_INIT { a, b, … }. */`],
    [former, `/* The former names of renamed lists (an item's \`formerly\`), deprecated: each expands to the list's own define, so a
 * reader of the old name builds unchanged until the release named beside it removes the name. */`],
    [sets, `/* Every set rendered to C, sorted by set: an enum of the ids (a named id's position, or a numeric id's number), \`OMX_<SET>_COUNT\` and,
 * where the set names a default, \`OMX_<SET>_DEFAULT\`. */`],
    [readouts, `/* Every kernel's readouts, the meters a host draws (docs/readouts.md): an enum of the readouts at their position,
 * \`OMX_<KERNEL>_READOUT_COUNT\`, and per readout its display range (_MIN, _MAX), _RATE_HZ, _SCALE (an OMX_PARAM_SCALES_*
 * member) and _UNIT. */`],
    [centres, `/* The default bands of an EQ with \`count\` bands: THE one rule, for every strip, host and count (omx-contract's
 * lib/eq-defaults.mjs; the ts render exports the same as eqDefaultCentres and eqDefaultTypes). Needs -lm. */`],
  ].filter(([body]) => body);
  return sections.map(([body, comment]) => `${comment}\n${body}`).join('\n\n');
}

/** The limits header of the resolved data: omx-contract's own omx_contract_limits.h. */
export function renderLimitsHeader(resolved) {
  const d = doors(resolved);
  return `// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
#ifndef OMX_CONTRACT_LIMITS_H
#define OMX_CONTRACT_LIMITS_H
#include <math.h>
/*
 * GENERATED — DO NOT EDIT BY HAND.
 * Produced by \`omx-contract render --target c\` from FreeMixer/omx-contract's data/, the declaration
 * as data (each item's reason is its \`doc\`). Change the data, never this file: a consumer builds
 * against the render of the omx-contract version it pins and commits none.
 *
 * A C contract (OMX_PRE/OMX_POST/OMX_INVARIANT) reads a limit from HERE, never a literal.
 */

${limitsSections(resolved)}

#endif /* OMX_CONTRACT_LIMITS_H */
${d.STANDARD_SAMPLE_RATES ? ratesTail(d.STANDARD_SAMPLE_RATES) : ''}`;
}

/** The OMX_ declared scalars of `resolved`, one block sorted by macro: an owner's `scalars` section. */
const scalarsBlock = (resolved) => genDeclaredScalarsBlock(doors(resolved).DECLARED_SCALARS, new Set());

/**
 * The headers the `render.c` words of the data declare, `[{ path, text, pkg, omx }]`, `path` the word's `header`;
 * `omx` when a section spells OMX_ names (scalars, limits), which omx_contract_limits.h of a whole read holds already.
 * A header reads the items of the file that declares it, or with `scope: package` every item of its package. Those of
 * one package when `pkg` is given (a data directory's files are the package named).
 * @throws naming both files: two files that declare one header.
 */
export function ownerHeaders(resolved, { pkg, all = false } = {}) {
  const out = [];
  const seen = new Map();
  for (const f of resolved.renders ?? []) {
    if (!Array.isArray(f.render.c) || (!all && f.pkg !== undefined && f.pkg !== pkg)) continue;
    for (const h of f.render.c) {
      if (seen.has(h.header)) throw new Error(`${f.rel} and ${seen.get(h.header)} both declare the header ${h.header}`);
      seen.set(h.header, f.rel);
      let items;
      if (h.scope === 'package') items = packageItems(resolved, f.pkg);
      else {
        items = new Map(f.items.map((n) => [n, resolved.get(n)]));
        items.kernels = f.kernel !== undefined && resolved.kernels?.[f.kernel] ? { [f.kernel]: resolved.kernels[f.kernel] } : {};
      }
      const text = renderOwnerHeader(h, items, { scalars: scalarsBlock, limits: limitsSections });
      out.push({ path: h.header, text, pkg: f.pkg, omx: Boolean(h.scalars || h.limits) });
    }
  }
  return out;
}

/**
 * Every file of the `c` target: `[{ path, text }]`, paths relative to the output directory. The whole data renders
 * omx_contract_limits.h and, under `omxcontract/` beside it, every declared header that spells no OMX_ name (the
 * layout omx-contract 2.14.0 installed) and omx_vocabulary.h, the vocabulary's codes and words (render/vocabulary.mjs); `{ pkg }` renders every header that package declares, each at its own path,
 * for the owner to commit.
 */
export function renderC(resolved, { pkg } = {}) {
  if (pkg !== undefined) return ownerHeaders(resolved, { pkg }).map(({ path, text }) => ({ path, text }));
  const files = [{ path: 'omxcontract/omx_contract_limits.h', text: renderLimitsHeader(resolved) }];
  // a header of OMX_ names repeats lines of omx_contract_limits.h, which the whole read holds once
  for (const h of ownerHeaders(resolved, { all: true })) if (!h.omx) files.push({ path: `omxcontract/${h.path}`, text: h.text });
  const vocabulary = renderVocabularyHeader(resolved);
  if (vocabulary) files.push({ path: 'omxcontract/omx_vocabulary.h', text: vocabulary });
  return files;
}

/**
 * The `c` target of a frozen sheet (test/fixtures/frozen-limits-sheet.json): `{ sheet }` rendered by the moved
 * renderer, for the round-trip proof.
 */
export function renderSheetC(fixture) {
  const s = fixture.sheet;
  const sheet = { ...s, CORE_LIMITS: new Map(Object.entries(s.CORE_LIMITS)) };
  return [{ path: 'omxcontract/omx_contract_limits.h', text: renderContractLimits(sheet) }];
}
