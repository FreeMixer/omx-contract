// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
/**
 * The `c` target: `omxcontract/omx_contract_limits.h`. Every define is spelled by openmixer's
 * renderer, moved unchanged (c/contract-limits-render.mjs); only the frame (banner, section
 * comments) is this repository's. A plugin's parameter header is rendered by omx-plugins from its
 * declaration, by reference to the items here.
 */
import {
  genCoreLimitBlock, genDeclaredListsBlock, genDeclaredRates, genDeclaredScalarsBlock, genLimitBlock, renderContractLimits,
} from './c/contract-limits-render.mjs';
import { doors } from './doors.mjs';

const defined = (text) => new Set([...text.matchAll(/^#define (OMX_\w+)/gm)].map((m) => m[1]));

/** The rate tail of openmixer's header, outside the include guard, byte for byte. */
function ratesTail(rates) {
  return `
/* The sample rates the console declares (core's STANDARD_SAMPLE_RATES, row-codecs.ts): the set a
 * contract's rate-is-declared precondition accepts, through omx_rate_is_declared(), and the grid a
 * native tool iterates. Guarded on its own so a tool built against a pinned copy of this header
 * (lv2-inprocess-pin.sh) can include this tree's copy after it and gain the rates without mixing
 * the pin's limits. */
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
 * ids; `OMX_<SET>_COUNT`, and `OMX_<SET>_DEFAULT` when the set names a default.
 */
function genDeclaredSetsEnums(sets) {
  return sets.map((set) => {
    const names = setEnumerators(set);
    const numeric = typeof set.ids[0] === 'number';
    const members = set.ids.map((id, i) => `  ${names[i]} = ${numeric ? id : i},`);
    const lines = [`enum omx_${set.name.toLowerCase()} {`, ...members, '};', `#define OMX_${set.name}_COUNT ${set.ids.length}u`];
    if (set.default !== undefined) lines.push(`#define OMX_${set.name}_DEFAULT ${names[set.ids.indexOf(set.default)]}`);
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

/** The limits header of the resolved data. */
export function renderLimitsHeader(resolved) {
  const d = doors(resolved);
  const tables = d.NATIVE_LIMIT_TABLES.map(([prefix, table]) => genLimitBlock(prefix, table)).join('\n\n');
  const coreLimits = new Map(d.ALIASES);
  const aliases = [...coreLimits.keys()].map((fact) => genCoreLimitBlock(coreLimits, fact)).join('\n\n');
  const above = defined([tables, aliases].join('\n'));
  const scalars = d.DECLARED_SCALARS.length ? genDeclaredScalarsBlock(d.DECLARED_SCALARS, above) : '';
  const lists = d.DECLARED_LISTS.length ? genDeclaredListsBlock(d.DECLARED_LISTS, defined([tables, aliases, scalars].join('\n'))) : '';
  const sets = d.DECLARED_SET_ITEMS.length ? genDeclaredSetsEnums(d.DECLARED_SET_ITEMS) : '';
  const centres = resolved.has('EQ_DEFAULT_CENTRES_FOUR_BAND_HZ') ? eqCentresFunction() : '';
  const sections = [
    [tables, `/* Per-parameter numeric travel, one block per \`travels\` table named <PREFIX>_LIMITS:
 * OMX_<PREFIX>_<FIELD>_MIN/_MAX/_DEFAULT, float literals. */`],
    [aliases, `/* The second C spelling of a travel, its item's \`c.alias\` { fact, field }:
 * OMX_<FACT>_<FIELD>_MIN/_MAX/_DEFAULT. Removed by a MAJOR release once no consumer reads it. */`],
    [scalars, `/* Every scalar, sheet leaf and single travel's numbers, one block sorted by macro. An integer value
 * is an integer literal, any other a float literal AND its OMX_<macro>_DOUBLE spelling. */`],
    [lists, `/* Every list rendered to C, sorted by list: OMX_<LIST>_COUNT and OMX_<LIST>_INIT { a, b, … }. */`],
    [sets, `/* Every set rendered to C, sorted by set: an enum of the ids (a named id's position, or a numeric id's number), \`OMX_<SET>_COUNT\` and,
 * where the set names a default, \`OMX_<SET>_DEFAULT\`. */`],
    [centres, `/* The default bands of an EQ with \`count\` bands: THE one rule, for every strip, host and count (omx-contract's
 * lib/eq-defaults.mjs; the ts render exports the same as eqDefaultCentres and eqDefaultTypes). Needs -lm. */`],
  ].filter(([body]) => body);
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

${sections.map(([body, comment]) => `${comment}\n${body}`).join('\n\n')}

#endif /* OMX_CONTRACT_LIMITS_H */
${d.STANDARD_SAMPLE_RATES ? ratesTail(d.STANDARD_SAMPLE_RATES) : ''}`;
}

/** Every file of the `c` target: `[{ path, text }]`, paths relative to the output directory. */
export function renderC(resolved) {
  return [{ path: 'omxcontract/omx_contract_limits.h', text: renderLimitsHeader(resolved) }];
}

/**
 * The `c` target of a frozen openmixer sheet (test/fixtures/): `{ sheet }` rendered by openmixer's own
 * renderer, for the round-trip proof (spec §4.4 step 1).
 */
export function renderSheetC(fixture) {
  const s = fixture.sheet;
  const sheet = { ...s, CORE_LIMITS: new Map(Object.entries(s.CORE_LIMITS)) };
  return [{ path: 'omxcontract/omx_contract_limits.h', text: renderContractLimits(sheet) }];
}
