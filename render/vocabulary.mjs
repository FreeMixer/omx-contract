// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
/**
 * The vocabulary's generic renders (docs/data-layout.md), by kind and never by item: every `codes` and `words` item
 * whose file carries no `render` word of its own (an owner's file renders its items itself, docs/render.md).
 * `omxcontract/omx_vocabulary.h` for C, `omx-vocabulary.schema.json` (a JSON Schema fragment, one `$defs` enum per
 * item) for a schema that references the words, and `<ITEM>_WORDS` in the ts module. `render --package` spells one
 * package's vocabulary the same way, by kind (docs/render.md).
 */
import { packageItems } from '../lib/data.mjs';
import { cStringLiteral } from './c/contract-limits-render.mjs';

const constCase = (s) => String(s).replace(/([a-z0-9])([A-Z])/g, '$1_$2').replace(/[^A-Za-z0-9]+/g, '_').toUpperCase();

/** The items the vocabulary renders: codes and words items of files with no render word, in file order. */
export function vocabularyItems(resolved) {
  const rendered = new Set((resolved.renders ?? []).flatMap((f) => f.items));
  return [...resolved.values()].filter((r) => (r.kind === 'codes' || r.kind === 'words') && !rendered.has(r.name));
}

/** A code's C name: OMX_ and the code in upper snake case (hosting.rt-safety.unmeasured is OMX_HOSTING_RT_SAFETY_UNMEASURED). */
export const codeMacro = (code) => `OMX_${constCase(code)}`;

/** A reply code's resp number as C: the code's macro and _RESP (reply.host.pin-absent is OMX_REPLY_HOST_PIN_ABSENT_RESP, -508). */
export const respMacro = (code) => `${codeMacro(code)}_RESP`;

/** A word's C name: OMX_<ITEM>_<NAME>. */
export const wordMacro = (item, name) => `OMX_${item}_${constCase(name)}`;

/** The words of a words item, in their declared order. */
export const wordsOf = (r) => Object.values(r.value).map((w) => w.word);

const trailing = (doc) => (doc ? ` ///< ${doc.replace(/\*\//g, '* /').replace(/\s+/g, ' ')}` : '');

/**
 * The stem of a package's vocabulary files (docs/render.md): `omx` for omx-contract, whose vocabulary is the
 * contract's own (omx_vocabulary.h), and the package's name for any other, so two packages' headers include together.
 */
export const vocabularyStem = (pkg) => (pkg === 'omx-contract' ? 'omx' : pkg);

/**
 * The C header of the vocabulary, or undefined when there is none: of the whole read, or with `pkg` of that package's
 * items only, as `<stem>_vocabulary.h`. Both spell an item the same way, by kind.
 */
export function renderVocabularyHeader(resolved, pkg) {
  const items = vocabularyItems(pkg === undefined ? resolved : packageItems(resolved, pkg));
  if (!items.length) return undefined;
  const guard = `${constCase(vocabularyStem(pkg ?? 'omx-contract'))}_VOCABULARY_H`;
  const blocks = items.map((r) => {
    const lines = [`/* ${r.name} (${r.rel}) */`];
    if (r.kind === 'codes') {
      for (const c of Object.values(r.value)) {
        lines.push(`#define ${codeMacro(c.code)} ${cStringLiteral(c.code)}${trailing(c.doc)}`);
        if (Number.isInteger(c.resp)) lines.push(`#define ${respMacro(c.code)} (${c.resp})`);
      }
    } else {
      for (const [n, w] of Object.entries(r.value)) lines.push(`#define ${wordMacro(r.name, n)} ${cStringLiteral(w.word)}${trailing(w.doc)}`);
      lines.push(`#define OMX_${r.name}_COUNT ${Object.keys(r.value).length}u`);
      lines.push(`#define OMX_${r.name}_INIT { ${wordsOf(r).map(cStringLiteral).join(', ')} }`);
    }
    return lines.join('\n');
  });
  return `// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
#ifndef ${guard}
#define ${guard}
/*
 * GENERATED: DO NOT EDIT BY HAND.
 * Produced by \`omx-contract render --target c\` from FreeMixer/${pkg ?? 'omx-contract'}'s data/: the vocabulary
 * (docs/data-layout.md). A code is OMX_ and the code in upper snake case, and a reply code that carries a resp has it as that name and _RESP; a word is OMX_<ITEM>_<NAME>, each words
 * item with its _COUNT and an _INIT of its words in their order. A consumer writes and compares these, never a
 * literal of its own.
 */

${blocks.join('\n\n')}

#endif /* ${guard} */
`;
}

/** The c file of one package's vocabulary (`render --package`), `[{ path, text }]`, empty when it has none. */
export function packageVocabularyC(resolved, pkg) {
  const text = renderVocabularyHeader(resolved, pkg);
  return text === undefined ? [] : [{ path: `${constCase(vocabularyStem(pkg)).toLowerCase()}_vocabulary.h`, text }];
}

/** The JSON Schema fragment of the vocabulary, or undefined when there is none. */
export function renderVocabularySchema(resolved, version) {
  const items = vocabularyItems(resolved);
  if (!items.length) return undefined;
  const defs = {};
  for (const r of items) {
    defs[r.name] = {
      description: r.doc,
      enum: r.kind === 'codes' ? Object.values(r.value).map((c) => c.code) : wordsOf(r),
    };
  }
  const doc = {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: `https://github.com/FreeMixer/omx-contract/raw/v${version}/share/omx-contract/omx-vocabulary.schema.json`,
    title: 'omx-contract vocabulary',
    description: 'GENERATED by `omx-contract render --target json` from data/: one enum per codes and words item of the vocabulary (docs/data-layout.md), for a schema that references the words instead of repeating them. GPL-3.0-or-later.',
    $defs: defs,
  };
  return `${JSON.stringify(doc, null, 2)}\n`;
}

/** The ts module's `<ITEM>_WORDS`: each words item's words in order, `as const`. */
export function wordsExports(resolved, tsType) {
  const items = vocabularyItems(resolved).filter((r) => r.kind === 'words');
  const doc = (r) => `/**\n * The words of ${r.name}, in their declared order.\n * @see ${r.rel}\n */`;
  return {
    js: items.map((r) => `\n${doc(r)}\nexport const ${r.name}_WORDS = ${JSON.stringify(wordsOf(r), null, 2)};\n`).join(''),
    dts: items.map((r) => `\n${doc(r)}\nexport declare const ${r.name}_WORDS: ${tsType(wordsOf(r))};\n`).join(''),
  };
}

/**
 * The ts module of one package's vocabulary (`render --package`), `<stem>-vocabulary.js` and `.d.ts`, empty when it
 * has none: each item exported under its name as the whole ts render exports it (`item(r)`), then `<ITEM>_WORDS`.
 */
export function packageVocabularyTs(resolved, pkg, { item, tsType }) {
  const mine = packageItems(resolved, pkg);
  const items = vocabularyItems(mine);
  if (!items.length) return [];
  const mod = `${vocabularyStem(pkg)}-vocabulary`;
  const banner = `// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
// GENERATED by \`omx-contract render --target ts --package ${pkg}\` from ${pkg}'s vocabulary, do not edit.
`;
  const words = wordsExports(mine, tsType);
  return [
    { path: `${mod}.js`, text: banner + items.map((r) => item(r, false)).join('') + words.js },
    { path: `${mod}.d.ts`, text: banner + items.map((r) => item(r, true)).join('') + words.dts },
  ];
}
