#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
/*
 * omx-new-kernel.mjs — `omx new kernel`, the kernel recipe's wizard (recipes/kernel.recipe.json).
 *
 *   node tools/omx-new-kernel.mjs --questions
 *       the questions, read off the recipe
 *   node tools/omx-new-kernel.mjs --import --kernel <k> --since <x.y.z> --engine <checkout> --ref <git ref>
 *       [--names A,B,...] [--unit NAME=<unit>] [--set NAME[.path]=<json>] [--c NAME=<json>] [--from NAME=<path>:<export|define>]
 *       [--doc NAME=<text>] (the doc, for a value whose engine declaration shares its comment with the one above it)
 *       the IMPORTER: reads each item where the engine declares it at <ref> and writes recipes/answers/<k>.json.
 *       A TypeScript export is read by EVALUATING its module (tools/engine-ts-hook.mjs), so a spread, a
 *       reference or a derivation gives the value the engine computes; a C #define is read when it is
 *       one plain number. No value is typed here. When data/kernels/<k>.json exists, the names, units,
 *       references, derivations and `c` blocks are read from it, so a released kernel is cited without
 *       being rewritten. When the kernel is already answered it keeps its `since`, and a name it did
 *       not answer before is an item added by the release --since names, which it carries as its own.
 *   node tools/omx-new-kernel.mjs --verify --engine <checkout> [<answers file> ...]
 *       reads every cited value again at its answers' commit and compares (all answers by default)
 *   node tools/omx-new-kernel.mjs --answers recipes/answers/<k>.json
 *       writes the kernel file from the answers (a released file keeps its items as written and gains
 *       the answered items it lacks), the committed renders and the CHANGELOG line (for a released
 *       kernel, the line of the items added to it), runs the completeness check over the kernel and
 *       prints the commit plan, one commit per layer of the recipe.
 *
 * Exit 0 done; 1 a refusal, named; 2 usage. Needs node >= 22.18 for --import (type stripping).
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { register } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadData, packageVersion, resolveData } from '../lib/data.mjs';
import { formatDoc } from '../lib/fmt.mjs';
import { renderC } from '../render/c.mjs';
import { renderJson } from '../render/json.mjs';
import { renderTs } from '../render/ts.mjs';
import { ROOT, answersProblems, completeness, fill, itemSince, layerOfPath, loadRecipe, readAnswers } from './kernel-recipe.mjs';

class Refusal extends Error {}
const refuse = (m) => { throw new Refusal(m); };
const plain = (v) => JSON.parse(JSON.stringify(v));

/** The engine value as JSON data; refused when JSON cannot carry it unchanged (a function, a non-finite number, an undefined member). */
export function asData(name, v) {
  const walk = (x, at) => {
    if (typeof x === 'number' && !Number.isFinite(x)) refuse(`${name}${at}: ${x} is not a finite number`);
    if (x === undefined || typeof x === 'function' || typeof x === 'symbol' || typeof x === 'bigint') refuse(`${name}${at}: a ${typeof x} is not data`);
    if (x !== null && typeof x === 'object') for (const [k, y] of Object.entries(x)) walk(y, `${at}.${k}`);
  };
  walk(v, '');
  return plain(v);
}
const isObj = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);
const isTravel = (v) => isObj(v) && typeof v.min === 'number' && typeof v.max === 'number';

/** `--k v` options, repeatable ones as arrays. */
export function parseArgs(argv) {
  const o = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) { o._.push(a); continue; }
    const k = a.slice(2);
    const flag = ['questions', 'import', 'verify'].includes(k);
    const v = flag ? true : argv[++i];
    if (v === undefined) refuse(`--${k} needs a value`);
    if (['unit', 'set', 'c', 'from', 'doc'].includes(k)) (o[k] ??= []).push(v);
    else o[k] = v;
  }
  return o;
}

/** `NAME=value` pairs as a map; `json` parses the value. */
const pairs = (list = [], json = false) => new Map(list.map((p) => {
  const i = p.indexOf('=');
  if (i < 1) refuse(`'${p}' is not NAME=value`);
  const v = p.slice(i + 1);
  try { return [p.slice(0, i), json ? JSON.parse(v) : v]; } catch { return refuse(`'${p}': the value is not JSON`); }
}));

