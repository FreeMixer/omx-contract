// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
/**
 * The carriers of the resource hints (docs/resource-hints.md), rendered from the one words item that declares an
 * `extension`: the CLAP draft as a C header (`omxcontract/omx_resource_hints.h`, the `c` target) and the LV2
 * properties as Turtle (`omx-resource-hints.ttl`, the `lv2` target). Neither restates a hint: the order, the units,
 * the types and the prose are read from the item.
 */
import { constOf, hintItems, memberOf, unitOf } from '../lib/hints.mjs';
import { cStringLiteral } from './c/contract-limits-render.mjs';

const oneLine = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
const ttlString = (s) => `"${oneLine(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

/** The header's guard and file name. */
export const HINTS_HEADER = 'omxcontract/omx_resource_hints.h';
export const HINTS_TURTLE = 'omx-resource-hints.ttl';

/** The C header of the CLAP draft, or undefined when no item declares an extension. */
export function renderHintsHeader(resolved) {
  const [item] = hintItems(resolved);
  if (!item) return undefined;
  const hints = Object.entries(item.value);
  const id = item.extension.clap;
  const bits = hints.map(([k, w], i) => `#define OMX_RESOURCE_HINT_${constOf(k)} (1u << ${i}) ///< ${oneLine(w.doc)} (${w.figureUnit})`);
  const members = hints.map(([k, w]) => `    ${unitOf(k, w).c} ${memberOf(w.word)}; ///< ${oneLine(w.doc)} (${w.figureUnit})`);
  return `// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
#ifndef OMX_RESOURCE_HINTS_H
#define OMX_RESOURCE_HINTS_H
/*
 * GENERATED — DO NOT EDIT BY HAND.
 * Produced by \`omx-contract render --target c\` from ${item.name} (${item.rel}, docs/resource-hints.md):
 * the CLAP extension ${id}, the hints a plugin declares about its own footprint. A hint is a claim:
 * plugin-qualify measures the same resource and a declared figure the measurement does not bear out is a finding.
 */

#include <stdbool.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

#ifndef CLAP_ABI
#define CLAP_ABI
#endif

struct clap_plugin;

/** The extension id, as a plugin's get_extension is asked for it. */
#define OMX_CLAP_EXT_RESOURCE_HINTS_DRAFT ${cStringLiteral(id)}

/** One bit of \`declared\` per hint, in the order of ${item.name}. */
${bits.join('\n')}

/** The number of hints. */
#define OMX_RESOURCE_HINT_COUNT ${hints.length}u

/** The hints of a plugin. A member whose bit of \`declared\` is clear is unknown, never zero. */
typedef struct omx_resource_hints
{
    uint32_t declared; ///< The OMX_RESOURCE_HINT_ bits of the hints the plugin states.
${members.join('\n')}
} omx_resource_hints_t;

/** The ${id} extension a plugin offers. */
typedef struct omx_clap_plugin_resource_hints
{
    /** [main-thread] Fills \`hints\`; false when the plugin has none to state. */
    bool (CLAP_ABI *get)(const struct clap_plugin *plugin, omx_resource_hints_t *hints);
} omx_clap_plugin_resource_hints_t;

#ifdef __cplusplus
}
#endif

#endif /* OMX_RESOURCE_HINTS_H */
`;
}

/** The Turtle file of the LV2 properties, or undefined when no item declares an extension. */
export function renderHintsTurtle(resolved) {
  const [item] = hintItems(resolved);
  if (!item) return undefined;
  const { prefix, namespace } = item.extension.lv2;
  const kinds = resolved.get(item.groups);
  const seeAlso = (group) => {
    const kind = kinds && Object.values(kinds.value).find((w) => w.word === group);
    const uris = [];
    for (const ref of kind?.from ?? []) {
      const [name, term] = ref.split('#');
      const t = resolved.get(name);
      if (t?.kind === 'terms' && t.format === 'lv2' && t.value[term]?.uri) uris.push(`<${t.value[term].uri}>`);
    }
    return uris;
  };
  const props = Object.entries(item.value).map(([k, w]) => {
    const lines = [
      `${prefix}:${k}`,
      '    a rdf:Property , owl:DatatypeProperty ;',
      `    rdfs:label ${ttlString(w.word)} ;`,
      `    rdfs:comment ${ttlString(w.doc)} ;`,
      '    rdfs:domain lv2:Plugin ;',
      `    rdfs:range xsd:${unitOf(k, w).xsd} ;`,
      `    ${prefix}:resource ${ttlString(w.group)} ;`,
      `    ${prefix}:unit ${ttlString(w.figureUnit)} ;`,
      `    ${prefix}:basis ${ttlString(w.basis)}`,
    ];
    const see = seeAlso(w.group);
    if (see.length) { lines[lines.length - 1] += ' ;'; lines.push(`    rdfs:seeAlso ${see.join(' , ')}`); }
    return `${lines.join('\n')} .`;
  });
  const annotations = [['resource', 'The resource a hint declares, a word of RESOURCE_KINDS.'], ['unit', 'The unit of a hint\'s figure, a word of RESOURCE_UNITS.'], ['basis', 'How a hint\'s figure is known, a word of RESOURCE_BASES.']].map(([n, d]) => `${prefix}:${n}\n    a owl:AnnotationProperty ;\n    rdfs:comment ${ttlString(d)} .`);
  return `# SPDX-License-Identifier: GPL-3.0-or-later
# Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
# GENERATED — DO NOT EDIT BY HAND.
# Produced by \`omx-contract render --target lv2\` from ${item.name} (${item.rel}, docs/resource-hints.md):
# the hints a plugin declares about its own footprint, as LV2 properties of a plugin.
@prefix ${prefix}: <${namespace}> .
@prefix lv2: <http://lv2plug.in/ns/lv2core#> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

<${namespace.replace(/#$/, '')}>
    a owl:Ontology ;
    rdfs:label "openmixer resource hints" ;
    rdfs:comment ${ttlString(item.doc)} .

${annotations.join('\n\n')}

${props.join('\n\n')}
`;
}

/** The lv2 target: `[{ path, text }]`, empty when no item declares an extension. */
export function renderLv2(resolved) {
  const text = renderHintsTurtle(resolved);
  return text === undefined ? [] : [{ path: HINTS_TURTLE, text }];
}
