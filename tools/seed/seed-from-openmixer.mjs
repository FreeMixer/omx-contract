#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
/**
 * ONE-TIME seed of data/ (omx-contract spec §4.1) and of the frozen round-trip fixture (§4.4 step 1)
 * from openmixer's BUILT core and declarations. Kept for provenance; never run by CI or a release.
 * Every number is read from the built modules, never typed here: this file holds only the layout
 * (which item goes to which file), each scalar's and list's unit, and where a value is a reference
 * or a derivation in openmixer's source — and it asserts that every resolved item deep-equals the
 * built export, and the delay selection equals params-gen's `select(core)`.
 *
 * Usage (from the input/openmixer-snapshot worktree, its core and declarations built with tsc):
 *   node tools/seed/seed-from-openmixer.mjs --openmixer <snapshot>/openmixer --core <core dist> \
 *     --declarations <declarations dist> --pin <omx-dsp v0.1.3 include/omxdsp/omx_contract_limits.h> \
 *     [--data data] [--fixture test/fixtures/openmixer-f98836216b53.json]
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { loadData, resolveData } from '../../lib/data.mjs';
import { formatDoc } from '../../lib/fmt.mjs';

const arg = (n) => { const i = process.argv.indexOf(n); return i < 0 ? undefined : process.argv[i + 1]; };
const OM = resolve(arg('--openmixer'));
const core = await import(join(resolve(arg('--core')), 'index.js'));
const decl = await import(join(resolve(arg('--declarations')), 'index.js'));
const DATA = resolve(arg('--data') ?? 'data');
const ns = { ...decl, ...core };

/** [file, [name, { unit?, set? }]...]: `set` maps a value path to its ref or derivation in openmixer's source. */
const LAYOUT = [
  ['rates.json', [
    ['STANDARD_SAMPLE_RATES', { unit: 'Hz' }],
    ['RT_HARD_TARGET', {}],
    ['DSP_KNOB_REFERENCE_RATE', { unit: 'Hz' }],
  ]],
  ['primitives.json', [
    ['BUTTERWORTH_Q', { unit: '', set: { '': { derive: 'sqrt', of: 0.5 } } }],
    ['ALLPASS_LIMITS', {}],
    ['XOVER_LIMITS', { set: { lr4SectionQ: { ref: 'BUTTERWORTH_Q' } } }],
    ['FDELAY_MOD_READ_ORDER', { unit: '' }],
    ['FDELAY_READ_L1_NORM', { unit: '', set: { '': { derive: 'lagrangeReadL1', order: { ref: 'FDELAY_MOD_READ_ORDER' } } } }],
  ]],
  ['kernels/gate.json', [['GATE_LIMITS', {}]]],
  ['kernels/comp.json', [['COMP_LIMITS', {}], ['PROGRAM_RELEASE', {}]]],
  ['kernels/limiter.json', [['LIMITER_LIMITS', {}]]],
  ['kernels/transient.json', [
    ['TRANSIENT_LIMITS', {}],
    ['TRANSIENT_FAST_ATTACK_MS', { unit: 'ms' }],
    ['TRANSIENT_FAST_RELEASE_MS', { unit: 'ms' }],
    ['TRANSIENT_REF_DB', { unit: 'dB' }],
    ['TRANSIENT_FLOOR_LIN', { unit: '' }],
  ]],
  ['kernels/pitch.json', [['PITCH_LIMITS', {}], ['PITCH_KERNEL', { set: { prefilterQ: { ref: 'BUTTERWORTH_Q' } } }]]],
  ['kernels/delay.json', [
    ['FX_DELAY_TIME_RANGE', { c: { alias: { fact: 'delay', field: 'timeMs' } } }],
    ['FX_DELAY_FEEDBACK_RANGE', {}],
    ['DELAY_TONE_RANGE', {}],
    ['DELAY_MIX_RANGE', {}],
    ['FX_DELAY_PINGPONG_DEFAULT', { unit: '' }],
  ]],
  ['kernels/chorus.json', [['CHORUS_SPREAD_RANGE', {}]]],
  ['kernels/reverb.json', [['REVERB_PLATE_MOD_DEPTH_RANGE', {}]]],
  ['kernels/drive.json', [['DRIVE_BIAS_MAX', { unit: '', set: { '': { derive: 'sqrt', of: 0.5 } } }]]],
  ['kernels/eq.json', [
    ['EQ_MAX_BANDS', { unit: '' }],
    ['ISO_THIRD_OCTAVE_CENTRES_HZ', { unit: 'Hz', c: { render: false } }],
    ['GEQ_BANDS', { unit: '', set: { '': { derive: 'count', of: 'ISO_THIRD_OCTAVE_CENTRES_HZ' } } }],
  ]],
];

