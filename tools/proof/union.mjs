#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
/**
 * The union proof of a paired move (spec 7.2): this tree's data/ installed as omx-contract and each owner's data
 * directory installed as its package, read back through the reader, render c, json and ts as the renders a tag of
 * this repository committed. A difference is listed by file and line; a file that differs in its GENERATED banner only
 * is told apart, as the one difference a move may carry (an owner's own words for its header, spec 7.2).
 *
 *   node tools/proof/union.mjs --against <tag> [--owner <package>=<version>=<data dir>]... [--perturb] [--allow-banner] [--units]
 *
 * Where a json or ts file differs, its units are compared too: the json items with their `rel` aside and its kernels
 * index, the ts exports with their `@see` aside, in any order (a definition that moved to a file of its own changes
 * its place and its path only); --units takes a file whose every unit is the tag's as a pass.
 * --perturb adds one arm per owner file: one number of it moved, read again, and some render must move with it; and
 * the file must have left this tree's data/, so no second copy can hide there.
 * Exit 0 every render is the tag's (banner lines aside with --allow-banner) and every arm moved; 1 a difference or an
 * arm that moved nothing; 2 usage or environment.
 */
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SCHEMA_MAJOR, loadContractDir } from '../../lib/contract-dir.mjs';
import { resolveData } from '../../lib/data.mjs';
import { renderC } from '../../render/c.mjs';
import { renderJson } from '../../render/json.mjs';
import { renderTs } from '../../render/ts.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const INSTALL = join(ROOT, 'tools/install-contract-dir.sh');
const TARGETS = [['c', 'include'], ['json', 'share/omx-contract'], ['ts', 'test/golden/ts']];

class Usage extends Error {}

const git = (...a) => execFileSync('git', ['-C', ROOT, ...a], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

/** The committed renders of `tag`: `{ <target>: Map<path under its dir, text> }`. */
function goldens(tag) {
  try { git('rev-parse', '--verify', `${tag}^{commit}`); } catch { throw new Usage(`no tag ${tag} in ${ROOT}`); }
  const out = {};
  for (const [t, dir] of TARGETS) {
    out[t] = new Map();
    for (const p of git('ls-tree', '-r', '--name-only', tag, '--', dir).split('\n').filter(Boolean)) out[t].set(p.slice(dir.length + 1), git('show', `${tag}:${p}`));
  }
  return out;
}

/** Every file under `dir`, relative to it. */
function filesUnder(dir) {
  const out = [];
  const walk = (d) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) walk(p); else out.push(relative(dir, p)); } };
  walk(dir);
  return out.sort();
}

/** A contract directory of this tree's data/ (as omx-contract at `version`) and every owner. */
function install(root, version, owners) {
  const sh = (...a) => execFileSync('sh', [INSTALL, ...a], { stdio: ['ignore', 'ignore', 'inherit'] });
  sh('-x', 'codes.json', 'omx-contract', version, String(SCHEMA_MAJOR), join(ROOT, 'data'), root, 'data');
  for (const o of owners) sh(o.pkg, o.version, String(SCHEMA_MAJOR), o.dir, root, 'data');
}

/** The three renders of a contract directory, `{ <target>: Map<path, text> }`. */
function renders(root, version) {
  const r = resolveData(loadContractDir({ dir: root }));
  return {
    c: new Map(renderC(r).map((f) => [f.path, f.text])),
    json: new Map(renderJson(r, version).map((f) => [f.path, f.text])),
    ts: new Map(renderTs(r).map((f) => [f.path, f.text])),
  };
}

