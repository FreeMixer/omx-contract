// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
// Plugin descriptors (docs/descriptors.md): the example files of the three origins are valid and read back to the
// values they state; the words are the closed lists the docs give; every rule the schema cannot state is refused by
// its own code, one sabotage arm per code, both by validation and by the contract-directory reader, which then
// returns nothing.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, test } from 'node:test';
import { CONTRACT_CODES, ContractRefusal } from '../lib/codes.mjs';
import { SCHEMA_MAJOR, loadContractDir, sha256 } from '../lib/contract-dir.mjs';
import { entriesOf, isDescriptor, loadData, packageVersion, resolveData } from '../lib/data.mjs';
import { PARAM_SCALE_IDS } from '../lib/descriptor.mjs';
import { fileProblems } from '../lib/validate.mjs';
import { renderC } from '../render/c.mjs';
import { renderJson } from '../render/json.mjs';
import { renderTs } from '../render/ts.mjs';
import { DATA, ROOT, UNION } from './helpers.mjs';

const FIXTURES = join(ROOT, 'test/fixtures/descriptors');
const SCHEMA = JSON.parse(readFileSync(join(ROOT, 'schema/omx-contract.schema.json'), 'utf8'));
const fixture = (name) => JSON.parse(readFileSync(join(FIXTURES, `${name}.json`), 'utf8'));
const AUTHORED = 'authored-omx-delay';
const BUILT = 'built-wrapped-synth';
const SCANNED_LV2 = 'scanned-lv2-compressor';
const SCANNED_CLAP = 'scanned-clap-unknown';

/** The problems of one descriptor, as validation finds them, each as `item:rule`. */
const problemsOf = (doc) => fileProblems({ rel: 'descriptors/x.json', text: '', doc, installed: true });
const codesOf = (doc) => [...new Set(problemsOf(doc).map((p) => p.code ?? p.rule))];

const SCRATCH = mkdtempSync(join(tmpdir(), 'omx-contract-desc-'));
after(() => rmSync(SCRATCH, { recursive: true, force: true }));
let n = 0;

/** A contract directory holding omx-contract's data/ as the install writes it and the package `pkg` holding `files`. */
function directory(files, pkg = 'omx-plugins') {
  const root = join(SCRATCH, `cd-${n++}`);
  execFileSync('sh', [join(ROOT, 'tools/install-contract-dir.sh'), '-x', 'codes.json', 'omx-contract', packageVersion(ROOT), String(SCHEMA_MAJOR), DATA, root, 'data'], { stdio: 'ignore' });
  const dir = join(root, String(SCHEMA_MAJOR), pkg);
  const listed = {};
  for (const [rel, doc] of Object.entries(files)) {
    const p = join(dir, rel);
    mkdirSync(dirname(p), { recursive: true });
    const text = `${JSON.stringify(doc, null, 2)}\n`;
    writeFileSync(p, text);
    listed[rel] = sha256(Buffer.from(text));
  }
  writeFileSync(join(dir, 'MANIFEST.json'), `${JSON.stringify({ package: pkg, version: '0.6.0', schemaMajor: SCHEMA_MAJOR, files: listed }, null, 2)}\n`);
  return root;
}

const raised = new Set();
/** The code the read of a directory holding the valid authored fixture and `doc` refuses with; the read returns nothing. */
function readerRefusal(doc) {
  const root = directory({ 'plugins/omx-delay.json': fixture(AUTHORED), 'plugins/x.json': doc });
  let got;
  try { got = loadContractDir({ dir: root }); } catch (e) {
    assert.ok(e instanceof ContractRefusal, `a refusal, not ${e.message}`);
    raised.add(e.code);
    assert.equal(got, undefined, 'the read returned nothing');
    return e.code;
  }
  assert.fail('the read was not refused');
}

/** Break one copy of fixture `name` with `fn` and return the copy. */
const broken = (name, fn) => { const d = fixture(name); fn(d); return d; };