/** The JSDoc above `export const NAME` in openmixer's core or declarations source, as one paragraph. */
const SOURCES = [join(OM, 'packages/core/src'), join(OM, 'packages/declarations/src')]
  .flatMap((d) => readdirSync(d).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts')).map((f) => readFileSync(join(d, f), 'utf8')));
function docOf(name) {
  for (const src of SOURCES) {
    const at = src.search(new RegExp(`\\nexport const ${name}\\b`));
    if (at < 0) continue;
    const before = src.slice(0, at);
    const m = /\/\*\*((?:(?!\*\/)[\s\S])*)\*\/\s*$/.exec(before);
    if (!m) break;
    return m[1].split('\n').map((l) => l.replace(/^\s*\* ?/, '')).join(' ').replace(/\{@link ([^}]+)\}/g, '$1').replace(/\s+/g, ' ').trim();
  }
  return undefined;
}

const plain = (v) => JSON.parse(JSON.stringify(v));
const isObj = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);
const isTravel = (v) => isObj(v) && typeof v.min === 'number' && typeof v.max === 'number';

function setAt(value, path, spec) {
  if (path === '') return spec;
  const keys = path.split('.');
  let o = value;
  for (const k of keys.slice(0, -1)) o = o[k];
  if (!(keys.at(-1) in o)) throw new Error(`seed: no ${path} to set`);
  o[keys.at(-1)] = spec;
  return value;
}

function item(name, o) {
  if (!(name in ns)) throw new Error(`seed: openmixer exports no ${name}`);
  const v = plain(ns[name]);
  const doc = docOf(name) ?? `${name}, moved from openmixer.`;
  let it;
  if (typeof v === 'number' || typeof v === 'boolean') it = { kind: 'scalar', doc, unit: o.unit, value: v };
  else if (Array.isArray(v)) it = { kind: 'list', doc, unit: o.unit, values: v };
  else if (isTravel(v)) it = { kind: 'travels', doc, travel: v };
  else if (Object.values(v).every(isTravel)) it = { kind: 'travels', doc, fields: v };
  else it = { kind: 'sheet', doc, value: v };
  for (const [path, spec] of Object.entries(o.set ?? {})) {
    if (it.kind === 'scalar' && path === '') it.value = spec;
    else if (it.kind === 'sheet') it.value = setAt(it.value, path, spec);
    else throw new Error(`seed: cannot set ${name}.${path}`);
  }
  if (o.c) it.c = o.c;
  return it;
}