// ---------------------------------------------------------------- reading the engine

/** Every file under `dir` whose name passes `keep`, relative to `base`. */
function walk(dir, base, keep, out = []) {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, base, keep, out);
    else if (keep(e)) out.push(relative(base, p));
  }
  return out;
}

/** The engine's sources at a commit, extracted from the checkout: `{ tree, commit, cleanup }`. */
export function extractEngine(checkout, ref, dirs) {
  const commit = execFileSync('git', ['-C', checkout, 'rev-parse', '--verify', `${ref}^{commit}`], { encoding: 'utf8' }).trim();
  const present = dirs.filter((d) => { try { execFileSync('git', ['-C', checkout, 'cat-file', '-e', `${commit}:${d}`], { stdio: 'ignore' }); return true; } catch { return false; } });
  if (!present.length) refuse(`${ref} has none of ${dirs.join(', ')}`);
  const tree = mkdtempSync(join(tmpdir(), 'omx-new-kernel-'));
  const tar = execFileSync('git', ['-C', checkout, 'archive', '--format=tar', commit, ...present], { maxBuffer: 1 << 30 });
  execFileSync('tar', ['-x', '-C', tree], { input: tar });
  writeFileSync(join(tree, '.engine-checkout'), `${checkout}\n`);
  return { tree, commit, cleanup: () => rmSync(tree, { recursive: true, force: true }) };
}

/** Where the engine declares `name`: `{ path, export }` or `{ path, define }`; refused when nowhere or twice. */
export function findSource(tree, dirs, name) {
  const hits = [];
  const exp = new RegExp(`^export const ${name}\\b`, 'm');
  const def = new RegExp(`^#define ${name}\\s`, 'm');
  for (const d of dirs) {
    for (const rel of walk(join(tree, d), tree, (f) => (f.endsWith('.ts') && !/\.(test|fake|d)\.ts$/.test(f)) || f.endsWith('.h'))) {
      const text = readFileSync(join(tree, rel), 'utf8');
      if (rel.endsWith('.ts') && exp.test(text)) hits.push({ path: rel, export: name });
      if (rel.endsWith('.h') && def.test(text)) hits.push({ path: rel, define: name });
    }
  }
  if (!hits.length) refuse(`${name}: the engine declares no export const or #define of that name`);
  if (hits.length > 1) refuse(`${name}: declared in ${hits.map((h) => h.path).join(' and ')}; name the one with --from`);
  return hits[0];
}

/** The doc comment above the declaration, as one paragraph. */
export function docAt(text, source) {
  const at = text.search(source.export ? new RegExp(`\\nexport const ${source.export}\\b`) : new RegExp(`\\n#define ${source.define}\\s`));
  if (at < 0) return undefined;
  const m = /\/\*\*?((?:(?!\*\/)[\s\S])*)\*\/\s*$/.exec(text.slice(0, at));
  if (!m) return undefined;
  return m[1].split('\n').map((l) => l.replace(/^\s*\*+ ?/, '')).join(' ').replace(/\{@link ([^}]+)\}/g, '$1').replace(/\s+/g, ' ').trim() || undefined;
}

/** A C #define's value, when it is one plain number (an `f` suffix allowed); refused otherwise. */
export function defineValue(text, name) {
  const m = new RegExp(`^#define ${name}[ \\t]+(.+?)[ \\t]*(?:/[*/].*)?$`, 'm').exec(text);
  const n = /^\(?(-?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?)[fFuUlL]*\)?$/.exec(m?.[1] ?? '');
  if (!n) refuse(`${name}: '${m?.[1]}' is not one plain number; cite the TypeScript export that holds it`);
  return Number(n[1]);
}

let hooked = false;
/** Evaluate the engine module `rel` of `tree` and return its exports. */
async function evaluate(tree, rel) {
  if (!hooked) {
    register(pathToFileURL(join(ROOT, 'tools', 'engine-ts-hook.mjs')).href);
    hooked = true;
  }
  return import(pathToFileURL(join(tree, rel)).href);
}