test('the four example descriptors, one per origin and one stating unknown, are valid', () => {
  assert.deepEqual(readdirSync(FIXTURES).sort(), [`${AUTHORED}.json`, `${BUILT}.json`, `${SCANNED_CLAP}.json`, `${SCANNED_LV2}.json`]);
  for (const name of [AUTHORED, BUILT, SCANNED_LV2, SCANNED_CLAP]) {
    const doc = fixture(name);
    assert.ok(isDescriptor(doc), name);
    assert.deepEqual(problemsOf(doc), [], name);
    assert.deepEqual(entriesOf(`descriptors/${name}.json`, doc), [], `${name}: a descriptor declares no item`);
  }
  assert.deepEqual([AUTHORED, BUILT, SCANNED_LV2, SCANNED_CLAP].map((x) => fixture(x).origin), ['authored', 'built', 'scanned', 'scanned']);
});

test('the authored delay states the delay kernel\'s travels, value for value (the owners\' fixture)', () => {
  const r = resolveData(loadData(UNION));
  const d = fixture(AUTHORED);
  const by = Object.fromEntries(d.controls.map((c) => [c.name, c]));
  for (const [control, item] of [['fxDelayTime', 'FX_DELAY_TIME_RANGE'], ['fxDelayFeedback', 'FX_DELAY_FEEDBACK_RANGE'], ['tone', 'DELAY_TONE_RANGE'], ['mix', 'DELAY_MIX_RANGE']]) {
    const { scale, ...t } = by[control].travel;
    const { byKind, ...want } = r.get(item).value;
    assert.deepEqual(t, want, `${control} is ${item}`);
    assert.equal(scale, 'linear');
  }
  assert.equal(by.pingpong.kind, 'toggle');
  assert.equal(by.pingpong.default, r.get('FX_DELAY_PINGPONG_DEFAULT').value);
  assert.deepEqual(d.controls.map((c) => c.meaning), ['delay', 'feedback', 'tone', 'wetDryRatio', undefined]);
  assert.deepEqual(d.controls.map((c) => c.id), [0, 1, 2, 3, 4]);
  assert.deepEqual(d.latency, { reports: true, frames: 0 });
});

test('the built instrument: notes in, audio out, its voices, needs and the words a scan cannot state', () => {
  const d = fixture(BUILT);
  assert.deepEqual(d.plugin.features, ['instrument']);
  assert.deepEqual(d.instrument, { voices: 16, polyphonic: true });
  assert.deepEqual(d.ports.map((p) => [p.kind, p.direction]), [['note', 'in'], ['audio', 'out']]);
  assert.deepEqual(d.ports[0].dialects, ['clap', 'midi']);
  assert.deepEqual(d.needs.extensions, { required: ['clap.note-ports'], optional: ['clap.voice-info'] });
  assert.deepEqual(d.controls.map((c) => c.kind), ['travel', 'travel', 'travel', 'travel', 'choice', 'travel', 'trigger', 'travel']);
  const glide = d.controls.find((c) => c.name === 'glide');
  assert.deepEqual([glide.travel.unit, glide.travel.scale, glide.meaning], ['unknown', 'unknown', 'unknown']);
  assert.deepEqual(d.controls.find((c) => c.name === 'pulseWidth').when, { control: 'waveform', is: 'square' });
  assert.deepEqual(d.controls.filter((c) => c.hidden).map((c) => [c.name, c.readonly]), [['voicesActive', true]]);
});

test('the scanned CLAP plugin: every unit and scale unknown, its module path as the group', () => {
  const d = fixture(SCANNED_CLAP);
  const cutoff = d.controls.find((c) => c.id === 5);
  assert.deepEqual([cutoff.travel.min, cutoff.travel.max, cutoff.travel.default, cutoff.travel.unit, cutoff.travel.scale], [20, 20000, 1000, 'unknown', 'unknown']);
  assert.deepEqual(cutoff.group, ['Filter', 'Envelope']);
  const shape = d.controls.find((c) => c.id === 3);
  assert.deepEqual([shape.ids, shape.values, shape.default], [['sine', 'square', 'saw'], [0, 1, 2], 'sine']);
  assert.ok(d.controls.every((c) => c.meaning === 'unknown'));
  assert.equal(d.source.from, 'controls.clap#clap_entry');
});

