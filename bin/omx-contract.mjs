#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
/**
 * omx-contract — the declarations as data, validated and rendered.
 *
 *   omx-contract validate [<input>]                            schema + semantic checks
 *   omx-contract fmt [--check] [<input>]                       the one formatting
 *   omx-contract render --target c|ts|json|lv2|py --out <dir> [--check] [<input> [--package <name>] | --sheet <fixture>]
 *   omx-contract semver <previous tag> | --from-dir <data dir> --from-version <x.y.z>
 *   omx-contract links [--check] [--root <tree>] [<input>] [--package <name>] [--at <package>=<tree>]... [--require-impl]
 *
 * <input> is `--data <dir>` (the bundled data/ by default), or a contract directory (docs/contract-dir.md):
 * `--contract-dir <dir>`, or `--installed` ($OMX_CONTRACT_PATH, else pkg-config), each with `--needs
 * <package>@'>= x.y.z'` repeatable. A refusal of the reader prints its CONTRACT_CODES code first on the line, and as
 * JSON on stdout with `--json`.
 *
 * Exit 0 is a pass, 1 a failure naming what failed, 2 a usage or environment error (never a pass).
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ContractRefusal } from '../lib/codes.mjs';
import { contractVersion, loadContractDir } from '../lib/contract-dir.mjs';
import { KERNEL_SECTIONS, TOOL_FILES, isKernelFile, kernelDocOf, loadData, packageVersion, resolveData } from '../lib/data.mjs';
import { checkLinks, linksOf, sourcesOf } from '../lib/links.mjs';
import { formatDoc } from '../lib/fmt.mjs';
import { classify, refusal } from '../lib/semver.mjs';
import { fileProblems, validateData } from '../lib/validate.mjs';
import { renderC, renderSheetC } from '../render/c.mjs';
import { renderFormatsPy } from '../render/formats.mjs';
import { renderLv2 } from '../render/hints.mjs';
import { renderJson } from '../render/json.mjs';
import { renderOwnerTs, renderTs } from '../render/ts.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

class Usage extends Error {}

function opt(argv, name) {
  const i = argv.indexOf(name);
  if (i < 0) return undefined;
  if (i + 1 >= argv.length || argv[i + 1].startsWith('--')) throw new Usage(`${name} needs a value`);
  return argv[i + 1];
}

/** Every value of a repeatable option. */
function opts(argv, name) {
  const out = [];
  argv.forEach((a, i) => {
    if (a !== name) return;
    if (i + 1 >= argv.length || argv[i + 1].startsWith('--')) throw new Usage(`${name} needs a value`);
    out.push(argv[i + 1]);
  });
  return out;
}

/** Whether the input is a contract directory rather than a data directory. */
const fromContractDir = (argv) => argv.includes('--installed') || argv.includes('--contract-dir');

function load(argv) {
  if (fromContractDir(argv)) {
    if (opt(argv, '--data') !== undefined) throw new Usage('--data and a contract directory are two inputs: name one');
    const needs = {};
    for (const n of opts(argv, '--needs')) {
      const m = /^([a-z][a-z0-9-]*)@(.+)$/.exec(n);
      if (!m) throw new Usage(`--needs ${n} is not <package>@'>= x.y.z'`);
      needs[m[1]] = m[2];
    }
    const dir = argv.includes('--installed') ? undefined : resolve(opt(argv, '--contract-dir'));
    return loadContractDir({ dir, needs });
  }
  const dir = resolve(opt(argv, '--data') ?? join(ROOT, 'data'));
  if (!existsSync(dir)) throw new Usage(`no data directory ${dir}`);
  return loadData(dir);
}

/** The tool's own tables at the top of a data directory (data/codes.json), as loaded files. */
function toolFiles(argv) {
  if (fromContractDir(argv)) return [];
  const dir = resolve(opt(argv, '--data') ?? join(ROOT, 'data'));
  return TOOL_FILES.filter((f) => existsSync(join(dir, f))).map((f) => {
    const text = readFileSync(join(dir, f), 'utf8');
    return { rel: relative(join(dir, '..'), join(dir, f)), text, doc: JSON.parse(text) };
  });
}

/** Every file under `dir`, relative to it. */
function filesUnder(dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  const walk = (d) => {
    for (const f of readdirSync(d)) {
      const p = join(d, f);
      if (statSync(p).isDirectory()) walk(p);
      else out.push(relative(dir, p));
    }
  };
  walk(dir);
  return out.sort();
}

function cmdValidate(argv) {
  const data = load(argv);
  const tools = toolFiles(argv);
  const problems = [...validateData(data), ...tools.flatMap(fileProblems)];
  for (const p of problems) console.error(`${p.file}: ${p.item}: ${p.rule}: ${p.message}`);
  if (problems.length) return 1;
  const where = data.packages ? ` from ${data.packages.size} packages of ${data.roots.join(':')}` : '';
  console.log(`omx-contract validate: ${data.items.size} items in ${data.files.length} files${where}, valid${tools.length ? ` (and ${tools.map((f) => f.rel).join(', ')})` : ''}`);
  return 0;
}

