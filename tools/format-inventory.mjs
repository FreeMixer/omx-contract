#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
/*
 * format-inventory.mjs — the inventory of the LV2 and CLAP vocabularies as installed: every term an LV2
 * specification bundle defines and every identifier the CLAP headers declare, with the versions they were read from.
 * The inventory is what data/formats/ maps, term by term (docs/data-layout.md); it is written by this tool and never
 * edited by hand.
 *
 *   node tools/format-inventory.mjs [--lv2 <lv2 dir>] [--clap <include dir>] [--out <dir>] [--check]
 *
 * --lv2 defaults to pkg-config's lv2dir (else /usr/lib64/lv2), --clap to pkg-config's includedir for clap (else
 * /usr/include). The LV2 bundles are read through serdi (Turtle to N-Triples); the CLAP headers are read as text.
 * --check compares with inventory/lv2.json and inventory/clap.json instead of writing them.
 *
 * Exit 0 written or equal; 1 a difference (each named) or a source that cannot be read; 2 usage.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const INVENTORY = join(ROOT, 'inventory');

const RDF = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#';
const RDFS = 'http://www.w3.org/2000/01/rdf-schema#';
const OWL = 'http://www.w3.org/2002/07/owl#';
const LV2 = 'http://lv2plug.in/ns/lv2core#';

/** The bundles under an LV2 directory that are no LV2 specification: the RDF, OWL and XSD schemas LV2 ships. */
export const NOT_SPECS = ['schemas.lv2'];

/** The prefixes a type is written with in the inventory, so a reader sees `owl:ObjectProperty`, not the IRI. */
const CURIES = [
  ['rdf', RDF], ['rdfs', RDFS], ['owl', OWL], ['lv2', LV2], ['xsd', 'http://www.w3.org/2001/XMLSchema#'],
  ['atom', 'http://lv2plug.in/ns/ext/atom#'], ['ui', 'http://lv2plug.in/ns/extensions/ui#'],
  ['units', 'http://lv2plug.in/ns/extensions/units#'], ['opts', 'http://lv2plug.in/ns/ext/options#'],
  ['patch', 'http://lv2plug.in/ns/ext/patch#'], ['pg', 'http://lv2plug.in/ns/ext/port-groups#'],
  ['state', 'http://lv2plug.in/ns/ext/state#'], ['time', 'http://lv2plug.in/ns/ext/time#'],
  ['midi', 'http://lv2plug.in/ns/ext/midi#'], ['ev', 'http://lv2plug.in/ns/ext/event#'],
  ['param', 'http://lv2plug.in/ns/ext/parameters#'], ['pprops', 'http://lv2plug.in/ns/ext/port-props#'],
  ['pset', 'http://lv2plug.in/ns/ext/presets#'], ['bufsz', 'http://lv2plug.in/ns/ext/buf-size#'],
  ['log', 'http://lv2plug.in/ns/ext/log#'], ['morph', 'http://lv2plug.in/ns/ext/morph#'],
  ['rsz', 'http://lv2plug.in/ns/ext/resize-port#'], ['urid', 'http://lv2plug.in/ns/ext/urid#'],
  ['work', 'http://lv2plug.in/ns/ext/worker#'], ['dman', 'http://lv2plug.in/ns/ext/dynmanifest#'],
];
export const curie = (iri) => {
  for (const [p, ns] of CURIES) if (iri.startsWith(ns) && /^[A-Za-z0-9_-]+$/.test(iri.slice(ns.length))) return `${p}:${iri.slice(ns.length)}`;
  return iri;
};

/** N-Triples text as `[[s, p, o]]`: IRIs bare, a blank node `_:x`, a literal as `"text"` with its datatype dropped. */
export function parseNTriples(text) {
  const out = [];
  const term = /\s*(<[^>]*>|_:\S+|"(?:[^"\\]|\\.)*"(?:\^\^<[^>]*>|@[A-Za-z-]+)?)/y;
  for (const line of text.split('\n')) {
    if (!line.trim() || line.startsWith('#')) continue;
    term.lastIndex = 0;
    const t = [];
    for (let i = 0; i < 3; i++) {
      const m = term.exec(line);
      if (!m) throw new Error(`not N-Triples: ${line}`);
      const v = m[1];
      t.push(v.startsWith('<') ? v.slice(1, -1) : v.startsWith('"') ? v.replace(/(\^\^<[^>]*>|@[A-Za-z-]+)$/, '') : v);
    }
    out.push(t);
  }
  return out;
}

const turtle = (file) => parseNTriples(execFileSync('serdi', ['-q', '-i', 'turtle', '-o', 'ntriples', file], { encoding: 'utf8', maxBuffer: 1 << 26 }));

