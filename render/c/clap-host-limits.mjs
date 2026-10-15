// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
/**
 * `clap_host_limits.h`: the header the CLAP core (omx-clap-core) builds against and installs, rendered from
 * `HOSTED_STAGE_LIMITS` and `HOSTING_CODES`. It is the library's API documentation too, so every define carries
 * the prose declared beside its number or code as a trailing `///<` comment; the frame below is the only prose
 * here. The fields named `worker*` are the LV2 adapter's and are not rendered.
 */

const constCase = (s) => String(s).replace(/([a-z0-9])([A-Z])/g, '$1_$2').toUpperCase();

/** The licence block every source file of omx-clap-core opens with: the SPDX line, the GPL notice, the copyright line, a blank line. */
const LICENCE = `/* SPDX-License-Identifier: GPL-3.0-or-later */
/*
 * This file is part of omx-clap-host.
 *
 * omx-clap-host is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * omx-clap-host is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with omx-clap-host.  If not, see <http://www.gnu.org/licenses/>.
 *
 * Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
 */

`;

const isLevel = (field) => field.endsWith('Dbfs');

/** A define with its prose as a trailing member comment; a one-line prose only, or the rest would be read as C. */
function documented(define, prose, where) {
  if (prose === undefined) return define;
  if (typeof prose !== 'string' || prose.length === 0 || /[\n\r]/.test(prose)) throw new Error(`clap-host-limits: ${where} is no one-line description`);
  return `${define}  ///< ${prose}`;
}

/** The header of the resolved items `HOSTED_STAGE_LIMITS` and `HOSTING_CODES`. */
export function renderClapHostLimits(stage, codes) {
  const numbers = Object.entries(stage.value)
    .filter(([field]) => !field.startsWith('worker'))
    .map(([field, v]) => {
      if (typeof v !== 'number' || !Number.isFinite(v)) throw new Error(`clap-host-limits: HOSTED_STAGE_LIMITS.${field} is not a finite number`);
      const literal = isLevel(field) ? `${Number.isInteger(v) ? `${v}.0` : v}f` : Number.isInteger(v) && v >= 0 ? `${v}u` : null;
      if (literal === null) throw new Error(`clap-host-limits: HOSTED_STAGE_LIMITS.${field} is neither a level (Dbfs) nor a non-negative integer`);
      return documented(`#define CLAP_HOST_${constCase(field)} ${literal}`, stage.docs?.[field], `HOSTED_STAGE_LIMITS.docs.${field}`);
    });
  const refusals = Object.entries(codes.value)
    .map(([name, c]) => documented(`#define CLAP_HOST_CODE_${constCase(name)} ${JSON.stringify(c.code)}`, c.doc, `HOSTING_CODES.${name}.doc`));
  return `${LICENCE}#ifndef CLAP_HOST_LIMITS_H
#define CLAP_HOST_LIMITS_H
/*
 * GENERATED — DO NOT EDIT BY HAND.
 * Rendered by \`omx-contract render --target c\` from FreeMixer/omx-contract's HOSTED_STAGE_LIMITS and
 * HOSTING_CODES. The rendered file is kept in this repository so the library builds on its own; the numbers
 * and codes are changed where they are declared and the file is re-rendered, never edited here.
 */

/** @file
 * @brief The limits and refusal codes of the hosting code. */

#include <stddef.h>

/** the stage and the host: every number the core reads */
${numbers.join('\n')}

/** the refusals the core returns, as the hosting codes the console's verdicts use */
${refusals.join('\n')}

#endif /* CLAP_HOST_LIMITS_H */
`;
}