test('the scanned LV2 plugin: its units, a unit with no word as unknown, a side-chain input', () => {
  const d = fixture(SCANNED_LV2);
  assert.deepEqual(d.controls.map((c) => c.travel?.unit ?? null), ['dB', '', 'unknown', 'dB', null, 'dB']);
  assert.deepEqual(d.ports.map((p) => [p.role, p.channels, p.layout]), [['main', 2, 'stereo'], ['sidechain', 1, 'mono'], ['main', 2, 'stereo']]);
  assert.ok(d.controls.every((c) => c.source.from.startsWith('compressor.lv2/compressor.ttl#')));
});

test('the words are the closed lists of docs/descriptors.md', () => {
  const $ = SCHEMA.$defs;
  assert.deepEqual($.descriptorUnit.anyOf, [{ $ref: '#/$defs/unit' }, { enum: ['frames', 'bpm', 'midiNote', 'LUFS', 'deg', 'unknown'] }]);
  for (const u of ['frames', 'bpm', 'midiNote', 'LUFS', 'deg', 'unknown']) assert.ok(!$.unit.enum.includes(u), `${u} is no unit of the items`);
  assert.deepEqual($.unit.enum, ['dB', 'dBFS', 'ms', 's', 'min', 'Hz', 'oct', 'cents', 'st', '%', 'x', ''], 'the items\' units are as they were');
  assert.deepEqual($.meaning.enum, [
    'gain', 'threshold', 'ratio', 'attack', 'release', 'hold', 'decay', 'frequency', 'cutoffFrequency', 'resonance', 'bypass',
    'wetDryRatio', 'delay', 'enabled',
    'range', 'knee', 'hysteresis', 'makeup', 'lookahead', 'ceiling', 'output', 'q', 'slope', 'width', 'drive', 'tone', 'rate',
    'depth', 'feedback', 'spread', 'predelay', 'size', 'damping', 'lowCut', 'highCut', 'shift', 'fine', 'sync', 'division', 'listen',
    'unknown',
  ]);
  assert.deepEqual($.descriptor.properties.origin.enum, ['authored', 'built', 'scanned']);
  assert.deepEqual($.descriptorControl.properties.kind.enum, ['travel', 'choice', 'toggle', 'trigger']);
  assert.deepEqual($.port.properties.kind.enum, ['audio', 'midi', 'note', 'cv']);
  assert.deepEqual($.port.properties.role.enum, ['main', 'sidechain', 'aux']);
  assert.deepEqual($.port.properties.layout.enum, ['mono', 'stereo', 'surround']);
  assert.deepEqual($.port.properties.dialects.items.enum, ['clap', 'midi', 'midiMpe', 'midi2']);
  assert.deepEqual($.plugin.properties.features.items.enum, ['audio-effect', 'instrument', 'note-effect', 'analyzer']);
  assert.deepEqual(Object.keys($.descriptor.properties), ['$schema', 'requires', 'origin', 'plugin', 'controls', 'ports', 'instrument', 'needs', 'latency', 'source']);
  assert.deepEqual(PARAM_SCALE_IDS, ['linear', 'log', 'stepped']);
  const doc = readFileSync(join(ROOT, 'docs/descriptors.md'), 'utf8');
  for (const w of [...$.meaning.enum, 'frames', 'bpm', 'midiNote', 'LUFS', 'deg', 'midiMpe', 'midi2']) assert.ok(doc.includes(`\`${w}\``), `docs/descriptors.md names ${w}`);
});