/**
 * One LV2 bundle's specification: `{ bundle, uri, version, terms: [{ uri, name, types, deprecated?, label? }] }`, the
 * terms every IRI a triple of its non-manifest files is about that lies in the specification's namespace (its URI
 * then `#` or `/`) and the specification's own URI (a feature or an extension-data URI in data-access,
 * instance-access and others; named after its bundle, state.lv2, so it never meets a term of its own such as state:state), sorted by IRI. Version is lv2:minorVersion.lv2:microVersion of the manifest.
 * Null for a bundle that names no specification: an installed LV2 plugin, not a specification (a host's lv2 dir
 * holds both). Ambiguous (more than one) is still an error.
 */
export function readLv2Bundle(dir) {
  const manifest = turtle(join(dir, 'manifest.ttl'));
  const specs = manifest.filter(([, p, o]) => p === `${RDF}type` && o === `${LV2}Specification`).map(([s]) => s);
  if (specs.length > 1) throw new Error(`${dir}: the manifest names ${specs.length} specifications`);
  if (specs.length === 0) return null;
  const uri = specs[0];
  const num = (p) => manifest.find(([s, q]) => s === uri && q === `${LV2}${p}`)?.[2]?.replace(/"/g, '');
  const triples = readdirSync(dir).filter((f) => f.endsWith('.ttl') && f !== 'manifest.ttl').sort().flatMap((f) => turtle(join(dir, f)));
  const inNs = (iri) => iri === uri || ((iri.startsWith(`${uri}#`) || iri.startsWith(`${uri}/`)) && iri.length > uri.length + 1);
  const bundle = dir.replace(/^.*\//, '');
  const terms = new Map();
  for (const [s, p, o] of triples) {
    if (!inNs(s)) continue;
    if (!terms.has(s)) terms.set(s, { uri: s, name: s === uri ? bundle : s.slice(uri.length + 1), types: new Set() });
    const t = terms.get(s);
    if (p === `${RDF}type`) t.types.add(curie(o));
    if (p === `${OWL}deprecated` && /^"(true|1)"$/.test(o)) t.deprecated = true;
    if (p === `${RDFS}label` && !t.label) t.label = JSON.parse(o);
  }
  const specDeprecated = terms.get(uri)?.deprecated === true;
  const sorted = [...terms.values()].sort((a, b) => (a.uri < b.uri ? -1 : 1)).map((t) => {
    const o = { uri: t.uri, name: t.name, types: [...t.types].sort() };
    if (t.deprecated) o.deprecated = true;
    if (t.label) o.label = t.label;
    return o;
  });
  const out = { bundle, uri, version: `${num('minorVersion')}.${num('microVersion')}` };
  if (specDeprecated) out.deprecated = true;
  out.terms = sorted;
  return out;
}

/** Every LV2 specification under `dir`, by bundle name (the bundle's name less `.lv2`). */
export function readLv2(dir) {
  const bundles = readdirSync(dir).filter((b) => b.endsWith('.lv2') && !NOT_SPECS.includes(b) && existsSync(join(dir, b, 'manifest.ttl'))).sort();
  if (!bundles.length) throw new Error(`no LV2 bundle under ${dir}`);
  const specs = {};
  for (const b of bundles) {
    const spec = readLv2Bundle(join(dir, b));
    if (spec) specs[b.replace(/\.lv2$/, '')] = spec;
  }
  return specs;
}

const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');

/** The plumbing macros of the CLAP headers: compiler and ABI spellings, include guards, function-like macros. */
const isPlumbing = (name) => /^(CLAP_(ABI|EXPORT|CONSTEXPR|NODISCARD|CPLUSPLUS|HAS_CXX\d*|VERSION_INIT))$|_H$/.test(name);

/**
 * One CLAP header's identifiers: `[{ name, group, value }]`, in the order the header declares them. A string
 * constant (an extension, factory, port-type or window-API id, a plugin feature) is `group: "string"` with its
 * text; a member of an enum is the enum's tag, or `enum` when it has none, with its value as written; a typed
 * constant is `const` and a numeric #define `define`, each with its value as written.
 */
export function readClapHeader(text) {
  const src = stripComments(text);
  const out = [];
  const seen = new Set();
  const add = (o) => { if (!seen.has(o.name) && !isPlumbing(o.name)) { seen.add(o.name); out.push(o); } };
  const rx = new RegExp([
    /const\s+(?:CLAP_CONSTEXPR\s+)?char\s+(CLAP_\w+)\s*\[\]\s*=\s*"([^"]*)"\s*;/.source,
    /#\s*define\s+(CLAP_\w+)[ \t]+"([^"]*)"/.source,
    /#\s*define\s+(CLAP_\w+)[ \t]+(\d+)\b/.source,
    /static\s+const\s+CLAP_CONSTEXPR\s+(?!char\b)\w+\s+(CLAP_\w+)\s*=\s*([^;]+);/.source,
    /\benum\s*(\w*)\s*\{([^}]*)\}/.source,
  ].join('|'), 'g');
  for (const m of src.matchAll(rx)) {
    if (m[1]) add({ name: m[1], group: 'string', value: m[2] });
    else if (m[3]) add({ name: m[3], group: 'string', value: m[4] });
    else if (m[5]) add({ name: m[5], group: 'define', value: m[6] });
    else if (m[7]) add({ name: m[7], group: 'const', value: m[8].trim().replace(/\s+/g, ' ') });
    else {
      const group = m[9] || 'enum';
      for (const part of m[10].split(',')) {
        const e = /^\s*(CLAP_\w+)\s*(?:=\s*([\s\S]+?))?\s*$/.exec(part);
        if (e) add({ name: e[1], group, value: e[2] === undefined ? null : e[2].replace(/\s+/g, ' ') });
      }
    }
  }
  return out;
}