/** The released kernel file's own facts per item: unit, references and derivations, c. */
function keptFacts(root, recipe, kernel) {
  const p = join(root, fill(recipe.tree.kernelFile, { kernel }));
  if (!existsSync(p)) return undefined;
  const doc = JSON.parse(readFileSync(p, 'utf8'));
  const out = new Map();
  for (const [name, it] of Object.entries(doc)) {
    if (name === '$schema') continue;
    const set = {};
    const scan = (v, path) => {
      if (Array.isArray(v)) return v.forEach((x, i) => scan(x, path ? `${path}.${i}` : `${i}`));
      if (!isObj(v)) return undefined;
      if ('ref' in v || 'derive' in v) { set[path] = v; return undefined; }
      for (const [k, x] of Object.entries(v)) scan(x, path ? `${path}.${k}` : k);
      return undefined;
    };
    scan(it.kind === 'scalar' || it.kind === 'sheet' ? it.value : it.kind === 'list' ? it.values : it.fields ?? it.travel, '');
    out.set(name, { kind: it.kind, doc: it.doc, unit: it.unit, set: Object.keys(set).length ? set : undefined, c: it.c });
  }
  return out;
}

/** One cited value, read at the extracted engine: `{ text, value }`. */
async function readSource(eng, ref, name, source) {
  if (!existsSync(join(eng.tree, source.path))) refuse(`${name}: ${source.path} is not in ${ref}`);
  const text = readFileSync(join(eng.tree, source.path), 'utf8');
  if (source.define) return { text, value: defineValue(text, source.define) };
  const mod = await evaluate(eng.tree, source.path);
  if (!(source.export in mod)) refuse(`${name}: ${source.path} exports no ${source.export}`);
  return { text, value: asData(name, mod[source.export]), raw: mod[source.export] };
}

/**
 * Read every answered value again at the answers' own commit and compare: the completeness check
 * holds the kernel file to the answers, this holds the answers to the engine. Returns the
 * differences, one sentence each; empty is a match.
 */
export async function verifyAnswers(answers, checkout, root = ROOT) {
  const recipe = loadRecipe(root);
  const eng = extractEngine(resolve(checkout), answers.engine.commit, recipe.engine.archive);
  try {
    const bad = [];
    for (const it of answers.items) {
      if (it.source.origin) continue; // no engine source to read again
      const { value } = await readSource(eng, answers.engine.commit, it.name, it.source);
      if (JSON.stringify(value) !== JSON.stringify(it.value)) bad.push(`${it.name}: the answers hold ${JSON.stringify(it.value)}, ${it.source.path} gives ${JSON.stringify(value)}`);
    }
    return bad;
  } finally {
    eng.cleanup();
  }
}