test('a word the schema does not have is contract.file.invalid, never skipped', () => {
  const arms = [
    ['a unit with no word', (d) => { d.controls[0].travel.unit = 'volts'; }],
    ['a kind with no word', (d) => { d.controls[0].kind = 'knob'; }],
    ['a meaning with no word (mix is wetDryRatio)', (d) => { d.controls[0].meaning = 'mix'; }],
    ['an origin with no word', (d) => { d.origin = 'guessed'; }],
    ['a feature with no word', (d) => { d.plugin.features = ['delay']; }],
    ['a layout with no word', (d) => { d.ports[0].layout = 'quad'; }],
    ['a key no descriptor has', (d) => { d.verdict = 'good'; }],
    ['an item beside the words', (d) => { d.TEST_A = { kind: 'scalar', doc: 'x', unit: '', value: 1 }; }],
    ['a toggle with a travel', (d) => { d.controls[4].travel = { min: 0, max: 1, unit: '', scale: 'linear' }; }],
    ['a trigger with a default', (d) => { d.controls[4].kind = 'trigger'; }],
    ['a travel without its unit', (d) => { delete d.controls[0].travel.unit; }],
    ['a travel without its scale', (d) => { delete d.controls[0].travel.scale; }],
    ['a control without its id', (d) => { delete d.controls[0].id; }],
    ['a symbol that is no identifier', (d) => { d.controls[0].symbol = 'fx delay'; }],
  ];
  for (const [what, fn] of arms) {
    const d = broken(AUTHORED, fn);
    assert.deepEqual(codesOf(d), ['schema'], what);
    assert.equal(readerRefusal(d), CONTRACT_CODES.fileInvalid, what);
  }
  const midi1 = broken(BUILT, (d) => { d.ports[0].dialects = ['midi1']; });
  assert.deepEqual(codesOf(midi1), ['schema'], 'midi1 is CLAP\'s midi');
});

/** One arm per descriptor code: the fixture, the break, the code it is refused with. */
const ARMS = [
  ['an authored descriptor with no impl link', AUTHORED, (d) => { delete d.source; }, 'descriptorOriginSource'],
  ['a built control with no from link, its own or the file\'s', BUILT, (d) => { delete d.source; d.controls.slice(1).forEach((c) => { c.source = { from: 'build/wrapped-synth.clap#clap_entry' }; }); }, 'descriptorOriginSource'],
  ['an authored unit of unknown', AUTHORED, (d) => { d.controls[0].travel.unit = 'unknown'; }, 'descriptorUnknownAuthored'],
  ['an authored scale of unknown', AUTHORED, (d) => { d.controls[1].travel.scale = 'unknown'; }, 'descriptorUnknownAuthored'],
  ['an authored meaning of unknown', AUTHORED, (d) => { d.controls[2].meaning = 'unknown'; }, 'descriptorUnknownAuthored'],
  ['two controls with one id', AUTHORED, (d) => { d.controls[1].id = 0; }, 'descriptorControlDuplicate'],
  ['two controls with one name', SCANNED_CLAP, (d) => { d.controls[1].name = 'shape'; }, 'descriptorControlDuplicate'],
  ['two controls with one symbol', AUTHORED, (d) => { d.controls[1].symbol = d.controls[0].symbol; }, 'descriptorControlDuplicate'],
  ['two audio inputs with one id', AUTHORED, (d) => { d.ports.push({ ...d.ports[0], name: 'Again' }); }, 'descriptorPortDuplicate'],
  ['a default above the max', AUTHORED, (d) => { d.controls[0].travel.default = 2001; }, 'descriptorRange'],
  ['a min above the max', BUILT, (d) => { d.controls[0].travel.min = 30000; d.controls[0].travel.default = 25000; }, 'descriptorRange'],
  ['a negative step', AUTHORED, (d) => { d.controls[0].travel.step = -1; }, 'descriptorRange'],
  ['a choice default that is no id', BUILT, (d) => { d.controls[4].default = 'triangle'; }, 'descriptorChoice'],
  ['two labels for three ids', SCANNED_CLAP, (d) => { d.controls[0].labels.pop(); }, 'descriptorChoice'],
  ['four values for three ids', SCANNED_CLAP, (d) => { d.controls[0].values.push(3); }, 'descriptorChoice'],
  ['a scale that is no PARAM_SCALES id', AUTHORED, (d) => { d.controls[0].travel.scale = 'exp'; }, 'descriptorScale'],
  ['a layout on a note port', BUILT, (d) => { d.ports[0].layout = 'stereo'; }, 'descriptorPortWords'],
  ['a note port without dialects', BUILT, (d) => { delete d.ports[0].dialects; }, 'descriptorPortWords'],
  ['dialects on an audio port', AUTHORED, (d) => { d.ports[0].dialects = ['midi']; }, 'descriptorPortWords'],
  ['stereo with one channel', AUTHORED, (d) => { d.ports[1].channels = 1; }, 'descriptorPortWords'],
  ['the instrument feature without the block', BUILT, (d) => { delete d.instrument; }, 'descriptorInstrument'],
  ['the block without the feature', AUTHORED, (d) => { d.instrument = { polyphonic: false }; }, 'descriptorInstrument'],
  ['an instrument with no note input', BUILT, (d) => { d.ports[0].direction = 'out'; }, 'descriptorInstrument'],
  ['an instrument with no audio output', BUILT, (d) => { d.ports[1].kind = 'cv'; delete d.ports[1].role; delete d.ports[1].channels; delete d.ports[1].layout; }, 'descriptorInstrument'],
  ['a when naming no control', BUILT, (d) => { d.controls[5].when.control = 'shape'; }, 'descriptorWhen'],
  ['a when naming a travel', BUILT, (d) => { d.controls[5].when.control = 'cutoff'; }, 'descriptorWhen'],
  ['a when with an id the choice lacks', BUILT, (d) => { d.controls[5].when.is = 'triangle'; }, 'descriptorWhen'],
];

