// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
/**
 * `omx-contract links`: the `source` links of the definitions, checked against the owner's tree
 * (docs/contract-dir.md). An `impl` link must name a definition that exists once and names the item; a `from` link
 * must define the declared value. Each failure is a CONTRACT_CODES code; nothing here classifies by text.
 */
import { existsSync, readFileSync, statSync } from 'node:fs';
import { isAbsolute, join, normalize } from 'node:path';
import { CONTRACT_CODES } from './codes.mjs';
import { resolveData } from './data.mjs';
import { cNamesOf } from '../render/c.mjs';

const isObj = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);
const list = (v) => (v === undefined ? [] : [v].flat());
const camelOf = (u) => u.toLowerCase().replace(/_([a-z0-9])/g, (_, x) => x.toUpperCase());
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** A link split: `{ path, symbol, tag?, selectors: [{ field } | { key }] }`. */
export function parseLink(link) {
  const m = /^([^#]+)#(?:(enum|struct|union) )?([A-Za-z_][A-Za-z0-9_]*)((?:\.[A-Za-z_][A-Za-z0-9_]*|\[[A-Za-z0-9_.-]+\])*)$/.exec(link);
  if (!m) return undefined;
  const selectors = [...m[4].matchAll(/\.([A-Za-z_][A-Za-z0-9_]*)|\[([A-Za-z0-9_.-]+)\]/g)].map((s) => (s[1] !== undefined ? { field: s[1] } : { key: s[2] }));
  return { path: m[1], tag: m[2], symbol: m[3], selectors };
}

/** The text with every comment blanked to spaces, offsets kept. */
function blankComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, (c) => c.replace(/[^\n]/g, ' '));
}

/** From `open` (the index of an opening brace), the index just past its matching close, or -1. */
function closeOf(text, open) {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}' && --depth === 0) return i + 1;
  }
  return -1;
}

/** From `from`, the index just past the `;` that ends the statement at depth 0 (or the end of the text). */
function statementEnd(text, from) {
  let depth = 0;
  for (let i = from; i < text.length; i++) {
    const ch = text[i];
    if ('{[('.includes(ch)) depth++;
    else if ('}])'.includes(ch)) depth--;
    else if (ch === ';' && depth <= 0) return i + 1;
    else if (ch === '\n' && depth <= 0 && /^\s*(export|const|let|var|#)/.test(text.slice(i + 1, i + 40))) return i;
  }
  return text.length;
}

/**
 * Every definition of `symbol` in `text`, one per place the symbol is defined: `{ kind, at, text }`, `kind` one of
 * define, const, function, enum, struct, union, type, var. A tag (`enum X`) finds only that tag's body.
 */
export function definitions(source, symbol, tag) {
  const text = blankComments(source);
  const S = escapeRe(symbol);
  const found = new Map();
  const add = (kind, at, start, end) => { if (!found.has(at)) found.set(at, { kind, at, text: source.slice(start, end) }); };
  const each = (re, fn) => { for (const m of text.matchAll(re)) fn(m); };
  const symbolAt = (m) => m.index + m[0].search(new RegExp(`\\b${S}\\b`));
  if (tag) {
    each(new RegExp(`\\b${tag}\\s+${S}\\s*\\{`, 'g'), (m) => add(tag, symbolAt(m), m.index, closeOf(text, m.index + m[0].length - 1)));
    return [...found.values()];
  }
  each(new RegExp(`^[ \\t]*#[ \\t]*define[ \\t]+${S}\\b(?:[^\\n]*\\\\\\n)*[^\\n]*`, 'gm'), (m) => add('define', symbolAt(m), m.index, m.index + m[0].length));
  each(new RegExp(`\\b(?:export\\s+)?(?:declare\\s+)?(?:const|let|var)\\s+${S}\\b\\s*(?::[^=;\\n]+)?=`, 'g'), (m) => add('const', symbolAt(m), m.index, statementEnd(text, m.index + m[0].length)));
  each(new RegExp(`\\b(?:export\\s+)?(?:type|interface)\\s+${S}\\b`, 'g'), (m) => {
    const brace = text.indexOf('{', m.index);
    const eq = text.indexOf('=', m.index);
    const end = /interface/.test(m[0]) && brace >= 0 ? closeOf(text, brace) : statementEnd(text, eq >= 0 ? eq : m.index);
    add('type', symbolAt(m), m.index, end);
  });
  each(new RegExp(`\\b(?:export\\s+)?(?:async\\s+)?function\\s*\\*?\\s*${S}\\s*\\(`, 'g'), (m) => {
    const brace = text.indexOf('{', m.index);
    add('function', symbolAt(m), m.index, brace >= 0 ? closeOf(text, brace) : text.length);
  });
  each(new RegExp(`\\b(?:export\\s+)?(?:const\\s+)?enum\\s+${S}\\s*\\{`, 'g'), (m) => add('enum', symbolAt(m), m.index, closeOf(text, m.index + m[0].length - 1)));
  // a C function definition: the name, its parameter list, then a body (a prototype ends with `;` and is no definition)
  each(new RegExp(`^[^\\n#;=(]*?\\b${S}\\s*\\([^;{}]*\\)\\s*\\{`, 'gm'), (m) => add('function', symbolAt(m), m.index, closeOf(text, m.index + m[0].length - 1)));
  // a C object with an initializer: a static table, a constant
  each(new RegExp(`^[^\\n#;(=]*?\\b${S}\\s*(?:\\[[^\\]]*\\]\\s*)*=(?!=)`, 'gm'), (m) => add('var', symbolAt(m), m.index, statementEnd(text, m.index + m[0].length)));
  return [...found.values()].sort((a, b) => a.at - b.at);
}

/** A C or JS literal as a value: a number (with its float32 flag), a string, or a list of them; undefined otherwise. */
function literal(src) {
  let s = src.trim().replace(/;$/, '').trim().replace(/\s+as\s+const$/, '').trim();
  while (/^\(.*\)$/s.test(s)) s = s.slice(1, -1).trim();
  const num = /^([+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)([fFlLuU]*)$/.exec(s);
  if (num) return { value: Number(num[1]), float32: /[fF]/.test(num[2]) };
  const hex = /^(0[xX][0-9a-fA-F]+)[uUlL]*$/.exec(s);
  if (hex) return { value: Number(hex[1]), float32: false };
  const str = /^"((?:[^"\\]|\\.)*)"$|^'((?:[^'\\]|\\.)*)'$/s.exec(s);
  if (str) return { value: (str[1] ?? str[2]).replace(/\\(.)/g, '$1'), float32: false };
  const arr = /^\[([\s\S]*)\]$/.exec(s);
  if (arr) {
    const parts = arr[1].split(',').map((x) => x.trim()).filter((x) => x !== '');
    const vals = parts.map(literal);
    if (vals.every((v) => v && !Array.isArray(v.value))) return { value: vals.map((v) => v.value), float32: vals.some((v) => v.float32) };
  }
  return undefined;
}