// The delay plugin: params-gen.mjs's PLUGINS.delay, its selection as data. Frozen at 1.0.0: 1.1.0
// retired data/plugins/ and the plugin kind, so this section only records how 1.0.0 was seeded.
const DELAY_ROW = '/channel/{kind}/{index}/delay';
const DELAY_PLUGIN = {
  kind: 'plugin',
  doc: "The delay plugin's parameters, in append-only order: DPF's parameter index is the CLAP param id and the LV2 port order (omx-plugins-dpf §3b). Moved from openmixer's packages/omx-plugins/tools/params-gen.mjs PLUGINS.delay.",
  why: "mix is per instance on the desk (insert or fxReturn); a plugin racked in a foreign host is an INSERT, so it reads the input kind's default (omx-plugins-dpf §3a).",
  plugin: 'delay',
  header: 'omx_delay_params.h',
  prefix: 'OMX_DELAY',
  source: 'FX_DELAY_TIME_RANGE, FX_DELAY_FEEDBACK_RANGE, DELAY_MIX_RANGE for kind input, DELAY_TONE_RANGE, FX_DELAY_PINGPONG_DEFAULT',
  params: [
    { symbol: 'timeMs', from: 'FX_DELAY_TIME_RANGE', scale: 'linear', since: '1.0.0' },
    { symbol: 'feedback', from: 'FX_DELAY_FEEDBACK_RANGE', scale: 'linear', since: '1.0.0' },
    { symbol: 'mix', from: 'DELAY_MIX_RANGE', forKind: 'input', scale: 'linear', since: '1.0.0' },
    { symbol: 'tone', from: 'DELAY_TONE_RANGE', scale: 'linear', since: '1.0.0' },
    { symbol: 'pingpong', from: 'FX_DELAY_PINGPONG_DEFAULT', flags: ['toggle'], scale: 'linear', since: '1.0.0' },
  ],
};

/** params-gen.mjs's PLUGINS.delay.select(core), over the built core (the travel/toggle helpers inlined). */
function delaySelect(c) {
  const row = c.CONSOLE_TRAVEL_DECLS[DELAY_ROW];
  const travel = (symbol, l) => ({ symbol, min: l.min, max: l.max, def: l.default, step: l.step, unit: l.unit, toggle: false });
  const mix = row.mix?.limit ?? (row.mix?.perInstance ? c.limitForKind(c.DELAY_MIX_RANGE, 'input') : undefined);
  return [travel('timeMs', row.timeMs.limit), travel('feedback', row.feedback.limit), travel('mix', mix), travel('tone', row.tone.limit),
    { symbol: 'pingpong', min: 0, max: 1, def: c.FX_DELAY_PINGPONG_DEFAULT ? 1 : 0, step: 1, unit: '', toggle: true }];
}

const texts = {};
for (const [file, entries] of LAYOUT) {
  const depth = file.split('/').length;
  const doc = { $schema: `${'../'.repeat(depth)}schema/omx-contract.schema.json` };
  for (const [name, o] of entries) doc[name] = item(name, o);
  if (file === 'kernels/delay.json') { /* the plugin lives in data/plugins/ */ }
  texts[`data/${file}`] = formatDoc(doc);
}
texts['data/plugins/delay.json'] = formatDoc({ $schema: '../../schema/omx-contract.schema.json', DELAY_PLUGIN });

// Assert: every resolved item is the built export, and the plugin is params-gen's selection.
const resolved = resolveData(loadData(null, texts));
let bad = 0;
for (const r of resolved.values()) {
  const want = r.kind === 'plugin' ? plain(delaySelect(ns)) : plain(ns[r.name]);
  if (JSON.stringify(r.value) !== JSON.stringify(want)) { console.error(`seed: ${r.name} resolves to ${JSON.stringify(r.value)}, openmixer has ${JSON.stringify(want)}`); bad++; }
}
if (bad) process.exit(1);
for (const [rel, text] of Object.entries(texts)) {
  const p = join(DATA, '..', rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, text);
}
console.log(`seed: ${resolved.size} items in ${Object.keys(texts).length} files, each equal to openmixer's built export`);