function cmdFmt(argv) {
  const check = argv.includes('--check');
  if (fromContractDir(argv) && !check) throw new Usage('fmt writes a tree, never an installed contract directory: add --check');
  const dir = resolve(opt(argv, '--data') ?? join(ROOT, 'data'));
  const data = load(argv);
  const files = [...data.files, ...toolFiles(argv)];
  let bad = 0;
  for (const f of files) {
    const want = formatDoc(f.doc);
    if (want === f.text) continue;
    const name = f.pkg ? `${f.pkg}: ${f.rel}` : f.rel;
    if (check) { console.error(`omx-contract fmt --check: ${name} is not in the one formatting`); bad++; } else writeFileSync(join(dir, '..', f.rel), want);
  }
  if (bad) return 1;
  console.log(`omx-contract fmt${check ? ' --check' : ''}: ${files.length} files formatted`);
  return 0;
}

export function renderTarget(target, argv) {
  const sheet = opt(argv, '--sheet');
  if (sheet) {
    if (target !== 'c') throw new Usage('--sheet renders the c target only');
    return renderSheetC(JSON.parse(readFileSync(resolve(sheet), 'utf8')));
  }
  const data = load(argv);
  const resolved = resolveData(data);
  const pkg = opt(argv, '--package');
  if (pkg !== undefined) {
    // An owner renders its own, framed by its files' render words: from a contract directory that package's files,
    // from a data directory (the owner's tree) every file.
    if (data.packages && !data.packages.has(pkg)) throw new Usage(`no package ${pkg} is installed`);
    const files = data.files.filter((f) => (f.pkg ?? pkg) === pkg);
    if (target === 'c') return renderC(resolved, { pkg });
    if (target === 'ts') return renderOwnerTs(resolved, pkg, files);
    throw new Usage('the json, lv2 and py renders are the whole read, named @openmixer/omx-contract: --package renders c and ts');
  }
  if (target === 'c') return renderC(resolved);
  if (target === 'ts') return renderTs(resolved);
  if (target === 'json') return renderJson(resolved, contractVersion(data, packageVersion(ROOT)));
  if (target === 'lv2') return renderLv2(resolved);
  if (target === 'py') {
    const py = renderFormatsPy(resolved);
    return py === undefined ? [] : [{ path: 'omx_contract.py', text: py }];
  }
  throw new Usage(`unknown target ${target} (c, ts, json, lv2, py)`);
}

function cmdRender(argv) {
  const target = opt(argv, '--target');
  const out = opt(argv, '--out');
  if (!target || !out) throw new Usage('render needs --target <c|ts|json|lv2|py> and --out <dir>');
  const files = renderTarget(target, argv);
  const dir = resolve(out);
  if (argv.includes('--check')) {
    const bad = [];
    for (const f of files) {
      const p = join(dir, f.path);
      if (!existsSync(p)) bad.push(`${f.path} is missing`);
      else if (readFileSync(p, 'utf8') !== f.text) bad.push(`${f.path} differs`);
    }
    // An owner's header sits in its own tree among files the render does not write: only the whole render owns its directory.
    const scope = target === 'c' ? 'omxcontract' : '';
    const named = new Set(files.map((f) => f.path));
    // the json, lv2 and py renders are committed side by side (share/omx-contract/): each knows the others' files
    if (['json', 'lv2', 'py'].includes(target)) for (const t of ['json', 'lv2', 'py']) for (const f of renderTarget(t, argv)) named.add(f.path);
    if (opt(argv, '--package') === undefined) for (const rel of filesUnder(join(dir, scope))) if (!named.has(join(scope, rel))) bad.push(`${join(scope, rel)} is extra`);
    for (const b of bad) console.error(`omx-contract render --check: ${out.replace(/\/$/, '')}/${b}`);
    if (bad.length) return 1;
    console.log(`omx-contract render --target ${target} --check: ${files.length} files byte-identical under ${out}`);
    return 0;
  }
  for (const f of files) {
    mkdirSync(dirname(join(dir, f.path)), { recursive: true });
    writeFileSync(join(dir, f.path), f.text);
  }
  console.log(`omx-contract render --target ${target}: wrote ${files.length} files under ${out}`);
  return 0;
}

/**
 * The data of a git tag, as `{ rel: text }`. A tag released before 2.0.0 wrote its kernel files as flat item maps;
 * each is restated in the kernel-file shape (kernelDocOf, the inverse of the expansion the loader reads), so the
 * comparison is between the items the two releases declare.
 */
