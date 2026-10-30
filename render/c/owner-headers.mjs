// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
/**
 * The C headers an owner declares in its own file's `render.c` (docs/render.md, schema $defs/renderHeader): each
 * framed by the words the file states (header, guard, project, banner, brief, includes) and spelled by its sections:
 * numbers (every sheet, `<prefix><FIELD>`), codes (every codes item, `<prefix><NAME>`), scalars (the numbers spelled
 * OMX_<macro>, as omx_contract_limits.h spells them) and limits (every section of omx_contract_limits.h). A header
 * reads the items of its own file, or with `scope: package` every item of its package. The tool names no item and no
 * project here.
 */

const constCase = (s) => String(s).replace(/([a-z0-9])([A-Z])/g, '$1_$2').toUpperCase();

/** A glob of the schema's renderGlob: a name, `pre*`, `*post` or `*mid*`. */
export function globMatch(glob, name) {
  const lead = glob.startsWith('*');
  const trail = glob.endsWith('*');
  const core = glob.replace(/^\*/, '').replace(/\*$/, '');
  if (lead && trail) return name.includes(core);
  if (lead) return name.endsWith(core);
  if (trail) return name.startsWith(core);
  return name === core;
}

/** The licence block every source file of the project opens with: the SPDX line, the GPL notice, the copyright line, a blank line. */
const licence = (project) => `/* SPDX-License-Identifier: GPL-3.0-or-later */
/*
 * This file is part of ${project}.
 *
 * ${project} is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * ${project} is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with ${project}.  If not, see <http://www.gnu.org/licenses/>.
 *
 * Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
 */

`;

/** A define with its prose as a trailing member comment; a one-line prose only, or the rest would be read as C. */
function documented(define, prose, where) {
  if (prose === undefined) return define;
  if (typeof prose !== 'string' || prose.length === 0 || /[\n\r]/.test(prose)) throw new Error(`render.c: ${where} is no one-line description`);
  return `${define}  ///< ${prose}`;
}

/** The C names a header gives item `r` through its numbers and codes sections: `[[name, field]]`. */
export function ownerNames(spec, r) {
  if (r.kind === 'sheet' && spec.numbers) return Object.keys(r.value).filter((f) => !(spec.numbers.omit ?? []).some((g) => globMatch(g, f))).map((f) => [`${spec.numbers.prefix}${constCase(f)}`, f]);
  if (r.kind === 'codes' && spec.codes) return Object.keys(r.value).map((n) => [`${spec.codes.prefix}${constCase(n)}`, n]);
  return [];
}

/** numbers: every sheet of the items, a field per define, `u` for a non-negative integer and `f` for a level. */
function numbersSection(spec, items, header) {
  const lines = [];
  for (const r of items.filter((x) => x.kind === 'sheet')) {
    for (const [name, field] of ownerNames({ numbers: spec }, r)) {
      const v = r.value[field];
      if (typeof v !== 'number' || !Number.isFinite(v)) throw new Error(`${header}: ${r.name}.${field} is not a finite number`);
      const level = spec.levels !== undefined && globMatch(spec.levels, field);
      const literal = level ? `${Number.isInteger(v) ? `${v}.0` : v}f` : Number.isInteger(v) && v >= 0 ? `${v}u` : null;
      if (literal === null) throw new Error(`${header}: ${r.name}.${field} is neither a level (${spec.levels}) nor a non-negative integer`);
      lines.push(documented(`#define ${name} ${literal}`, r.docs?.[field], `${r.name}.docs.${field}`));
    }
  }
  if (!lines.length) throw new Error(`${header}: a numbers section with no sheet to render`);
  return `/** ${spec.comment} */\n${lines.join('\n')}`;
}

/** codes: every codes item, a code per define. */
function codesSection(spec, items, header) {
  const lines = items.filter((x) => x.kind === 'codes').flatMap((r) =>
    ownerNames({ codes: spec }, r).map(([name, n]) => documented(`#define ${name} ${JSON.stringify(r.value[n].code)}`, r.value[n].doc, `${r.name}.${n}.doc`)));
  if (!lines.length) throw new Error(`${header}: a codes section with no codes item to render`);
  return `/** ${spec.comment} */\n${lines.join('\n')}`;
}

/**
 * One header over `items` (a Map of resolved items, with its kernels). `blocks` renders the OMX_ spellings:
 * `scalars(items)` the declared-scalars block, `limits(items)` every section of omx_contract_limits.h.
 */
export function renderOwnerHeader(spec, items, blocks) {
  const list = [...items.values()];
  const sections = [];
  if (spec.numbers) sections.push(numbersSection(spec.numbers, list, spec.header));
  if (spec.codes) sections.push(codesSection(spec.codes, list, spec.header));
  if (spec.scalars) sections.push(`/** ${spec.scalars.comment} */\n${blocks.scalars(items)}`);
  if (spec.limits) sections.push(`${spec.limits.comment ? `/** ${spec.limits.comment} */\n` : ''}${blocks.limits(items)}`);
  const includes = (spec.includes ?? []).map((h) => `#include <${h}>\n`).join('');
  return `${licence(spec.project)}#ifndef ${spec.guard}
#define ${spec.guard}
/*
 * GENERATED: DO NOT EDIT BY HAND.
${spec.banner.map((l) => ` * ${l}`).join('\n')}
 */

/** @file
 * @brief ${spec.brief} */
${includes ? `\n${includes}` : ''}
${sections.join('\n\n')}

#endif /* ${spec.guard} */
`;
}