/** The importer: every item read from the engine, cited, into the answers. */
export async function importKernel(o, root = ROOT) {
  const recipe = loadRecipe(root);
  const kernel = o.kernel ?? refuse('--kernel is required');
  if (!new RegExp(recipe.questions.kernel.pattern).test(kernel)) refuse(`kernel '${kernel}' does not match ${recipe.questions.kernel.pattern}`);
  const since = o.since ?? refuse('--since is required');
  const checkout = resolve(o.engine ?? refuse('--engine <checkout> is required'));
  const ref = o.ref ?? refuse('--ref <git ref> is required');
  const kept = keptFacts(root, recipe, kernel);
  // A kernel already answered keeps its own `since`; an item it did not answer before is added by
  // the release `--since` names, and carries it.
  const prior = readAnswers(root, recipe, kernel).answers;
  const kernelSince = prior?.since ?? since;
  const sinceOf = (name) => {
    const was = prior?.items?.find((it) => it.name === name);
    return was ? itemSince(prior, was) : since;
  };
  const names = o.names ? o.names.split(',') : kept ? [...kept.keys()] : refuse('--names is required for a new kernel');
  const units = pairs(o.unit);
  const sets = pairs(o.set, true);
  const cs = pairs(o.c, true);
  const froms = pairs(o.from);
  const docs = pairs(o.doc);
  const eng = extractEngine(checkout, ref, recipe.engine.archive);
  try {
    const items = [];
    const raws = new Map();
    for (const name of names) {
      let source;
      if (froms.has(name)) {
        const [path, sym] = froms.get(name).split(':');
        if (!path || !sym) refuse(`--from ${name}=${froms.get(name)}: give <path>:<export or define>`);
        source = path.endsWith('.h') ? { path, define: sym } : { path, export: sym };
      } else source = findSource(eng.tree, recipe.engine.archive, name);
      const { text, value, raw } = await readSource(eng, ref, name, source);
      if (raw !== null && typeof raw === 'object') raws.set(name, raw);
      const k = kept?.get(name) ?? {};
      const it = { name, source, value, doc: docs.get(name) ?? docAt(text, source) ?? k.doc ?? refuse(`${name}: ${source.path} has no doc comment above it; write one in the engine`) };
      const unit = units.get(name) ?? k.unit;
      const needsUnit = typeof value !== 'object' || Array.isArray(value);
      if (needsUnit && unit === undefined) refuse(`${name}: a ${Array.isArray(value) ? 'list' : 'scalar'} carries a unit the engine does not declare; give --unit ${name}=<unit>`);
      if (unit !== undefined) it.unit = unit;
      const set = { ...(k.set ?? {}) };
      for (const [key, spec] of sets) {
        const [n, ...path] = key.split('.');
        if (n === name) set[path.join('.')] = spec;
      }
      if (Object.keys(set).length) it.set = set;
      if (cs.has(name) || k.c) it.c = cs.get(name) ?? k.c;
      if (sinceOf(name) !== kernelSince) it.since = sinceOf(name);
      items.push(it);
    }
    // A table whose field IS another imported item (the same object in the engine) refers to it, so
    // each travel is declared once; read off the engine's own object identity, never guessed. A
    // released kernel keeps its file's references.
    if (!kept) {
      for (const it of items) {
        const raw = raws.get(it.name);
        if (!raw || Array.isArray(raw)) continue;
        for (const [field, v] of Object.entries(raw)) {
          const same = [...raws].find(([n, r]) => n !== it.name && r === v);
          if (same && !(field in (it.set ?? {}))) (it.set ??= {})[field] = { ref: same[0] };
        }
      }
    }
    const answers = { kernel, since: kernelSince, engine: { repo: recipe.engine.repo, ref, commit: eng.commit }, items };
    const bad = answersProblems(answers, kernel);
    if (bad.length) refuse(bad.join('; '));
    const rel = fill(recipe.tree.answers, { kernel });
    mkdirSync(dirname(join(root, rel)), { recursive: true });
    writeFileSync(join(root, rel), `${JSON.stringify(answers, null, 2)}\n`);
    return { rel, answers };
  } finally {
    eng.cleanup();
  }
}

// ---------------------------------------------------------------- declaring the kernel

function setAt(value, path, spec) {
  if (path === '') return spec;
  const keys = path.split('.');
  let o = value;
  for (const k of keys.slice(0, -1)) o = o?.[k];
  if (!o || !(keys.at(-1) in o)) refuse(`no ${path} to set`);
  o[keys.at(-1)] = spec;
  return value;
}

/** One answered item as a kernel file item: its kind read off the value's shape. */
export function itemOf(a) {
  const v = plain(a.value);
  let it;
  if (a.kind === 'set') {
    if (!Array.isArray(v)) refuse(`${a.name}: a set's value is its list of ids`);
    it = { kind: 'set', doc: a.doc, ids: v };
    if (a.default !== undefined) it.default = a.default;
    if (a.labels !== undefined) it.labels = a.labels;
  } else if (typeof v === 'number' || typeof v === 'boolean' || typeof v === 'string') it = { kind: 'scalar', doc: a.doc, unit: a.unit, value: v };
  else if (Array.isArray(v)) it = { kind: 'list', doc: a.doc, unit: a.unit, values: v };
  else if (isTravel(v)) it = { kind: 'travels', doc: a.doc, travel: v };
  else if (!isObj(v)) refuse(`${a.name}: ${JSON.stringify(v)} is not a value an item holds`);
  else if (Object.values(v).length && Object.values(v).every(isTravel)) it = { kind: 'travels', doc: a.doc, fields: v };
  else it = { kind: 'sheet', doc: a.doc, value: v };
  for (const [path, spec] of Object.entries(a.set ?? {})) {
    if (path === '' && (it.kind === 'scalar' || it.kind === 'sheet')) it.value = spec;
    else if (it.kind === 'sheet') it.value = setAt(it.value, path, spec);
    else if (it.kind === 'travels') setAt(it.fields ?? it.travel, path, spec);
    else refuse(`${a.name}: cannot set ${path} on a ${it.kind}`);
  }
  if (a.c) it.c = a.c;
  return it;
}