function dataAtTag(tag) {
  const git = (...a) => execFileSync('git', ['-C', ROOT, ...a], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  try { git('rev-parse', '--verify', `${tag}^{commit}`); } catch { throw new Usage(`no tag ${tag} in ${ROOT}`); }
  const texts = {};
  const isData = (p) => p.endsWith('.json') && !TOOL_FILES.some((f) => p === `data/${f}`);
  for (const rel of git('ls-tree', '-r', '--name-only', tag, '--', 'data').split('\n').filter(isData)) {
    const text = git('show', `${tag}:${rel}`);
    let doc;
    try { doc = JSON.parse(text); } catch { texts[rel] = text; continue; }
    if (!isKernelFile(rel) || KERNEL_SECTIONS.some((k) => k in doc)) { texts[rel] = text; continue; }
    const { $schema, ...items } = doc;
    texts[rel] = JSON.stringify({ $schema, ...kernelDocOf(rel, Object.entries(items)) });
  }
  return texts;
}

function cmdSemver(argv) {
  const fromDir = opt(argv, '--from-dir');
  let prev;
  let from;
  if (fromDir) {
    from = opt(argv, '--from-version');
    if (!from) throw new Usage('--from-dir needs --from-version');
    prev = loadData(resolve(fromDir));
  } else {
    const tag = argv[1];
    if (!tag || tag.startsWith('--')) throw new Usage('semver needs the previous tag');
    from = tag;
    prev = loadData(null, dataAtTag(tag));
  }
  const to = opt(argv, '--version') ?? packageVersion(ROOT);
  const { level, changes } = classify(resolveData(prev), resolveData(load(argv)));
  for (const c of changes) console.log(`${c.level.toUpperCase()} ${c.item}: ${c.what}`);
  const why = refusal(level, from, to);
  console.log(JSON.stringify({ from: from.replace(/^v/, ''), to, level, changes: changes.length, ok: !why }));
  if (why) { console.error(`omx-contract semver: ${why}`); return 1; }
  return 0;
}

/**
 * `links`: list every item's source links, or with `--check` check them against the owner's tree (lib/links.mjs).
 * A problem prints its CONTRACT_CODES code first; links that lie in a tree not named by `--at` are reported unchecked.
 */
function cmdLinks(argv) {
  const data = load(argv);
  const only = opt(argv, '--package');
  if (only !== undefined && !data.packages) throw new Usage('--package names a package of a contract directory');
  if (only !== undefined && !data.packages.has(only)) throw new Usage(`no package ${only} is installed`);
  if (!argv.includes('--check')) {
    for (const s of sourcesOf(data)) {
      if (only !== undefined && s.pkg !== only) continue;
      for (const l of linksOf(s.source)) console.log(`${s.name}${l.field ? `.${l.field}` : ''} ${l.role} ${l.link}${l.at ? ` at ${l.at}` : ''}`);
    }
    return 0;
  }
  const trees = {};
  for (const a of opts(argv, '--at')) {
    const m = /^([a-z][a-z0-9-]*)=(.+)$/.exec(a);
    if (!m) throw new Usage(`--at ${a} is not <package>=<tree>`);
    trees[m[1]] = resolve(m[2]);
  }
  const root = resolve(opt(argv, '--root') ?? '.');
  if (!existsSync(root)) throw new Usage(`no tree ${root}`);
  const { problems, checked, unchecked, none } = checkLinks(data, { root, trees, requireImpl: argv.includes('--require-impl'), only });
  if (argv.includes('--json')) console.log(JSON.stringify({ problems, checked, unchecked, none }));
  for (const p of problems) console.error(`${p.code} ${p.file}: ${p.item}: ${p.link}: ${p.message}`);
  for (const u of unchecked) console.log(`omx-contract links: unchecked ${u}`);
  console.log(`omx-contract links --check: ${checked} links checked under ${root}, ${problems.length} problems, ${unchecked.length} unchecked, ${none} items with no impl link`);
  return problems.length ? 1 : 0;
}

const USAGE = `usage: omx-contract validate [<input>]
       omx-contract fmt [--check] [<input>]
       omx-contract render --target c|ts|json|lv2|py --out <dir> [--check] [<input> [--package <name>] | --sheet <fixture.json>]
       omx-contract semver <previous tag> | --from-dir <data dir> --from-version <x.y.z> [--version <x.y.z>]
       omx-contract links [--check] [--root <tree>] [<input>] [--package <name>] [--at <package>=<tree>]... [--require-impl] [--json]
  <input>: --data <dir> | --contract-dir <dir> | --installed, a contract directory with [--needs <package>@'>= x.y.z']... [--json]`;

export function main(argv) {
  const cmds = { validate: cmdValidate, fmt: cmdFmt, render: cmdRender, semver: cmdSemver, links: cmdLinks };
  try {
    const cmd = cmds[argv[0]];
    if (!cmd) throw new Usage(argv[0] ? `unknown command ${argv[0]}` : 'no command');
    return cmd(argv);
  } catch (e) {
    if (e instanceof Usage) { console.error(`omx-contract: ${e.message}\n${USAGE}`); return 2; }
    if (e instanceof ContractRefusal) {
      if (argv.includes('--json')) console.log(JSON.stringify(e.toJSON()));
      console.error(e.line());
      return 1;
    }
    console.error(`omx-contract: ${e.message}`);
    return 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = main(process.argv.slice(2));
