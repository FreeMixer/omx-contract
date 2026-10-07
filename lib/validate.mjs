// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
/**
 * `omx-contract validate`: the schema, then the checks a schema cannot express (spec §3.3): every
 * reference resolves with no cycle; every default inside its travel; every C name the render spells
 * is unique; an item's `c.alias` names no other item. Each failure names file, item and rule.
 */
import { readFileSync } from 'node:fs';
import { posix } from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import { resolveData } from './data.mjs';
import { renderC } from '../render/c.mjs';
import { renderTs } from '../render/ts.mjs';

const SCHEMA = JSON.parse(readFileSync(new URL('../schema/omx-contract.schema.json', import.meta.url), 'utf8'));
let compiled;
/** The compiled schema validator. */
export function schemaValidator() {
  if (!compiled) compiled = new Ajv2020({ allErrors: true, strict: true, strictRequired: false, allowUnionTypes: true }).compile(SCHEMA);
  return compiled;
}

const constCase = (s) => s.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toUpperCase();

/** Every problem of the loaded data: `[{ file, item, rule, message }]`; empty is valid. */
export function validateData(data) {
  const problems = [];
  const say = (file, item, rule, message) => problems.push({ file, item, rule, message });
  const validate = schemaValidator();
  for (const f of data.files) {
    const depth = f.rel.split('/').length - 1;
    const want = posix.join(...Array(depth).fill('..'), 'schema/omx-contract.schema.json');
    if (f.doc.$schema !== want) say(f.rel, '-', 'schema-path', `"$schema" must be "${want}"`);
    if (!validate(f.doc)) {
      for (const e of validate.errors) {
        const item = e.instancePath.split('/')[1] || '-';
        say(f.rel, item, 'schema', `${e.instancePath || '/'} ${e.message}${e.params?.allowedValues ? ` (${e.params.allowedValues.join(', ')})` : ''}`);
      }
    }
  }
  if (problems.length) return problems;

  let resolved;
  try {
    resolved = resolveData(data);
  } catch (e) {
    const name = /^(\w+)/.exec(e.message)?.[1] ?? '-';
    say(data.items.get(name)?.rel ?? '-', name, 'reference', e.message);
    return problems;
  }

  for (const r of resolved.values()) {
    const travels = r.kind === 'travels' ? (r.shape === 'table' ? Object.entries(r.value) : [['', r.value]]) : [];
    for (const [field, t] of travels) {
      const at = field ? `${r.name}.${field}` : r.name;
      for (const k of ['min', 'max', 'step', 'default']) {
        if (t[k] !== undefined && (typeof t[k] !== 'number' || !Number.isFinite(t[k]))) say(r.rel, r.name, 'finite', `${at}.${k} resolves to ${JSON.stringify(t[k])}`);
      }
      if (!(t.min <= t.max)) say(r.rel, r.name, 'travel-order', `${at}: min ${t.min} > max ${t.max}`);
      if (t.step !== undefined && t.step < 0) say(r.rel, r.name, 'step', `${at}: step ${t.step} < 0`);
      if (t.default !== undefined && !(t.default >= t.min && t.default <= t.max)) say(r.rel, r.name, 'default-inside', `${at}: default ${t.default} outside [${t.min}, ${t.max}]`);
      for (const [kind, v] of Object.entries(t.byKind ?? {})) {
        if (!(v >= t.min && v <= t.max)) say(r.rel, r.name, 'default-inside', `${at}.byKind.${kind}: ${v} outside [${t.min}, ${t.max}]`);
      }
    }
    if (r.c?.alias) {
      const spelled = `${r.c.alias.fact.toUpperCase()}_${constCase(r.c.alias.field)}`;
      if (resolved.has(spelled)) say(r.rel, r.name, 'alias', `c.alias spells ${spelled}, which is another item`);
      if (r.shape !== 'travel') say(r.rel, r.name, 'alias', 'c.alias is for a single travel');
    }
    if (typeof r.doc !== 'string' || !r.doc.trim()) say(r.rel, r.name, 'doc', 'every item carries its doc');
  }

  for (const [target, files] of [['c', () => renderC(resolved)], ['ts', () => renderTs(resolved)]]) {
    let out;
    try {
      out = files();
    } catch (e) {
      say('-', '-', `render-${target}`, e.message);
      continue;
    }
    if (target !== 'c') continue;
    for (const f of out) {
      const seen = new Map();
      for (const m of f.text.matchAll(/^#define (\w+)/gm)) {
        if (seen.has(m[1])) say('-', m[1], 'c-name-unique', `${f.path} defines ${m[1]} twice`);
        seen.set(m[1], true);
      }
    }
  }
  return problems;
}
