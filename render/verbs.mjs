// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
/**
 * The verbs' C render (docs/contract-dir.md), by kind and never by item: every verb of every `verbs` item, as
 * `omxcontract/omx_host_verbs.h` for a whole read and `<stem>_host_verbs.h` for one package (`render --package`, the
 * stem render/vocabulary.mjs names). A verb is `OMX_VERB_<VERB>`, its word, and `OMX_VERB_<VERB>_FMT`, its format;
 * what each host owes it is a table a host reads at run time. The ts and json renders carry the items as they carry
 * any other.
 */
import { readFileSync } from 'node:fs';
import { packageItems } from '../lib/data.mjs';
import { HOSTS_ITEM } from '../lib/verbs.mjs';
import { cStringLiteral } from './c/contract-limits-render.mjs';
import { vocabularyStem } from './vocabulary.mjs';

const constCase = (s) => String(s).replace(/([a-z0-9])([A-Z])/g, '$1_$2').replace(/[^A-Za-z0-9]+/g, '_').toUpperCase();
const oneLine = (s) => String(s ?? '').replace(/\*\//g, '* /').replace(/\s+/g, ' ').trim();

/** What a host owes a verb, in the order of the C enum: a host a verb leaves out owes it nothing. */
export const LEVELS = ['unsupported', 'optional', 'required'];

/** The header of a whole read. */
export const VERBS_HEADER = 'omxcontract/omx_host_verbs.h';

/** A verb's C name: OMX_VERB_ and the word in upper snake case (track_info is OMX_VERB_TRACK_INFO). */
export const verbMacro = (word) => `OMX_VERB_${constCase(word)}`;

/** The hosts, in the order of VERB_HOSTS: of the read, else of the data this renderer ships with. */
function hostsOf(resolved) {
  const r = resolved.get(HOSTS_ITEM);
  const words = r ? r.value : JSON.parse(readFileSync(new URL('../data/verbs.json', import.meta.url), 'utf8'))[HOSTS_ITEM].words;
  return Object.values(words).map((w) => w.word);
}

/** Every verb of `resolved`, items in their order: `[{ item, rel, key, verb }]`, the verb resolved. */
const verbsIn = (resolved) => [...resolved.values()].filter((r) => r.kind === 'verbs')
  .flatMap((r) => Object.entries(r.value).map(([key, verb]) => ({ item: r.name, rel: r.rel, key, verb })));

/** The C names the render spells for each verbs item, `Map<name, Set<C name>>`: its verbs' words and formats. */
export function verbCNames(resolved) {
  const out = new Map();
  for (const { item, verb } of verbsIn(resolved)) {
    if (!out.has(item)) out.set(item, new Set());
    out.get(item).add(verbMacro(verb.verb)).add(`${verbMacro(verb.verb)}_FMT`);
  }
  return out;
}

/**
 * The C header of the verbs, or undefined when there are none: of the whole read, or with `pkg` of that package's
 * verbs only. The types and the hosts sit under a guard of their own, so a package's header and the whole read's
 * include together; a verb's macros are spelled alike in both.
 */
export function renderVerbsHeader(resolved, pkg) {
  const verbs = verbsIn(pkg === undefined ? resolved : packageItems(resolved, pkg));
  if (!verbs.length) return undefined;
  const hosts = hostsOf(resolved);
  const stem = constCase(vocabularyStem(pkg ?? 'omx-contract')).toLowerCase();
  const guard = `${stem.toUpperCase()}_HOST_VERBS_H`;
  const level = (l) => `OMX_HOST_VERB_${(l ?? 'unsupported').toUpperCase()}`;
  const blocks = verbs.map(({ item, rel, key, verb }) => {
    const M = verbMacro(verb.verb);
    const lines = [
      `/* ${item}.${key} (${rel}): ${oneLine(verb.doc)} */`,
      `#define ${M} ${cStringLiteral(verb.verb)}`,
      `#define ${M}_FMT ${cStringLiteral(verb.format)}`,
      `#define ${M}_REPLY ${cStringLiteral(verb.reply)}`,
    ];
    if (verb.codes?.length) {
      lines.push(`#define ${M}_CODES_COUNT ${verb.codes.length}u`);
      lines.push(`#define ${M}_CODES_INIT { ${verb.codes.map((c) => c.resp).join(', ')} } /* ${verb.codes.map((c) => c.code).join(', ')} */`);
    }
    return lines.join('\n');
  });
  const rows = verbs.map(({ verb }) => {
    const M = verbMacro(verb.verb);
    return `    { ${M}, ${M}_FMT, ${M}_REPLY, { ${hosts.map((h) => level(verb.implementedBy[h])).join(', ')} } },`;
  });
  return `// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
#ifndef ${guard}
#define ${guard}
/*
 * GENERATED: DO NOT EDIT BY HAND.
 * Produced by \`omx-contract render --target c\` from ${pkg === undefined ? 'the whole read' : `${pkg}'s files`}.
 * The host verbs (docs/contract-dir.md): a verb is OMX_VERB_<VERB>, its word, OMX_VERB_<VERB>_FMT, the line
 * protocol_add_command takes, and OMX_VERB_<VERB>_REPLY; a verb that answers refusals carries their resp numbers
 * in OMX_VERB_<VERB>_CODES_INIT. ${stem}_host_verbs() is the table of what each host owes each verb.
 */

#include <string.h>

#ifndef OMX_HOST_VERB_TYPES_H
#define OMX_HOST_VERB_TYPES_H
/* What a host owes a verb: required, answered as its grammar says; optional, answered or refused, never misread;
 * unsupported, refused on purpose. */
enum omx_host_verb_level {
${LEVELS.map((l, i) => `  OMX_HOST_VERB_${l.toUpperCase()} = ${i},`).join('\n')}
};
/* The hosts of VERB_HOSTS, a column each of a verb's level, in this order. */
${hosts.map((h, i) => `#define OMX_HOST_VERB_HOST_${constCase(h)} ${i}u`).join('\n')}
#define OMX_HOST_VERB_HOST_COUNT ${hosts.length}u
#define OMX_HOST_VERB_HOSTS_INIT { ${hosts.map(cStringLiteral).join(', ')} }
struct omx_host_verb {
  const char *verb;
  const char *format;
  const char *reply;
  enum omx_host_verb_level level[OMX_HOST_VERB_HOST_COUNT];
};
#endif /* OMX_HOST_VERB_TYPES_H */

${blocks.join('\n\n')}

#define ${stem.toUpperCase()}_HOST_VERB_COUNT ${verbs.length}u

/* Every verb, in the order of its items, with what each host owes it. */
static inline const struct omx_host_verb *${stem}_host_verbs(void) {
  static const struct omx_host_verb table[${stem.toUpperCase()}_HOST_VERB_COUNT] = {
${rows.join('\n')}
  };
  return table;
}

/* The verb whose word is \`verb\`, or NULL. */
static inline const struct omx_host_verb *${stem}_host_verb_find(const char *verb) {
  const struct omx_host_verb *t = ${stem}_host_verbs();
  for (unsigned i = 0; i < ${stem.toUpperCase()}_HOST_VERB_COUNT; i++)
    if (!strcmp(t[i].verb, verb)) return &t[i];
  return NULL;
}

/* What the host at column \`host\` (an OMX_HOST_VERB_HOST_* index) owes \`verb\`: unsupported for a verb not here. */
static inline enum omx_host_verb_level ${stem}_host_verb_level(const char *verb, unsigned host) {
  const struct omx_host_verb *v = ${stem}_host_verb_find(verb);
  return v && host < OMX_HOST_VERB_HOST_COUNT ? v->level[host] : OMX_HOST_VERB_UNSUPPORTED;
}

#endif /* ${guard} */
`;
}

/** The c file of one package's verbs (`render --package`), `[{ path, text }]`, empty when it declares none. */
export function packageVerbsC(resolved, pkg) {
  const text = renderVerbsHeader(resolved, pkg);
  return text === undefined ? [] : [{ path: `${constCase(vocabularyStem(pkg)).toLowerCase()}_host_verbs.h`, text }];
}
