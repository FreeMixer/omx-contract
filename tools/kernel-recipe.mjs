#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
/*
 * kernel-recipe.mjs — `make completeness`: every kernel under data/kernels/, the released ones
 * included, has every artifact recipes/kernel.recipe.json lists and keeps every law it declares.
 * Each checker reads the real files of the tree; none reads a list of kernels.
 *
 *   node tools/kernel-recipe.mjs [--root <tree>] [<kernel> ...]
 *
 * Exit 0 every kernel is complete; 1 a gap, each named with its kernel, its artifact and the wizard
 * step that writes it; 2 usage.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { loadData, packageVersion, resolveData } from '../lib/data.mjs';
import { formatDoc } from '../lib/fmt.mjs';
import { validateData } from '../lib/validate.mjs';
import { renderC } from '../render/c.mjs';
import { renderJson } from '../render/json.mjs';
import { renderTs } from '../render/ts.mjs';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const RECIPE = 'recipes/kernel.recipe.json';

export const loadRecipe = (root = ROOT) => JSON.parse(readFileSync(join(root, RECIPE), 'utf8'));

/** `{kernel}`-style placeholders filled from `facts`; an unknown one stays as written. */
export const fill = (s, facts) => s.replace(/\{(\w+)\}/g, (m, k) => (facts[k] !== undefined ? String(facts[k]) : m));

/** The kernels of a tree: the files under the recipe's kernelsDir. */
export function kernelNames(root = ROOT, recipe = loadRecipe(root)) {
  const dir = join(root, recipe.tree.kernelsDir);
  return existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)).sort() : [];
}

/** The layer a path belongs to, through the artifacts' `paths` (any kernel); undefined outside the recipe. */
export function layerOfPath(recipe, path) {
  for (const a of recipe.artifacts) {
    for (const p of a.paths ?? []) {
      const re = new RegExp(`^${p.replace(/[.+^$()|[\]\\]/g, '\\$&').replace(/\{kernel\}/g, '[a-z][a-z0-9]*').replace(/\*\*/g, '.+').replace(/(?<!\.)\*/g, '[^/]*')}$`);
      if (re.test(path)) return a.layer;
    }
  }
  return undefined;
}

const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
const ok = (detail) => ({ ok: true, detail });
const missing = (detail) => ({ ok: false, detail });

/** What every checker of one tree shares: the data, loaded and resolved once. */
export function treeFacts(root = ROOT) {
  const facts = { root };
  try {
    facts.data = loadData(join(root, 'data'));
    facts.problems = validateData(facts.data);
    if (!facts.problems.some((p) => p.rule === 'schema' || p.rule === 'reference')) facts.resolved = resolveData(facts.data);
  } catch (e) {
    facts.error = e.message;
  }
  return facts;
}

/** The items a kernel's file declares, by name, in file order. */
const kernelItems = (facts, recipe, kernel) => {
  const rel = fill(recipe.tree.kernelFile, { kernel });
  const f = facts.data?.files.find((x) => x.rel === rel);
  return f ? Object.keys(f.doc).filter((k) => k !== '$schema') : undefined;
};

/** The answers of a kernel, or the reason there are none. */
export function readAnswers(root, recipe, kernel) {
  const rel = fill(recipe.tree.answers, { kernel });
  if (!existsSync(join(root, rel))) return { error: `${rel} is missing` };
  try {
    return { rel, answers: readJson(join(root, rel)) };
  } catch (e) {
    return { error: `${rel}: not JSON: ${e.message}` };
  }
}

/** The problems of one answers file, as sentences; empty is valid. */
export function answersProblems(answers, kernel) {
  const bad = [];
  if (answers.kernel !== kernel) bad.push(`kernel is '${answers.kernel}', the file is ${kernel}'s`);
  if (!/^\d+\.\d+\.\d+$/.test(answers.since ?? '')) bad.push(`since '${answers.since}' is not x.y.z`);
  if (typeof answers.engine?.repo !== 'string' || !/^[0-9a-f]{40}$/.test(answers.engine?.commit ?? '')) bad.push('engine needs repo and a 40-hex commit');
  if (!Array.isArray(answers.items) || !answers.items.length) bad.push('items is empty');
  const seen = new Set();
  for (const [i, it] of (answers.items ?? []).entries()) {
    const at = `items[${i}]${it?.name ? ` ${it.name}` : ''}`;
    if (!/^[A-Z][A-Z0-9_]*$/.test(it?.name ?? '')) bad.push(`${at}: name`);
    if (seen.has(it?.name)) bad.push(`${at}: answered twice`);
    seen.add(it?.name);
    const s = it?.source;
    if (typeof s?.path !== 'string' || !s.path || (typeof s.export !== 'string') === (typeof s.define !== 'string')) {
      bad.push(`${at}: source must name a path and one of export or define`);
    }
    if (!('value' in (it ?? {}))) bad.push(`${at}: no value read from the source`);
    if (typeof it?.doc !== 'string' || !it.doc.trim()) bad.push(`${at}: no doc`);
  }
  return bad;
}

