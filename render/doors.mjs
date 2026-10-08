// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
/**
 * The resolved data cut into the C renderer's doors, as openmixer's discovery cut its barrels
 * (packages/core/src/native-limit-tables.ts, declared-scalars.ts, declared-lists.ts): a `travels`
 * table named <PREFIX>_LIMITS is a native table; every scalar, sheet and single travel is scalars
 * (its finite-number leaves, a travel's `unit`/`defaultFrom` labels skipped); a list is a declared
 * list unless its item says `"c": { "render": false }`; a set is an enum; a `c.alias` is the core-limit spelling.
 */

const constantCase = (key) => key.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toUpperCase();
const isSheet = (v) => typeof v === 'object' && v !== null && !Array.isArray(v) && Object.keys(v).length > 0;
const isTravel = (v) => typeof v.min === 'number' && typeof v.max === 'number';
const TRAVEL_LABELS = new Set(['unit', 'defaultFrom']);

/** Every leaf of `v` when ALL its leaves are finite numbers; `undefined` when any is not (declared-scalars.ts). */
function numberLeaves(v, path, macro) {
  if (typeof v === 'number') return Number.isFinite(v) ? [{ path, macro, value: v }] : undefined;
  if (!isSheet(v)) return undefined;
  const out = [];
  for (const [key, leaf] of Object.entries(v)) {
    if (TRAVEL_LABELS.has(key) && typeof leaf === 'string' && !path.includes('.') && isTravel(v)) continue;
    const leaves = numberLeaves(leaf, `${path}.${key}`, `${macro}_${constantCase(key)}`);
    if (leaves === undefined) return undefined;
    out.push(...leaves);
  }
  return out;
}

/** True for a `travels` table that is a native limit table (its name ends `_LIMITS`). */
export const isNativeTable = (r) => r.kind === 'travels' && r.shape === 'table' && r.name.endsWith('_LIMITS');

/** The doors of the resolved items (a Map name -> resolved item). */
export function doors(resolved) {
  const items = [...resolved.values()];
  const NATIVE_LIMIT_TABLES = items.filter(isNativeTable)
    .map((r) => [r.name.slice(0, -'_LIMITS'.length), r.value])
    .sort(([a], [b]) => a.localeCompare(b));
  const byMacro = new Map();
  for (const r of items) {
    if (isNativeTable(r) || r.kind === 'list' || r.kind === 'set') continue;
    const leaves = numberLeaves(r.value, r.name, r.name.replace(/_(KERNEL|LIMITS)$/, ''));
    if (leaves === undefined) continue;
    for (const s of leaves) {
      const seen = byMacro.get(s.macro);
      if (seen) throw new Error(`${seen.path} and ${s.path} both render as OMX_${s.macro} — rename one`);
      byMacro.set(s.macro, s);
    }
  }
  const DECLARED_SCALARS = [...byMacro.values()].sort((a, b) => (a.macro < b.macro ? -1 : a.macro > b.macro ? 1 : 0));
  const DECLARED_LISTS = items.filter((r) => r.kind === 'list' && r.c?.render !== false)
    .map((r) => ({ name: r.name, values: r.value }))
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  const DECLARED_SET_ITEMS = items.filter((r) => r.kind === 'set')
    .map((r) => ({ name: r.name, ids: r.value, default: r.default }))
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  const ALIASES = new Map();
  for (const r of items) {
    if (!r.c?.alias) continue;
    const { fact, field } = r.c.alias;
    if (!ALIASES.has(fact)) ALIASES.set(fact, {});
    ALIASES.get(fact)[field] = r.value;
  }
  const STANDARD_SAMPLE_RATES = resolved.get('STANDARD_SAMPLE_RATES')?.value;
  return { NATIVE_LIMIT_TABLES, DECLARED_SCALARS, DECLARED_LISTS, DECLARED_SET_ITEMS, ALIASES, STANDARD_SAMPLE_RATES };
}