/** `text` split at its GENERATED banner comment: `{ banner: [lines], rest: text without them }`. */
function splitBanner(text) {
  const lines = text.split('\n');
  const start = lines.findIndex((l) => /GENERATED/.test(l));
  if (start < 0) return { banner: [], rest: text };
  let end = start;
  while (end < lines.length && !/\*\//.test(lines[end])) end++;
  return { banner: lines.slice(start, end + 1), rest: [...lines.slice(0, start), ...lines.slice(end + 1)].join('\n') };
}

/**
 * The differences of `got` from `want`: `[{ target, path, kind, want?, got?, lines? }]`. `banner`: the two differ in
 * their GENERATED banner only (both banners given); `differs`: elsewhere too, the differing lines `{ n, want, got }`.
 */
function compare(want, got) {
  const out = [];
  for (const [t] of TARGETS) {
    for (const [p, w] of want[t]) {
      const g = got[t].get(p);
      if (g === undefined) { out.push({ target: t, path: p, kind: 'missing' }); continue; }
      if (g === w) continue;
      const W = splitBanner(w);
      const G = splitBanner(g);
      if (W.rest === G.rest) { out.push({ target: t, path: p, kind: 'banner', want: W.banner, got: G.banner }); continue; }
      const wl = w.split('\n');
      const gl = g.split('\n');
      const lines = [];
      for (let i = 0; i < Math.max(wl.length, gl.length) && lines.length < 40; i++) if (wl[i] !== gl[i]) lines.push({ n: i + 1, want: wl[i], got: gl[i] });
      out.push({ target: t, path: p, kind: 'differs', lines });
    }
    for (const p of got[t].keys()) if (!want[t].has(p)) out.push({ target: t, path: p, kind: 'extra' });
  }
  return out;
}

/** The TS units of a module: `Map<export name, its block with the @see line left out>`. */
function tsUnits(text) {
  const out = new Map();
  for (const block of text.split(/\n(?=\/\*\*\n)/)) {
    const m = /^export (?:declare )?(?:const|function) ([A-Za-z_$][\w$]*)/m.exec(block);
    if (m) out.set(m[1], block.replace(/^ \* @see .*\n/m, '').trimEnd());
  }
  return out;
}

/**
 * Unit by unit, where a file differs: the json render's items with their `rel` left out and its kernels index, the ts
 * modules' exports with their `@see` left out, in any order. `{ target, path, same, differing, missing, extra }`.
 */
function compareUnits(want, got, differences) {
  const out = [];
  for (const d of differences.filter((x) => x.kind === 'differs' && x.target !== 'c')) {
    let W;
    let G;
    if (d.target === 'json') {
      const units = (t) => {
        const doc = JSON.parse(t);
        const m = new Map(Object.entries(doc.items).map(([n, { rel, ...r }]) => [n, JSON.stringify(r)]));
        for (const [k, v] of Object.entries(doc.kernels ?? {})) m.set(`kernels.${k}`, JSON.stringify(v));
        return m;
      };
      W = units(want.json.get(d.path));
      G = units(got.json.get(d.path));
    } else {
      W = tsUnits(want.ts.get(d.path));
      G = tsUnits(got.ts.get(d.path));
    }
    const differing = [...W.keys()].filter((k) => G.has(k) && G.get(k) !== W.get(k));
    out.push({ target: d.target, path: d.path, same: [...W.keys()].filter((k) => G.get(k) === W.get(k)).length, differing,
      missing: [...W.keys()].filter((k) => !G.has(k)), extra: [...G.keys()].filter((k) => !W.has(k)) });
  }
  return out;
}

/** Move the first number of an item of `doc` (its file keys aside) by one; returns where, or undefined. */
function perturb(doc) {
  const skip = new Set(['$schema', 'requires', 'source', 'render']);
  let at;
  const walk = (v, path) => {
    if (at !== undefined || v === null || typeof v !== 'object') return;
    for (const [k, x] of Object.entries(v)) {
      if (at !== undefined) return;
      if (path === '' && skip.has(k)) continue;
      if (k === 'source' || k === 'since') continue;
      if (typeof x === 'number') { v[k] = x + 1; at = `${path}${path ? '.' : ''}${k}`; return; }
      walk(x, `${path}${path ? '.' : ''}${k}`);
    }
  };
  walk(doc, '');
  if (at !== undefined) return at;
  // no number: a set's ids, swapped
  for (const [k, v] of Object.entries(doc)) {
    if (skip.has(k) || !Array.isArray(v?.ids) || v.ids.length < 2) continue;
    [v.ids[0], v.ids[1]] = [v.ids[1], v.ids[0]];
    return `${k}.ids[0..1] swapped`;
  }
  return undefined;
}

export function union({ against, owners, perturbArms = false, allowBanner = false, byUnits = false, log = console.log }) {
  const version = against.replace(/^v/, '');
  const want = goldens(against);
  const scratch = mkdtempSync(join(tmpdir(), 'omx-contract-union-proof-'));
  try {
    install(join(scratch, 'base'), version, owners);
    const base = renders(join(scratch, 'base'), version);
    const differences = compare(want, base);
    for (const d of differences) {
      log(`${d.kind} ${d.target} ${d.path}`);
      if (d.kind === 'banner') { for (const l of d.want) log(`  - ${l}`); for (const l of d.got) log(`  + ${l}`); }
      for (const l of d.lines ?? []) log(`  ${l.n}: - ${l.want ?? ''}\n  ${l.n}: + ${l.got ?? ''}`);
    }
    const units = compareUnits(want, base, differences);
    for (const u of units) {
      log(`units ${u.target} ${u.path}: ${u.same} the same, rel and order aside${u.differing.length ? `; differing ${u.differing.join(' ')}` : ''}${u.missing.length ? `; missing ${u.missing.join(' ')}` : ''}${u.extra.length ? `; extra ${u.extra.join(' ')}` : ''}`);
    }
    const unitsOk = (d) => byUnits && units.some((u) => u.target === d.target && u.path === d.path && !u.differing.length && !u.missing.length && !u.extra.length);
    const fatal = differences.filter((d) => !(allowBanner && d.kind === 'banner') && !unitsOk(d));
    for (const [t] of TARGETS) {
      const bad = differences.filter((d) => d.target === t);
      log(`union ${t}: ${bad.length ? `${bad.length} file(s) differ from ${against}${bad.every((d) => d.kind === 'banner') ? ', in their banner only' : ''}` : `byte-identical to ${against}`}`);
    }
    const arms = [];
    if (perturbArms) {
      for (const o of owners) {
        for (const rel of filesUnder(o.dir).filter((f) => f.endsWith('.json'))) {
          const home = join(ROOT, 'data', rel);
          const copy = join(scratch, `arm-${arms.length}`);
          cpSync(o.dir, join(copy, 'owner'), { recursive: true });
          const p = join(copy, 'owner', rel);
          const doc = JSON.parse(readFileSync(p, 'utf8'));
          const at = perturb(doc);
          writeFileSync(p, `${JSON.stringify(doc, null, 2)}\n`);
          let moved = false;
          let refusal;
          if (at !== undefined) {
            try {
              install(join(copy, 'dir'), version, owners.map((x) => (x === o ? { ...o, dir: join(copy, 'owner') } : x)));
              moved = compare(base, renders(join(copy, 'dir'), version)).length > 0;
            } catch (e) { refusal = e.code ?? e.message; }
          }
          const arm = { pkg: o.pkg, rel, at, moved, refusal, oldHomeGone: !existsSync(home) };
          arms.push(arm);
          log(`arm ${o.pkg} ${rel}${at ? ` ${at}${at.includes('swapped') ? '' : '+1'}` : ' (no number to move)'}: ${moved ? 'the renders move' : refusal ? `REFUSED: ${refusal}` : 'NOTHING MOVED'}; ${arm.oldHomeGone ? 'no copy in data/' : `A COPY STAYS IN data/${rel}`}`);
          rmSync(copy, { recursive: true, force: true });
        }
      }
    }
    const armsBad = arms.filter((a) => a.at !== undefined && (!a.moved || !a.oldHomeGone));
    return { ok: !fatal.length && !armsBad.length, differences, arms };
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

function main(argv) {
  const opt = (name) => { const i = argv.indexOf(name); if (i < 0) return undefined; if (!argv[i + 1] || argv[i + 1].startsWith('--')) throw new Usage(`${name} needs a value`); return argv[i + 1]; };
  const against = opt('--against');
  if (!against) throw new Usage('--against <tag> is required');
  const owners = [];
  argv.forEach((a, i) => {
    if (a !== '--owner') return;
    const m = /^([a-z][a-z0-9-]*)=(\d+\.\d+\.\d+)=(.+)$/.exec(argv[i + 1] ?? '');
    if (!m) throw new Usage(`--owner ${argv[i + 1]} is not <package>=<version>=<data dir>`);
    if (!existsSync(m[3])) throw new Usage(`no directory ${m[3]}`);
    owners.push({ pkg: m[1], version: m[2], dir: resolve(m[3]) });
  });
  const r = union({ against, owners, perturbArms: argv.includes('--perturb'), allowBanner: argv.includes('--allow-banner'), byUnits: argv.includes('--units') });
  console.log(`UNION-JSON ${JSON.stringify({ ok: r.ok, differences: r.differences.map((d) => ({ target: d.target, path: d.path, kind: d.kind })), arms: r.arms.length, armsMoved: r.arms.filter((a) => a.moved).length })}`);
  return r.ok ? 0 : 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.exitCode = main(process.argv.slice(2)); } catch (e) {
    console.error(`union: ${e.message}`);
    process.exitCode = e instanceof Usage ? 2 : 1;
  }
}
