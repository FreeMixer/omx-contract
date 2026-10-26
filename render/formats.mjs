// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
/**
 * The formats' identifiers, rendered by kind and never by item (docs/data-layout.md "The renders"): the strings and
 * numbers a consumer used to type by hand, read from the mapped terms.
 *
 * - a CLAP term that carries a `value` (an extension id, a factory id, a plugin feature, a window API) is an
 *   identifier: a string define `OMX_<ID>` in C, `CLAP_IDS[<ID>]` in ts and py; a numeric `value` (the remote
 *   controls' page size) is a number: `OMX_<ID>` as an unsigned literal, `CLAP_NUMBERS[<ID>]`;
 * - an LV2 specification is a namespace: `OMX_LV2_NS_<SPEC>` is its URI with the `#` every term of it is written
 *   after, `OMX_LV2_SPEC_<SPEC>` the URI alone, `LV2_NAMESPACES[<SPEC>]` and `LV2_SPECIFICATIONS[<SPEC>]`.
 *
 * `<ID>` is the term's CLAP identifier (`CLAP_EXT_REMOTE_CONTROLS`), `<SPEC>` its item's name between `LV2_` and
 * `_TERMS` (`LV2_PORT_PROPS_TERMS` is `PORT_PROPS`).
 */
import { cStringLiteral } from './c/contract-limits-render.mjs';

const termsOf = (resolved, format) => [...resolved.values()].filter((r) => r.kind === 'terms' && r.format === format);

/** The identifiers and numbers of the CLAP terms: `{ ids: [[id, string]], numbers: [[id, integer]] }`, in file order. */
export function clapValues(resolved) {
  const ids = [];
  const numbers = [];
  for (const r of termsOf(resolved, 'clap')) {
    for (const t of Object.values(r.value)) {
      if (typeof t.value === 'string') ids.push([t.id, t.value]);
      else if (Number.isInteger(t.value) && t.value >= 0) numbers.push([t.id, t.value]);
    }
  }
  return { ids, numbers };
}

/** The namespaces of the LV2 specifications: `[[SPEC, uri]]`, in file order. */
export function lv2Specs(resolved) {
  return termsOf(resolved, 'lv2').map((r) => [r.name.replace(/^LV2_/, '').replace(/_TERMS$/, ''), r.spec]);
}

/** The module's values as plain objects, the same for every language. */
export function formatValues(resolved) {
  const { ids, numbers } = clapValues(resolved);
  const specs = lv2Specs(resolved);
  return {
    CLAP_IDS: Object.fromEntries(ids),
    CLAP_NUMBERS: Object.fromEntries(numbers),
    LV2_SPECIFICATIONS: Object.fromEntries(specs),
    LV2_NAMESPACES: Object.fromEntries(specs.map(([n, u]) => [n, `${u}#`])),
  };
}

/** The C header, or undefined when no format term carries a value. */
export function renderFormatsHeader(resolved) {
  const { ids, numbers } = clapValues(resolved);
  const specs = lv2Specs(resolved);
  if (!ids.length && !numbers.length && !specs.length) return undefined;
  const lines = [];
  const section = (title, rows) => { if (rows.length) lines.push(`/* ${title} */`, ...rows, ''); };
  section('CLAP identifiers: an extension id as get_extension is asked for it, a factory id, a plugin feature, a window API',
    ids.map(([id, v]) => `#define OMX_${id} ${cStringLiteral(v)}`));
  section('CLAP numbers the headers declare', numbers.map(([id, v]) => `#define OMX_${id} ${v}u`));
  section('The same identifiers as one list, for a reader that walks them: X(<identifier>, <string>)',
    ids.length ? [`#define OMX_CLAP_IDS(X) \\`, ...ids.map(([id, v], i) => `  X(${cStringLiteral(id)}, ${cStringLiteral(v)})${i < ids.length - 1 ? ' \\' : ''}`)] : []);
  section('LV2 specifications: the URI, and the namespace every term of it is written after (the URI and a #)',
    specs.flatMap(([n, u]) => [`#define OMX_LV2_SPEC_${n} ${cStringLiteral(u)}`, `#define OMX_LV2_NS_${n} ${cStringLiteral(`${u}#`)}`]));
  return `// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
#ifndef OMX_FORMATS_H
#define OMX_FORMATS_H
/*
 * GENERATED — DO NOT EDIT BY HAND.
 * Produced by \`omx-contract render --target c\` from FreeMixer/omx-contract's data/formats/: the identifiers and
 * numbers the CLAP headers declare and the namespaces of the LV2 specifications (docs/data-layout.md). A consumer
 * writes and compares these, never a literal of its own.
 */

${lines.join('\n').replace(/\n+$/, '')}

#endif /* OMX_FORMATS_H */
`;
}

/** The ts module's exports (`js` and `dts`) of the same values. */
export function formatsExports(resolved, tsType) {
  const values = formatValues(resolved);
  const docs = {
    CLAP_IDS: 'The CLAP identifiers (extension ids, factory ids, plugin features, window APIs) by the header\'s own identifier.',
    CLAP_NUMBERS: 'The numbers the CLAP headers declare, by the header\'s own identifier.',
    LV2_SPECIFICATIONS: 'The URI of each LV2 specification, by its name in upper snake case.',
    LV2_NAMESPACES: 'The namespace each LV2 specification\'s terms are written after: its URI and a #.',
  };
  let js = '';
  let dts = '';
  for (const [name, value] of Object.entries(values)) {
    if (!Object.keys(value).length) continue;
    const doc = `/**\n * ${docs[name]}\n * @see data/formats/\n */`;
    js += `\n${doc}\nexport const ${name} = ${JSON.stringify(value, null, 2)};\n`;
    dts += `\n${doc}\nexport declare const ${name}: ${tsType(value)};\n`;
  }
  return { js, dts };
}

const pyLiteral = (v) => (typeof v === 'string' ? JSON.stringify(v) : String(v));

/** The python module `omx_contract.py`, or undefined when there is nothing to render. */
export function renderFormatsPy(resolved) {
  const values = formatValues(resolved);
  const blocks = Object.entries(values).filter(([, v]) => Object.keys(v).length).map(([name, value]) =>
    `${name} = {\n${Object.entries(value).map(([k, v]) => `    ${JSON.stringify(k)}: ${pyLiteral(v)},`).join('\n')}\n}\n`);
  if (!blocks.length) return undefined;
  return `# SPDX-License-Identifier: GPL-3.0-or-later
# Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
"""The format identifiers of FreeMixer/omx-contract: the CLAP identifiers and numbers the headers declare and the
namespaces of the LV2 specifications. GENERATED by \`omx-contract render --target py\` from data/formats/, do not edit."""

${blocks.join('\n')}`;
}