/** The answers' kernel file, in the one formatting. */
export function kernelText(recipe, answers) {
  const depth = fill(recipe.tree.kernelFile, { kernel: answers.kernel }).split('/').length - 1;
  const doc = { $schema: `${'../'.repeat(depth)}schema/omx-contract.schema.json` };
  for (const a of answers.items) doc[a.name] = itemOf(a);
  return formatDoc(doc);
}

/**
 * The CHANGELOG with the kernel's line under ## Unreleased (created above the first release); with
 * `added`, the line for that many items added to a released kernel.
 */
export function changelogWith(text, recipe, answers, { added } = {}) {
  const t = recipe.artifacts.find((a) => a.id === 'changelog').template;
  const line = added ? fill(t.lineAdded, { kernel: answers.kernel, count: added }) : fill(t.line, { kernel: answers.kernel, count: answers.items.length });
  if (text.includes(line)) return text;
  const lines = text.split('\n');
  let at = lines.findIndex((l) => new RegExp(t.after).test(l));
  if (at < 0) {
    const before = lines.findIndex((l) => new RegExp(t.createBefore).test(l));
    lines.splice(before < 0 ? lines.length : before, 0, t.create, '');
    at = before < 0 ? lines.length - 2 : before;
  }
  let end = at + 1;
  while (end < lines.length && !/^## /.test(lines[end])) end++;
  while (end > at + 1 && lines[end - 1] === '') end--;
  lines.splice(end, 0, ...(end === at + 1 ? ['', ...line.split('\n')] : line.split('\n')));
  return lines.join('\n');
}

/** Write every artifact the answers make; returns the written paths. */
export function declare(answersPath, root = ROOT) {
  const recipe = loadRecipe(root);
  const answers = JSON.parse(readFileSync(resolve(answersPath), 'utf8'));
  const bad = answersProblems(answers, answers.kernel);
  if (bad.length) refuse(`${answersPath}: ${bad.join('; ')}`);
  const written = [];
  const kfile = fill(recipe.tree.kernelFile, { kernel: answers.kernel });
  if (existsSync(join(root, kfile))) {
    // a released kernel: its items are kept as written, and the answered items it lacks are appended
    const doc = JSON.parse(readFileSync(join(root, kfile), 'utf8'));
    const all = loadData(join(root, 'data'));
    const fresh = answers.items.filter((a) => !(a.name in doc));
    for (const a of fresh) if (all.items.has(a.name)) refuse(`${a.name} is already declared in ${all.items.get(a.name).rel}`);
    if (fresh.length) {
      for (const a of fresh) doc[a.name] = itemOf(a);
      writeFileSync(join(root, kfile), formatDoc(doc));
      written.push(kfile);
    }
    console.log(`${kfile} exists: kept as written${fresh.length ? `, ${fresh.length} answered items appended` : ''} (the completeness check holds it to the answers)`);
  } else {
    const all = loadData(join(root, 'data'));
    for (const a of answers.items) if (all.items.has(a.name)) refuse(`${a.name} is already declared in ${all.items.get(a.name).rel}`);
    writeFileSync(join(root, kfile), kernelText(recipe, answers));
    written.push(kfile);
  }
  const resolved = resolveData(loadData(join(root, 'data')));
  const art = recipe.artifacts.find((a) => a.id === 'renders').checker.targets;
  const outs = { c: renderC(resolved), json: renderJson(resolved, packageVersion(root)), ts: renderTs(resolved) };
  for (const [target, dir] of Object.entries(art)) {
    for (const f of outs[target]) {
      const p = join(root, dir, f.path);
      if (existsSync(p) && readFileSync(p, 'utf8') === f.text) continue;
      mkdirSync(dirname(p), { recursive: true });
      writeFileSync(p, f.text);
      written.push(join(dir, f.path));
    }
  }
  const cl = join(root, recipe.tree.changelog);
  const before = readFileSync(cl, 'utf8');
  let after = before;
  if (answers.since !== recipe.tree.firstRelease) after = changelogWith(after, recipe, answers);
  const added = answers.items.filter((a) => itemSince(answers, a) !== answers.since).length;
  if (added) after = changelogWith(after, recipe, answers, { added });
  if (after !== before) { writeFileSync(cl, after); written.push(recipe.tree.changelog); }
  return { answers, written };
}

/** The commit plan: the written paths grouped by the recipe's layers, in layer order. */
export function commitPlan(recipe, paths, facts) {
  const by = new Map(recipe.layers.map((l) => [l.id, []]));
  const stray = [];
  for (const p of paths) {
    const l = layerOfPath(recipe, p);
    if (l) by.get(l).push(p);
    else stray.push(p);
  }
  const plan = recipe.layers.filter((l) => by.get(l.id).length).map((l) => ({ layer: l.id, message: fill(l.message, facts), paths: by.get(l.id) }));
  return { plan, stray };
}

async function main(argv) {
  const o = parseArgs(argv);
  const recipe = loadRecipe();
  if (o.questions) {
    for (const [k, q] of Object.entries(recipe.questions)) console.log(`${k} (${q.type}${q.pattern ? `, ${q.pattern}` : ''}): ${q.title}. ${q.description}`);
    return 0;
  }
  if (o.import) {
    const { rel, answers } = await importKernel(o);
    console.log(`${rel}: ${answers.items.length} items read at ${answers.engine.repo} ${answers.engine.commit.slice(0, 12)}`);
    for (const it of answers.items) console.log(`  ${it.name} <- ${it.source.path} ${it.source.export ?? it.source.define}`);
    return 0;
  }
  if (o.verify) {
    let bad = 0;
    for (const f of o._.length ? o._ : readdirSync(join(ROOT, recipe.tree.answersDir)).map((x) => join(ROOT, recipe.tree.answersDir, x))) {
      const a = JSON.parse(readFileSync(f, 'utf8'));
      const diff = await verifyAnswers(a, o.engine ?? refuse('--verify needs --engine <checkout>'));
      bad += diff.length;
      console.log(`${diff.length ? 'FAIL' : 'PASS'} ${a.kernel}: ${a.items.length} values at ${a.engine.commit.slice(0, 12)}${diff.map((d) => `\n  ${d}`).join('')}`);
    }
    return bad ? 1 : 0;
  }
  if (o.answers) {
    const { answers, written } = declare(o.answers);
    const rel = relative(ROOT, resolve(o.answers));
    const { plan, stray } = commitPlan(recipe, [rel, ...written], { kernel: answers.kernel, repo: answers.engine.repo, commit12: answers.engine.commit.slice(0, 12) });
    const v = completeness(ROOT, [answers.kernel]);
    for (const l of v.lines) console.log(l);
    for (const g of v.gaps) console.log(`  GAP ${g}`);
    console.log('commit plan:');
    for (const c of plan) console.log(`  ${c.layer}: ${c.message}\n    ${c.paths.join('\n    ')}`);
    if (stray.length) console.log(`  outside the recipe: ${stray.join(', ')}`);
    return v.ok ? 0 : 1;
  }
  console.error('usage: omx-new-kernel.mjs --questions | --verify --engine <checkout> [files] | --import --kernel <k> --since <x.y.z> --engine <checkout> --ref <ref> [...] | --answers <file>');
  return 2;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then((c) => process.exit(c), (e) => {
    console.error(e instanceof Refusal ? `omx-new-kernel: ${e.message}` : e.stack);
    process.exit(e instanceof Refusal ? 1 : 2);
  });
}
