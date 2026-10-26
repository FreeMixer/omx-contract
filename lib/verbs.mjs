// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
/**
 * The verbs items (docs/contract-dir.md): the rules a verb is held to beyond its shape, over a whole read, so that
 * `validate` (a data directory) and the contract-directory reader refuse the same things. Each problem names its
 * CONTRACT_CODES code by name; `validate` reports it under the rule of the same name.
 */
import { readFileSync } from 'node:fs';

/** The item that lists the hosts a verb's implementedBy may name, and the file it ships in. */
export const HOSTS_ITEM = 'VERB_HOSTS';
const HOSTS_FILE = new URL('../data/verbs.json', import.meta.url);

/** The host words: those of the read's VERB_HOSTS, else of the one this reader ships with. */
export function hostWords(items) {
  const words = items.get(HOSTS_ITEM)?.item.words ?? JSON.parse(readFileSync(HOSTS_FILE, 'utf8'))[HOSTS_ITEM].words;
  return Object.values(words).map((w) => w.word);
}

/** Every verb of the read, in item order: `[{ item, key, verb, rel, pkg }]`. */
export function verbsOf(items) {
  const out = [];
  for (const it of items.values()) {
    if (it.item?.kind !== 'verbs') continue;
    for (const [key, verb] of Object.entries(it.item.verbs ?? {})) out.push({ item: it.name, key, verb, rel: it.rel, pkg: it.pkg });
  }
  return out;
}

/**
 * The problems of every verb of `items` (a read's items, `Map<name, { name, rel, item, pkg }>`):
 * `[{ name, rel, item, message }]`, `name` the CONTRACT_CODES name: verbDuplicate (one word declared twice),
 * verbFormat (a format whose first word is not the verb), verbHostUnknown (an implementedBy key that is no host word),
 * verbCodeUnknown (a code whose item is no codes item, or carries no such name). A code whose item no file declares is
 * the reference machinery's (contract.ref.unresolved), and is left to it.
 */
export function verbProblems(items) {
  const out = [];
  const hosts = hostWords(items);
  const owners = new Map();
  for (const { item, key, verb, rel, pkg } of verbsOf(items)) {
    const at = `${item}.${key}`;
    const say = (name, message) => out.push({ name, rel, item: at, message });
    const word = verb.verb;
    if (owners.has(word)) {
      const o = owners.get(word);
      say('verbDuplicate', `${word}: already declared by ${o.at}${o.pkg ? ` (${o.pkg})` : ''}${pkg ? `, and again by ${pkg}` : ''}: a verb has one owner`);
    } else owners.set(word, { at, pkg });
    const first = String(verb.format ?? '').split(' ')[0];
    if (first !== word) say('verbFormat', `format ${JSON.stringify(verb.format)} starts with ${JSON.stringify(first)}, not the verb ${word}`);
    for (const host of Object.keys(verb.implementedBy ?? {})) {
      if (!hosts.includes(host)) say('verbHostUnknown', `implementedBy names ${host}, which is no word of ${HOSTS_ITEM} (${hosts.join(', ')})`);
    }
    for (const { ref } of verb.codes ?? []) {
      const [head, name] = String(ref).split('.');
      const target = items.get(head);
      if (!target) continue;
      if (target.item?.kind !== 'codes') say('verbCodeUnknown', `code ${ref}: ${head} is a ${target.item?.kind} item, no codes item`);
      else if (!Object.hasOwn(target.item.codes ?? {}, name)) say('verbCodeUnknown', `code ${ref}: ${head} carries no code named ${name}`);
    }
  }
  return out;
}