/** Each checker: `(facts, recipe, kernel, args) => { ok, detail }`, reading the real files. */
export const CHECKERS = {
  answersValid(facts, recipe, kernel) {
    const a = readAnswers(facts.root, recipe, kernel);
    if (a.error) return missing(a.error);
    const bad = answersProblems(a.answers, kernel);
    return bad.length ? missing(`${a.rel}: ${bad.join('; ')}`) : ok(`${a.answers.items.length} items cited at ${a.answers.engine.repo} ${a.answers.engine.commit.slice(0, 12)}`);
  },

  kernelFile(facts, recipe, kernel) {
    const rel = fill(recipe.tree.kernelFile, { kernel });
    if (facts.error) return missing(facts.error);
    const f = facts.data.files.find((x) => x.rel === rel);
    if (!f) return missing(`${rel} is missing`);
    const bad = facts.problems.filter((p) => p.file === rel).map((p) => `${p.item}: ${p.rule}: ${p.message}`);
    if (formatDoc(f.doc) !== f.text) bad.push('not in the one formatting (omx-contract fmt)');
    if (!kernelItems(facts, recipe, kernel).length) bad.push('declares no item');
    return bad.length ? missing(`${rel}: ${bad.join('; ')}`) : ok(`${kernelItems(facts, recipe, kernel).length} items, valid, formatted`);
  },

  valuesCited(facts, recipe, kernel) {
    const a = readAnswers(facts.root, recipe, kernel);
    if (a.error) return missing(a.error);
    const names = kernelItems(facts, recipe, kernel);
    if (!names) return missing(`${fill(recipe.tree.kernelFile, { kernel })} is missing`);
    if (!facts.resolved) return missing('the data does not resolve');
    const cited = new Map((a.answers.items ?? []).map((it) => [it.name, it]));
    const bad = [];
    for (const n of names) {
      const it = cited.get(n);
      if (!it) bad.push(`${n} has no citation`);
      else if (!isDeepStrictEqual(facts.resolved.get(n).value, it.value)) {
        bad.push(`${n} resolves to ${JSON.stringify(facts.resolved.get(n).value)}, the engine's ${it.source.path} ${it.source.export ?? it.source.define} is ${JSON.stringify(it.value)}`);
      } else {
        const r = facts.resolved.get(n);
        if ((r.unit ?? null) !== (it.unit ?? null) && r.kind !== 'travels') bad.push(`${n}: unit ${JSON.stringify(r.unit)} in the kernel file, ${JSON.stringify(it.unit)} in the answers`);
        if (!isDeepStrictEqual(r.c ?? null, it.c ?? null)) bad.push(`${n}: c ${JSON.stringify(r.c)} in the kernel file, ${JSON.stringify(it.c)} in the answers`);
      }
    }
    for (const n of cited.keys()) if (!names.includes(n)) bad.push(`${n} is answered but not in the kernel file`);
    return bad.length ? missing(`${a.rel}: ${bad.join('; ')}`) : ok(`${names.length} values equal their engine source`);
  },

  roundTrip(facts, recipe, kernel) {
    const names = kernelItems(facts, recipe, kernel);
    if (!names) return missing(`${fill(recipe.tree.kernelFile, { kernel })} is missing`);
    if (!facts.resolved) return missing('the data does not resolve');
    const back = JSON.parse(renderJson(facts.resolved, packageVersion(facts.root))[0].text).items;
    const bad = names.filter((n) => !back[n] || !isDeepStrictEqual(back[n].value, facts.resolved.get(n).value)).map((n) => `${n} does not read back from the json render`);
    const rel = fill(recipe.tree.kernelFile, { kernel });
    const f = facts.data.files.find((x) => x.rel === rel);
    if (formatDoc(JSON.parse(formatDoc(f.doc))) !== formatDoc(f.doc)) bad.push('the formatting is not a fixed point');
    return bad.length ? missing(bad.join('; ')) : ok(`${names.length} items read back`);
  },

  rendered(facts, recipe, kernel, args) {
    if (!facts.resolved) return missing('the data does not resolve');
    const bad = [];
    const outs = {
      c: () => renderC(facts.resolved),
      json: () => renderJson(facts.resolved, packageVersion(facts.root)),
      ts: () => renderTs(facts.resolved),
    };
    for (const [target, dir] of Object.entries(args.targets)) {
      for (const f of outs[target]()) {
        const p = join(facts.root, dir, f.path);
        if (!existsSync(p)) bad.push(`${dir}/${f.path} is missing`);
        else if (readFileSync(p, 'utf8') !== f.text) bad.push(`${dir}/${f.path} is stale (omx-contract render --target ${target} --out ${dir})`);
      }
    }
    const json = join(facts.root, args.targets.json, 'omx-contract.json');
    if (existsSync(json)) {
      const items = readJson(json).items ?? {};
      for (const n of kernelItems(facts, recipe, kernel) ?? []) if (!items[n]) bad.push(`${args.targets.json}/omx-contract.json lacks ${n}`);
    }
    return bad.length ? missing(bad.join('; ')) : ok('c, json and ts renders fresh');
  },

  changelogNames(facts, recipe, kernel) {
    const file = join(facts.root, recipe.tree.changelog);
    if (!existsSync(file)) return missing(`${recipe.tree.changelog} is missing`);
    const a = readAnswers(facts.root, recipe, kernel);
    const since = a.answers?.since;
    if (since === recipe.tree.firstRelease) return ok(`shipped in the first release, ${since}, whose entry covers it`);
    const sections = new Map();
    let cur;
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      const h = /^## \[?([^\]\s]+)\]?/.exec(line);
      if (h) {
        cur = h[1];
        sections.set(cur, '');
      } else if (cur) sections.set(cur, `${sections.get(cur)}${line}\n`);
    }
    const re = new RegExp(`^- The ${kernel} kernel\\b`, 'm');
    for (const s of ['Unreleased', since]) if (s && re.test(sections.get(s) ?? '')) return ok(`named under ## ${s}`);
    return missing(`${recipe.tree.changelog} has no '- The ${kernel} kernel' line under ## Unreleased${since ? ` or ## ${since}` : ''}`);
  },

  ownItemsOnly(facts, recipe, kernel) {
    if (facts.error) return missing(facts.error);
    const rel = fill(recipe.tree.kernelFile, { kernel });
    const f = facts.data.files.find((x) => x.rel === rel);
    if (!f) return missing(`${rel} is missing`);
    const bad = Object.entries(f.doc).filter(([k, v]) => k !== '$schema' && v?.kind === 'plugin').map(([k]) => `${k} is a plugin item`);
    return bad.length ? missing(`${rel}: ${bad.join('; ')}`) : ok('own items only');
  },
};