for (const [what, name, fn, code] of ARMS) {
  test(`${CONTRACT_CODES[code]}: ${what}`, () => {
    const d = broken(name, fn);
    const problems = problemsOf(d);
    assert.deepEqual([...new Set(problems.map((p) => p.code))], [CONTRACT_CODES[code]], `${what}: ${JSON.stringify(problems)}`);
    assert.ok(problems.every((p) => p.name === code && p.file === 'descriptors/x.json'));
    // the reader refuses a scanned file for its origin before its rules, so a scanned fixture is read as built
    assert.equal(readerRefusal(d.origin === 'scanned' ? { ...d, origin: 'built' } : d), CONTRACT_CODES[code]);
  });
}

test('the reader reads authored and built descriptors beside the items; they declare none and move no render', () => {
  const root = directory({ 'plugins/omx-delay.json': fixture(AUTHORED), 'plugins/wrapped-synth.json': fixture(BUILT) });
  const read = loadContractDir({ dir: root });
  assert.deepEqual(read.files.filter((f) => f.pkg === 'omx-plugins').map((f) => [f.rel, f.doc.origin]), [['omx-plugins/plugins/omx-delay.json', 'authored'], ['omx-plugins/plugins/wrapped-synth.json', 'built']]);
  const data = loadData(DATA);
  assert.deepEqual([...read.items.keys()], [...data.items.keys()]);
  const a = resolveData(read);
  for (const [render, dir] of [[renderC, 'include'], [renderTs, 'test/golden/ts']]) {
    for (const f of render(a)) assert.equal(f.text, readFileSync(join(ROOT, dir, f.path), 'utf8'), `${dir}/${f.path}`);
  }
  assert.equal(renderJson(a, packageVersion(ROOT))[0].text, readFileSync(join(ROOT, 'share/omx-contract/omx-contract.json'), 'utf8'));
});

test('a scanned descriptor in the contract directory is contract.origin.misplaced, and the read stops', () => {
  for (const name of [SCANNED_LV2, SCANNED_CLAP]) assert.equal(readerRefusal(fixture(name)), CONTRACT_CODES.originMisplaced, name);
});

test('every descriptor code was raised by an arm above, through validation and through the reader', () => {
  const descriptor = Object.entries(CONTRACT_CODES).filter(([k]) => k.startsWith('descriptor')).map(([, c]) => c);
  assert.equal(descriptor.length, 10);
  assert.deepEqual(descriptor.filter((c) => !raised.has(c)), []);
  assert.ok(raised.has(CONTRACT_CODES.originMisplaced));
});
