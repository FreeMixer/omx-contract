#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
/**
 * omx-contract — the declarations as data, validated and rendered (omx-contract spec §3.4).
 *
 *   omx-contract validate [--data <dir>]                       schema + semantic checks
 *   omx-contract fmt [--check] [--data <dir>]                  the one formatting
 *   omx-contract render --target c|ts|json --out <dir> [--check] [--data <dir> | --sheet <fixture>]
 *   omx-contract semver <previous tag> | --from-dir <data dir> --from-version <x.y.z>
 *
 * Exit 0 is a pass, 1 a failure naming what failed, 2 a usage or environment error (never a pass).
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadData, packageVersion, resolveData } from '../lib/data.mjs';
import { formatDoc } from '../lib/fmt.mjs';
import { classify, refusal } from '../lib/semver.mjs';
import { validateData } from '../lib/validate.mjs';
import { renderC, renderSheetC } from '../render/c.mjs';
import { renderJson } from '../render/json.mjs';
import { renderTs } from '../render/ts.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

class Usage extends Error {}

function opt(argv, name) {
  const i = argv.indexOf(name);
  if (i < 0) return undefined;
  if (i + 1 >= argv.length || argv[i + 1].startsWith('--')) throw new Usage(`${name} needs a value`);
  return argv[i + 1];
}

function load(argv) {
  const dir = resolve(opt(argv, '--data') ?? join(ROOT, 'data'));
  if (!existsSync(dir)) throw new Usage(`no data directory ${dir}`);
  return loadData(dir);
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
  const problems = validateData(data);
  for (const p of problems) console.error(`${p.file}: ${p.item}: ${p.rule}: ${p.message}`);
  if (problems.length) return 1;
  console.log(`omx-contract validate: ${data.items.size} items in ${data.files.length} files, valid`);
  return 0;
}

function cmdFmt(argv) {
  const dir = resolve(opt(argv, '--data') ?? join(ROOT, 'data'));
  const data = load(argv);
  const check = argv.includes('--check');
  let bad = 0;
  for (const f of data.files) {
    const want = formatDoc(f.doc);
    if (want === f.text) continue;
    if (check) { console.error(`omx-contract fmt --check: ${f.rel} is not in the one formatting`); bad++; } else writeFileSync(join(dir, '..', f.rel), want);
  }
  if (bad) return 1;
  console.log(`omx-contract fmt${check ? ' --check' : ''}: ${data.files.length} files formatted`);
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
  if (target === 'c') return renderC(resolved);
  if (target === 'ts') return renderTs(resolved);
  if (target === 'json') return renderJson(resolved, packageVersion(ROOT));
  throw new Usage(`unknown target ${target} (c, ts, json)`);
}

function cmdRender(argv) {
  const target = opt(argv, '--target');
  const out = opt(argv, '--out');
  if (!target || !out) throw new Usage('render needs --target <c|ts|json> and --out <dir>');
  const files = renderTarget(target, argv);
  const dir = resolve(out);
  if (argv.includes('--check')) {
    const bad = [];
    for (const f of files) {
      const p = join(dir, f.path);
      if (!existsSync(p)) bad.push(`${f.path} is missing`);
      else if (readFileSync(p, 'utf8') !== f.text) bad.push(`${f.path} differs`);
    }
    const scope = target === 'c' ? 'omxcontract' : '';
    const named = new Set(files.map((f) => f.path));
    for (const rel of filesUnder(join(dir, scope))) if (!named.has(join(scope, rel))) bad.push(`${join(scope, rel)} is extra`);
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

/** The data of a git tag, as `{ rel: text }`. */
function dataAtTag(tag) {
  const git = (...a) => execFileSync('git', ['-C', ROOT, ...a], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  try { git('rev-parse', '--verify', `${tag}^{commit}`); } catch { throw new Usage(`no tag ${tag} in ${ROOT}`); }
  const texts = {};
  for (const rel of git('ls-tree', '-r', '--name-only', tag, '--', 'data').split('\n').filter((p) => p.endsWith('.json'))) texts[rel] = git('show', `${tag}:${rel}`);
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

const USAGE = `usage: omx-contract validate [--data <dir>]
       omx-contract fmt [--check] [--data <dir>]
       omx-contract render --target c|ts|json --out <dir> [--check] [--data <dir> | --sheet <fixture.json>]
       omx-contract semver <previous tag> | --from-dir <data dir> --from-version <x.y.z> [--version <x.y.z>]`;

export function main(argv) {
  const cmds = { validate: cmdValidate, fmt: cmdFmt, render: cmdRender, semver: cmdSemver };
  try {
    const cmd = cmds[argv[0]];
    if (!cmd) throw new Usage(argv[0] ? `unknown command ${argv[0]}` : 'no command');
    return cmd(argv);
  } catch (e) {
    if (e instanceof Usage) { console.error(`omx-contract: ${e.message}\n${USAGE}`); return 2; }
    console.error(`omx-contract: ${e.message}`);
    return 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = main(process.argv.slice(2));