/** Every artifact and law of the recipe over one kernel: `[{ kind, id, step, ok, detail }]`. */
export function checkKernel(facts, recipe, kernel) {
  const out = [];
  for (const [kind, list] of [['artifact', recipe.artifacts], ['law', recipe.laws]]) {
    for (const e of list) {
      if (e.when !== 'always' && !recipe.rules[e.when]) throw new Error(`${e.id}: unknown rule ${e.when}`);
      const fn = CHECKERS[e.checker.fn];
      if (!fn) {
        out.push({ kind, id: e.id, step: e.step, ok: false, detail: `the recipe names checker ${e.checker.fn}, which tools/kernel-recipe.mjs does not have` });
        continue;
      }
      let r;
      try {
        r = fn(facts, recipe, kernel, e.checker);
      } catch (err) {
        r = missing(`checker ${e.checker.fn} threw: ${err.message}`);
      }
      out.push({ kind, id: e.id, step: e.step, ...r });
    }
  }
  return out;
}

/** The gaps of a report, one sentence each. */
export const gapLines = (kernel, report) => report.filter((r) => !r.ok).map((r) => `${kernel}: ${r.kind} ${r.id} (wizard step '${r.step}'): ${r.detail}`);

/** The completeness verdict over the kernels of a tree: `{ ok, lines, gaps }`. */
export function completeness(root = ROOT, kernels) {
  const recipe = loadRecipe(root);
  const facts = treeFacts(root);
  const names = kernels?.length ? kernels : kernelNames(root, recipe);
  const lines = [];
  const gaps = [];
  if (!names.length) gaps.push(`no kernel under ${recipe.tree.kernelsDir}: a check over nothing proves nothing`);
  for (const k of names) {
    const report = checkKernel(facts, recipe, k);
    const g = gapLines(k, report);
    gaps.push(...g);
    lines.push(`${g.length ? 'FAIL' : 'PASS'} ${k}: ${report.length - g.length}/${report.length}`);
  }
  return { ok: gaps.length === 0, lines, gaps };
}

function main(argv) {
  const i = argv.indexOf('--root');
  const root = resolve(i >= 0 ? argv[i + 1] : ROOT);
  const kernels = argv.filter((a, k) => !a.startsWith('--') && argv[k - 1] !== '--root');
  const v = completeness(root, kernels);
  for (const l of v.lines) console.log(l);
  for (const g of v.gaps) console.log(`  GAP ${g}`);
  console.log(v.ok ? `kernel completeness: every kernel has every artifact of ${RECIPE}` : `kernel completeness: ${v.gaps.length} gap(s)`);
  process.exit(v.ok ? 0 : 1);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv.slice(2));
