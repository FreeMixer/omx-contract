// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
/**
 * The parameter-table half of the C renderer: `generate` and its helpers, moved from openmixer's
 * packages/omx-plugins/tools/params-gen.mjs (omx-contract spec §3.4). Two changes only: the plugin
 * (header, prefix, source) is handed in instead of looked up in params-gen's PLUGINS, which is data
 * now (data/plugins/), and the banner's "Produced by" lines are a parameter whose default is
 * params-gen's own text, so the frozen openmixer sheet still renders byte for byte.
 */

/** params-gen.mjs's banner lines, for a render of openmixer's own selection (test/fixtures/). */
export const PARAMS_GEN_PRODUCED_BY = (source) => ` * Produced by packages/omx-plugins/tools/params-gen.mjs from @freemixer/core:
 * ${source}.
 * Regenerate: \`node packages/omx-plugins/tools/params-gen.mjs\`, then commit the result
 * (docs/design/specs/2026-09-25-omx-plugins-dpf.md §3c). Order is append-only (§3b).`;

/** The flag bits `include/omx_plugin_param.h` (PLUGIN_INCLUDE_DIR) declares. */
const FLAG_INTEGER = 'OMX_PLUGIN_PARAM_INTEGER';
const FLAG_TOGGLE = 'OMX_PLUGIN_PARAM_TOGGLE';

/** `timeMs` (unit ms) -> "Time"; `feedback` -> "Feedback". Derived, never a label table. */
export function labelOf(symbol, unit) {
  const words = symbol.replace(/([a-z0-9])([A-Z])/g, '$1 $2').split(' ');
  if (words.length > 1 && unit && words[words.length - 1].toLowerCase() === unit.toLowerCase()) words.pop();
  const s = words.join(' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** `timeMs` -> `TIME_MS`. */
export function constName(symbol) {
  return symbol.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toUpperCase();
}

function floatLiteral(n) {
  if (!Number.isFinite(n)) throw new Error(`params-gen: non-finite bound ${n}`);
  return `${Number.isInteger(n) ? `${n}.0` : `${n}`}f`;
}

function cString(s) {
  return JSON.stringify(s);
}

/** The header text for one kernel's resolved parameter list. Pure: no clock, no path, no host. */
export function generate(plugin, params) {
  const { header, prefix, source } = plugin;
  const producedBy = plugin.producedBy ?? PARAMS_GEN_PRODUCED_BY(source);
  const guard = header.replace(/\W/g, '_').toUpperCase();
  const enumLines = params.map((p, i) => `  ${prefix}_PARAM_${constName(p.symbol)} = ${i},`);
  const rows = params.map((p) => {
    const flags = [];
    if (p.toggle) flags.push(FLAG_TOGGLE);
    else if (p.step >= 1 && Number.isInteger(p.step) && Number.isInteger(p.min) && Number.isInteger(p.max)) flags.push(FLAG_INTEGER);
    return `  { ${cString(p.symbol)}, ${cString(labelOf(p.symbol, p.unit))}, ${cString(p.unit)}, ${floatLiteral(p.min)}, ${floatLiteral(p.max)}, ${floatLiteral(p.def)}, ${flags.length ? flags.join(' | ') : '0u'} },`;
  });
  const macros = params.flatMap((p) => {
    const n = `${prefix}_PARAM_${constName(p.symbol)}`;
    return [`#define ${n}_MIN ${floatLiteral(p.min)}`, `#define ${n}_MAX ${floatLiteral(p.max)}`, `#define ${n}_DEFAULT ${floatLiteral(p.def)}`];
  });
  return `// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
#ifndef ${guard}
#define ${guard}
/*
 * GENERATED — DO NOT EDIT BY HAND.
${producedBy}
 */
#include "omx_plugin_param.h"

enum {
${enumLines.join('\n')}
  ${prefix}_PARAM_COUNT = ${params.length}
};

static const omx_plugin_param ${prefix}_PARAMS[${prefix}_PARAM_COUNT] = {
${rows.join('\n')}
};

/* One macro per declared bound: what a C face reads where a constant is needed. */
${macros.join('\n')}

#endif /* ${guard} */
`;
}