/** Every header under `<include>/clap`, its private/ ones left out: `{ version, headers: { <path>: [...] } }`. */
export function readClap(include) {
  const root = join(include, 'clap');
  if (!existsSync(root)) throw new Error(`no ${root}`);
  const files = [];
  const walk = (d) => {
    for (const f of readdirSync(d).sort()) {
      const p = join(d, f);
      if (statSync(p).isDirectory()) { if (f !== 'private') walk(p); } else if (f.endsWith('.h')) files.push(p);
    }
  };
  walk(root);
  const headers = {};
  for (const p of files.sort((a, b) => (relative(root, a) < relative(root, b) ? -1 : 1))) {
    const ids = readClapHeader(readFileSync(p, 'utf8'));
    if (ids.length) headers[relative(root, p).replace(/\.h$/, '')] = ids;
  }
  const v = Object.fromEntries((headers.version ?? []).filter((i) => i.group === 'define').map((i) => [i.name, i.value]));
  if (!v.CLAP_VERSION_MAJOR) throw new Error(`${root}/version.h: no CLAP_VERSION_MAJOR`);
  return { version: `${v.CLAP_VERSION_MAJOR}.${v.CLAP_VERSION_MINOR}.${v.CLAP_VERSION_REVISION}`, headers };
}

const pkgVar = (pkg, v) => {
  try { return execFileSync('pkg-config', [`--variable=${v}`, pkg], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() || undefined; } catch { return undefined; }
};
const pkgVersion = (pkg) => {
  try { return execFileSync('pkg-config', ['--modversion', pkg], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() || undefined; } catch { return undefined; }
};
export const defaultLv2Dir = () => pkgVar('lv2', 'lv2dir') ?? '/usr/lib64/lv2';
export const defaultClapInclude = () => pkgVar('clap', 'includedir') ?? '/usr/include';

/** The two inventory documents of the sources named: `{ 'lv2.json': text, 'clap.json': text }`. */
export function inventories({ lv2 = defaultLv2Dir(), clap = defaultClapInclude() } = {}) {
  const l = { format: 'lv2', from: 'the LV2 specification bundles (lv2 package)', version: pkgVersion('lv2') ?? 'unknown', specs: readLv2(lv2) };
  const c = { format: 'clap', from: 'the CLAP headers (clap package), private/ left out', ...readClap(clap) };
  return { 'lv2.json': `${JSON.stringify(l, null, 2)}\n`, 'clap.json': `${JSON.stringify(c, null, 2)}\n` };
}

function main(argv) {
  const opts = {};
  let out = INVENTORY;
  let check = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--check') check = true;
    else if (['--lv2', '--clap', '--out'].includes(a) && argv[i + 1]) {
      const v = argv[++i];
      if (a === '--out') out = v; else opts[a.slice(2)] = v;
    } else { process.stderr.write(`format-inventory: unknown argument ${a}\n`); return 2; }
  }
  let docs;
  try { docs = inventories(opts); } catch (e) { process.stderr.write(`format-inventory: ${e.message}\n`); return 1; }
  if (!check) {
    mkdirSync(out, { recursive: true });
    for (const [f, t] of Object.entries(docs)) writeFileSync(join(out, f), t);
    process.stdout.write(`format-inventory: wrote ${Object.keys(docs).map((f) => join(out, f)).join(', ')}\n`);
    return 0;
  }
  let bad = 0;
  for (const [f, t] of Object.entries(docs)) {
    const p = join(out, f);
    const have = existsSync(p) ? readFileSync(p, 'utf8') : '';
    if (have !== t) { bad = 1; process.stderr.write(`format-inventory: ${p} is not the inventory of the installed sources: run node tools/format-inventory.mjs\n`); }
  }
  if (!bad) process.stdout.write('format-inventory: the committed inventory is the installed sources\'\n');
  return bad;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = main(process.argv.slice(2));
