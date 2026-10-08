// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
/*
 * engine-ts-hook.mjs — the module resolver the importer (tools/omx-new-kernel.mjs --import) loads the
 * engine's TypeScript through, so a value is read by EVALUATING the module where the engine declares
 * it (spreads, references and derivations included), never by parsing its text. Node strips the
 * types; this hook supplies what the engine's build would:
 *
 *   ./x.js written for a ./x.ts beside it        -> ./x.ts
 *   @freemixer/<pkg>, @openmixer/<pkg>           -> <tree>/packages/<pkg>/src/index.ts (a workspace package)
 *   any other bare import                         -> resolved from the engine checkout's node_modules
 *
 * The extracted tree a module belongs to is the path above its `packages/`, and the checkout its bare
 * imports resolve in is named by that tree's `.engine-checkout` file, written by the importer; so one
 * process can read several trees of several checkouts.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/** The extracted tree a module belongs to: the directory holding its `packages/`. */
const treeOf = (url) => {
  if (!url?.startsWith('file:')) return undefined;
  const p = fileURLToPath(url);
  const i = p.lastIndexOf('/packages/');
  return i < 0 ? undefined : p.slice(0, i);
};

const ts = (url) => ({ url, shortCircuit: true, format: 'module-typescript' });

export async function resolve(spec, ctx, next) {
  const wsName = /^@(?:freemixer|openmixer)\/([a-z0-9-]+)$/.exec(spec);
  const tree = treeOf(ctx.parentURL);
  // a workspace package when the extracted tree has it; @openmixer/omx-contract is an installed one
  const wsPath = wsName && tree ? join(tree, 'packages', wsName[1], 'src', 'index.ts') : undefined;
  const ws = wsPath && existsSync(wsPath);
  if (ws) return ts(pathToFileURL(wsPath).href);
  if ((spec.startsWith('./') || spec.startsWith('../')) && ctx.parentURL?.startsWith('file:')) {
    const p = fileURLToPath(new URL(spec, ctx.parentURL));
    if (p.endsWith('.ts') && existsSync(p)) return ts(pathToFileURL(p).href);
    const asTs = p.replace(/\.js$/, '.ts');
    if (!existsSync(p) && existsSync(asTs)) return ts(pathToFileURL(asTs).href);
  }
  if (!spec.startsWith('.') && !spec.startsWith('/') && !spec.startsWith('node:') && !spec.startsWith('file:') && !ws) {
    const pin = tree && join(tree, '.engine-checkout');
    if (!pin || !existsSync(pin)) return next(spec, ctx);
    const checkout = readFileSync(pin, 'utf8').trim();
    return next(spec, { ...ctx, parentURL: pathToFileURL(join(checkout, 'packages', 'core', 'package.json')).href });
  }
  return next(spec, ctx);
}
