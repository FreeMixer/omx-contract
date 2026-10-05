// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
/**
 * The `c` target: `omxcontract/omx_contract_limits.h`, one `omxcontract/params/omx_<plugin>_params.h`
 * per plugin item and the shape they fill, `omxcontract/params/omx_plugin_param.h`. Every define is
 * spelled by openmixer's renderer, moved unchanged (c/contract-limits-render.mjs,
 * c/params-generate.mjs); only the frame (banner, section comments) is this repository's.
 */
import { readFileSync } from 'node:fs';
import {
  genCoreLimitBlock, genDeclaredListsBlock, genDeclaredRates, genDeclaredScalarsBlock, genLimitBlock, renderContractLimits,
} from './c/contract-limits-render.mjs';
import { generate } from './c/params-generate.mjs';
import { doors } from './doors.mjs';

const PLUGIN_PARAM_H = readFileSync(new URL('./c/omx_plugin_param.h', import.meta.url), 'utf8');
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

/** The limits header of the resolved data. */
export function renderLimitsHeader(resolved) {
  const d = doors(resolved);
  const tables = d.NATIVE_LIMIT_TABLES.map(([prefix, table]) => genLimitBlock(prefix, table)).join('\n\n');
  const coreLimits = new Map(d.ALIASES);
  const aliases = [...coreLimits.keys()].map((fact) => genCoreLimitBlock(coreLimits, fact)).join('\n\n');
  const above = defined([tables, aliases].join('\n'));
  const scalars = d.DECLARED_SCALARS.length ? genDeclaredScalarsBlock(d.DECLARED_SCALARS, above) : '';
  const lists = d.DECLARED_LISTS.length ? genDeclaredListsBlock(d.DECLARED_LISTS, defined([tables, aliases, scalars].join('\n'))) : '';
  const sections = [
    [tables, `/* Per-parameter numeric travel, one block per \`travels\` table named <PREFIX>_LIMITS:
 * OMX_<PREFIX>_<FIELD>_MIN/_MAX/_DEFAULT, float literals. */`],
    [aliases, `/* The second C spelling of a travel, its item's \`c.alias\` { fact, field }:
 * OMX_<FACT>_<FIELD>_MIN/_MAX/_DEFAULT. Removed by a MAJOR release once no consumer reads it. */`],
    [scalars, `/* Every scalar, sheet leaf and single travel's numbers, one block sorted by macro. An integer value
 * is an integer literal, any other a float literal AND its OMX_<macro>_DOUBLE spelling. */`],
    [lists, `/* Every list rendered to C, sorted by list: OMX_<LIST>_COUNT and OMX_<LIST>_INIT { a, b, … }. */`],
  ].filter(([body]) => body);
  return `// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
#ifndef OMX_CONTRACT_LIMITS_H
#define OMX_CONTRACT_LIMITS_H
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

/** The banner lines of a plugin's params header rendered from the data. */
const producedBy = (r) => ` * Produced by \`omx-contract render --target c\` from FreeMixer/omx-contract's ${r.rel}
 * (${r.name}): ${r.source}.
 * Change the data, never this file. Order is append-only (omx-contract spec §3.3).`;

/** Every file of the `c` target: `[{ path, text }]`, paths relative to the output directory. */
export function renderC(resolved) {
  const files = [{ path: 'omxcontract/omx_contract_limits.h', text: renderLimitsHeader(resolved) }];
  const plugins = doors(resolved).PLUGINS;
  for (const r of plugins) {
    files.push({ path: `omxcontract/params/${r.header}`, text: generate({ header: r.header, prefix: r.prefix, source: r.source, producedBy: producedBy(r) }, r.value) });
  }
  if (plugins.length) files.push({ path: 'omxcontract/params/omx_plugin_param.h', text: PLUGIN_PARAM_H });
  return files;
}

/**
 * The `c` target of a frozen openmixer sheet (test/fixtures/): `{ sheet, plugins: [{ header, prefix,
 * source, params }] }` rendered by openmixer's own renderer, for the round-trip proof (spec §4.4 step 1).
 */
export function renderSheetC(fixture) {
  const s = fixture.sheet;
  const sheet = { ...s, CORE_LIMITS: new Map(Object.entries(s.CORE_LIMITS)) };
  const files = [{ path: 'omxcontract/omx_contract_limits.h', text: renderContractLimits(sheet) }];
  for (const p of fixture.plugins) files.push({ path: `omxcontract/params/${p.header}`, text: generate(p, p.params) });
  return files;
}