/** An enum's enumerators in order, without their common prefix; a last `..._COUNT` sentinel is no enumerator. */
function enumerators(body) {
  const inner = body.slice(body.indexOf('{') + 1, body.lastIndexOf('}'));
  let names = blankComments(inner).split(',').map((x) => x.trim().split(/\s*=/)[0].trim()).filter(Boolean);
  if (names.length > 1 && /_COUNT$/.test(names[names.length - 1])) names = names.slice(0, -1);
  if (names.length > 1) {
    let p = names[0];
    for (const n of names) while (!n.startsWith(p)) p = p.slice(0, -1);
    p = p.slice(0, p.lastIndexOf('_') + 1);
    names = names.map((n) => n.slice(p.length));
  } else if (names.length === 1) names = [names[0].slice(names[0].lastIndexOf('_') + 1)];
  return names;
}

const norm = (s) => String(s).toLowerCase().replace(/[_-]/g, '');

/** The value one definition holds, or undefined when the tool cannot read it. */
function valueOf(def, symbol) {
  if (def.kind === 'define') {
    const rest = def.text.replace(/\\\n/g, ' ').replace(new RegExp(`^[ \\t]*#[ \\t]*define[ \\t]+${escapeRe(symbol)}\\b`), '');
    if (/^\(/.test(rest)) return undefined; // a macro with parameters
    return literal(blankComments(rest));
  }
  if (def.kind === 'const') return literal(def.text.slice(def.text.indexOf('=') + 1));
  if (def.kind === 'enum') return { value: enumerators(def.text), enumerators: true };
  return undefined;
}

/** Whether a read value equals a declared one. */
function equal(got, want) {
  if (got.enumerators) return Array.isArray(want) && want.length === got.value.length && want.every((w, i) => norm(w) === norm(got.value[i]));
  const one = (g, w) => (typeof g === 'number' && typeof w === 'number' ? (got.float32 ? Math.fround(g) === Math.fround(w) : g === w) : g === w);
  if (Array.isArray(got.value)) return Array.isArray(want) && want.length === got.value.length && want.every((w, i) => one(got.value[i], w));
  return one(got.value, want);
}

/** The value at a field path (`max`, `guitar.maxVoices`) of a resolved value, or undefined. */
function at(value, path) {
  let v = value;
  for (const k of path.split('.')) {
    if (!isObj(v) || !(k in v)) return undefined;
    v = v[k];
  }
  return v;
}

/**
 * Whether a definition's text names the item: its name, `OMX_<NAME>` or a name derived from it, its camelCase, or one
 * of `cNames`, the C names the render spells for it (render/c.mjs cNamesOf: a limit table's fields, an alias, a
 * declared scalar's macro, the names an owner's render word gives it).
 */
function namesItem(text, name, cNames = new Set()) {
  const N = escapeRe(name);
  if (new RegExp(`\\b(?:OMX_)?${N}(?:_[A-Z0-9]+)*\\b`).test(text) || new RegExp(`\\b${escapeRe(camelOf(name))}\\b`).test(text)) return true;
  return [...cNames].some((c) => new RegExp(`\\b${escapeRe(c)}\\b`).test(text));
}

/** Every item's source: its own, else its file's. `[{ name, rel, pkg, source }]`, items with neither left out. */
export function sourcesOf(data) {
  const byRel = new Map(data.files.map((f) => [`${f.pkg ?? ''}\u0000${f.rel}`, f]));
  const out = [];
  for (const it of data.items.values()) {
    const file = byRel.get(`${it.pkg ?? ''}\u0000${it.rel}`);
    const source = it.item.source ?? file?.doc.source;
    out.push({ name: it.name, rel: it.rel, pkg: it.pkg, source });
  }
  return out;
}

/**
 * Check every link of the items: `{ problems: [{ code, file, item, link, message }], checked, unchecked, none }`.
 * `root` is the owner's tree; `trees` maps a package named by `at` to its tree; `requireImpl` makes an item with no
 * `impl` a problem; `only` keeps the items of one package.
 */
export function checkLinks(data, { root, trees = {}, requireImpl = false, only } = {}) {
  const resolved = resolveData(data);
  const cNames = cNamesOf(resolved);
  const problems = [];
  let checked = 0;
  const unchecked = [];
  let none = 0;
  const say = (name, file, item, link, message) => problems.push({ code: CONTRACT_CODES[name], file, item, link, message });
  const texts = new Map();
  const read = (base, path) => {
    const p = normalize(join(base, path));
    if (isAbsolute(path) || !p.startsWith(normalize(base))) return undefined;
    if (!texts.has(p)) texts.set(p, existsSync(p) && statSync(p).isFile() ? readFileSync(p, 'utf8') : undefined);
    return texts.get(p);
  };
  for (const s of sourcesOf(data)) {
    if (only !== undefined && s.pkg !== only) continue;
    const impl = list(s.source?.impl);
    if (!impl.length) {
      none++;
      if (requireImpl) say('sourceNone', s.rel, s.name, '-', `${s.name} carries no impl link`);
    }
    if (!s.source) continue;
    const pkgAt = s.source.at?.split('@')[0];
    const base = pkgAt === undefined ? root : trees[pkgAt];
    const from = s.source.from === undefined ? [] : typeof s.source.from === 'string' ? [['', s.source.from]] : Object.entries(s.source.from);
    const links = [...impl.map((l) => ['impl', '', l]), ...from.map(([f, l]) => ['from', f, l])];
    if (base === undefined) { unchecked.push(...links.map(([, , l]) => `${s.name} ${l} (at ${s.source.at})`)); continue; }
    for (const [role, field, link] of links) {
      checked++;
      const L = parseLink(link);
      const text = L && read(base, L.path);
      if (text === undefined) { say('sourceAbsent', s.rel, s.name, link, `${L ? L.path : link} does not exist under ${base}`); continue; }
      const defs = definitions(text, L.symbol, L.tag);
      const sym = L.tag ? `${L.tag} ${L.symbol}` : L.symbol;
      if (!defs.length) { say('sourceSymbolAbsent', s.rel, s.name, link, `${L.path} defines no ${sym}`); continue; }
      if (defs.length > 1) { say('sourceAmbiguous', s.rel, s.name, link, `${L.path} defines ${sym} ${defs.length} times`); continue; }
      const def = defs[0];
      if (role === 'impl') {
        // the twin that holds the value (an impl that is also the item's from link) is the item by VALIDATE's equality
        const twin = from.some(([f, l]) => !f && l === link);
        if (!twin && !namesItem(L.symbol, s.name) && !namesItem(def.text, s.name, cNames.get(s.name))) say('sourceUnread', s.rel, s.name, link, `${sym} in ${L.path} does not name ${s.name}`);
        continue;
      }
      const got = L.selectors.length ? undefined : valueOf(def, L.symbol);
      if (got === undefined) { say('sourceUnevaluable', s.rel, s.name, link, `the value of ${sym}${L.selectors.length ? ' at its selectors' : ''} (a ${def.kind}) is not one the tool reads`); continue; }
      const r = resolved.get(s.name);
      const want = field ? at(r.value, field) : r.value;
      if (!equal(got, want)) say('sourceDiffers', s.rel, s.name, link, `${sym} in ${L.path} holds ${JSON.stringify(got.value)}; ${s.name}${field ? `.${field}` : ''} declares ${JSON.stringify(want)}`);
    }
  }
  return { problems, checked, unchecked, none };
}