// The frozen fixture: openmixer's whole sheet, rewound from the snapshot (6c6e709f4429) to the pin
// f98836216b53 by the console scalars that moved between them, each checked against the pinned header.
const fixture = arg('--fixture');
if (fixture) {
  const pin = readFileSync(resolve(arg('--pin')), 'utf8');
  const { contractLimitsSheet } = await import(join(OM, 'harness/contract-limits-render.mjs'));
  const { CHANNEL_CONTRACT } = await import(join(resolve(arg('--core')), 'channel-contract.js'));
  const { LAW_KINDS } = await import(join(resolve(arg('--core')), 'fact-declaration.js'));
  const { CORE_LIMITS } = await import(join(resolve(arg('--core')), 'control-bounds.js'));
  const { STANDARD_SAMPLE_RATES } = await import(join(resolve(arg('--core')), 'row-codecs.js'));
  // plugin-qualify's src is not in the snapshot: the CLAP host extension ids are read off the pinned header.
  const OMX_CLAP_HOST_EXTENSIONS = JSON.parse(`[${/OMX_CLAP_HOST_EXTENSIONS_INIT \{ (.*), NULL \}/.exec(pin)[1]}]`);
  const s = contractLimitsSheet(core, decl, { CHANNEL_CONTRACT, LAW_KINDS, CORE_LIMITS, OMX_CLAP_HOST_EXTENSIONS, STANDARD_SAMPLE_RATES });
  const ADDED_AFTER_PIN = ['CUE_FADE_MS_RANGE_MAX', 'CUE_FADE_MS_RANGE_MIN', 'CUE_FADE_TICK_MS', 'CUE_GO_GUARD_MS', 'CUE_HAND_EPSILON', 'CUE_RESTORE_RING', 'ROOM_PROFILE_SCHEMA_VERSION'];
  const MOVED_AFTER_PIN = ['CONTRACT_VERSION_MINOR'];
  for (const m of ADDED_AFTER_PIN) if (new RegExp(`^#define OMX_${m} `, 'm').test(pin)) throw new Error(`seed: OMX_${m} is in the pin, not added after it`);
  const scalars = s.DECLARED_SCALARS.filter((x) => !ADDED_AFTER_PIN.includes(x.macro)).map((x) => {
    if (!MOVED_AFTER_PIN.includes(x.macro)) return x;
    const value = Number(new RegExp(`^#define OMX_${x.macro} (\\S+)$`, 'm').exec(pin)[1]);
    return { ...x, value };
  });
  const sheet = {
    CHANNEL_CONTRACT: Object.fromEntries(Object.entries(s.CHANNEL_CONTRACT).map(([k, v]) => [k, { laws: (v.laws ?? []).map((l) => ({ law: l.law })) }])),
    LAW_KINDS: s.LAW_KINDS,
    NATIVE_LIMIT_TABLES: s.NATIVE_LIMIT_TABLES,
    CORE_LIMITS: Object.fromEntries(['pan', 'delay', 'reverb', 'drive'].map((f) => [f, s.CORE_LIMITS.get(f)])),
    DECLARED_SCALARS: scalars,
    OMX_CLAP_HOST_EXTENSIONS,
    STANDARD_SAMPLE_RATES: s.STANDARD_SAMPLE_RATES,
    DECLARED_SETS: s.DECLARED_SETS,
    DECLARED_LISTS: s.DECLARED_LISTS,
  };
  const out = {
    about: 'Frozen export of openmixer\'s whole contract-limits sheet at the pin f98836216b53 and its delay plugin selection, for the round-trip proof (omx-contract spec §4.4 step 1). Test input only, never shipped data. Built from openmixer 6c6e709f4429 (input/openmixer-snapshot) by tools/seed/seed-from-openmixer.mjs, rewound to the pin by: ' +
      `scalars added after it removed (${ADDED_AFTER_PIN.join(', ')}); scalars moved after it at the pin's value (${MOVED_AFTER_PIN.join(', ')}); the CLAP host extension ids read off the pinned header.`,
    sheet: plain(sheet),
    plugins: [{ header: 'omx_delay_params.h', prefix: 'OMX_DELAY', source: "CONSOLE_TRAVEL_DECLS['/channel/{kind}/{index}/delay'], limitForKind(DELAY_MIX_RANGE, 'input'), FX_DELAY_PINGPONG_DEFAULT", params: plain(delaySelect(ns)) }],
  };
  mkdirSync(dirname(resolve(fixture)), { recursive: true });
  writeFileSync(resolve(fixture), `${JSON.stringify(out, null, 1)}\n`);
  console.log(`seed: wrote the fixture ${fixture}`);
}
