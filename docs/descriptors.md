<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com> -->
# Plugin descriptors

A descriptor file describes one plugin, ours or anyone's: its identity, its controls, its ports, whether it is an
instrument, what it needs from the host and whether it reports latency. A control is the kernel file's control
([kernel-files.md](kernel-files.md)) with a few words more, so a kernel and a plugin are described in one language.

The words are our own. Where LV2 or CLAP already has a word for the same fact, the descriptor borrows its name:
units from LV2 `units:`, meanings from LV2 `param:` and `lv2:designation`, choice labels from LV2 scale points,
`group` from LV2 `pg:group` and CLAP `module`, the flags from CLAP param flags, note dialects from CLAP note ports.
Two mappings (CLAP to descriptor, LV2 to descriptor) and two generators (descriptor to a CLAP face, descriptor to
an LV2 `.ttl`) read and write these words; what a format cannot say is `unknown` or an extra.

The schema (`schema/omx-contract.schema.json`, `$defs.descriptor`) holds the words; `omx-contract validate` and the
contract-directory reader hold a file to them. This release adds the words only: no item moves and no render
changes.

## The file

```json
{
  "$schema": "https://github.com/FreeMixer/omx-contract/raw/v2/schema/omx-contract.schema.json",
  "requires": { "omx-contract-schema": ">= 2.15.0" },
  "origin": "authored",
  "plugin": { "id": "org.example.delay", "format": "clap", "name": "Delay", "features": ["audio-effect"] },
  "controls": [
    { "id": 0, "name": "time", "kind": "travel", "meaning": "delay", "group": ["Delay"],
      "travel": { "min": 1, "max": 2000, "unit": "ms", "default": 350, "scale": "log" } },
    { "id": 1, "name": "pingpong", "kind": "toggle", "default": false }
  ],
  "ports": [
    { "id": "in", "name": "Input", "kind": "audio", "direction": "in", "role": "main", "channels": 2, "layout": "stereo" },
    { "id": "out", "name": "Output", "kind": "audio", "direction": "out", "role": "main", "channels": 2, "layout": "stereo" }
  ],
  "source": { "impl": "src/delay.c#delay_process" }
}
```

A file is a descriptor when it carries `origin`; it then declares no item, and only the words below may stand at
its top: `$schema`, `requires`, `origin`, `plugin`, `controls`, `ports`, `instrument`, `needs`, `latency`, `source`.
Any other key or word is `contract.file.invalid`, never skipped.

## The words

"Existing" is a word the schema already had for kernel files and items; "new" is a word this release adds.

| Block | Word | Meaning | New / existing |
|---|---|---|---|
| file | `$schema`, `requires` | As every installed file ([contract-dir.md](contract-dir.md)) | existing |
| file | `origin` | `authored`, `built` or `scanned` (below) | new |
| `plugin` | `id`, `format` (`clap`, `lv2`), `uri`, `name`, `vendor`, `version` | Identity as the plugin states it; `id` is the CLAP id or the LV2 URI | new |
| `plugin` | `features` | `audio-effect`, `instrument`, `note-effect`, `analyzer`: CLAP's feature names, LV2 classes mapped onto them | new |
| control | `name`, `doc`, `kind`, `ids`, `labels`, `values`, `default`, `count`, `when` | As in kernel files; `name` is the plugin's own name for the control | existing |
| control | `kind`: `travel`, `choice` | A continuous or stepped travel; a list of named values | existing |
| control | `kind`: `toggle`, `trigger` | On or off (LV2 `lv2:toggled`); a momentary action (LV2 `pprops:trigger`) | new |
| control | `travel.min`, `.max`, `.step`, `.unit`, `.default`, `.defaultFrom`, `.scale` | Range, unit, scale (an id of `PARAM_SCALES`) and the come-up value | existing |
| control | `id` | The host's handle: the CLAP `clap_id` (an integer) or the LV2 port symbol | new |
| control | `symbol` | The stable name a session keys the control by, beside a CLAP `clap_id`: our authored plugins' parameter-contract symbol, so a restore finds the control when ids move. Optional; an LV2 control's `id` is its symbol already | new |
| control | `label` | The display name, when it differs from `name` | new |
| control | `group` | A path, outer first: `["Filter", "Envelope"]`. CLAP `module`, LV2 `pg:group`, our panel section | new |
| control | `meaning` | What the control does, from the closed list below. A skin binds by meaning, never by id | new |
| control | `hidden`, `readonly`, `automatable` | CLAP `IS_HIDDEN`, `IS_READONLY`, `IS_AUTOMATABLE`; LV2 `pprops:notOnGUI`, an output control | new |
| control | `source` | The control's own links, in the place of the file's | existing |
| `travel` | units `frames`, `bpm`, `midiNote`, `LUFS`, `deg` | Units a plugin uses that no item does (below) | new |
| `travel` | `unit: "unknown"`, `scale: "unknown"` | The plugin states no unit or scale, or one with no word here | new |
| `ports[]` | `id`, `name`, `kind` (`audio`, `midi`, `note`, `cv`), `direction` (`in`, `out`) | One entry per port, in the plugin's order | new |
| `ports[]` | `role` (`main`, `sidechain`, `aux`), `channels`, `layout` (`mono`, `stereo`, `surround`) | An audio port's layout: CLAP audio ports (`IS_MAIN`, channel count, port type), LV2 `pg:` groups and `lv2:isSideChain` | new |
| `ports[]` | `dialects` (`clap`, `midi`, `midiMpe`, `midi2`) | What a note port accepts or emits: CLAP's note dialects | new |
| `instrument` | `voices`, `polyphonic` | Present exactly when `features` holds `instrument`: notes in, audio out. `voices` only when the plugin states it (CLAP voice info) | new |
| `needs` | `transport`, `tempo`, `extensions.required`, `extensions.optional` | What the host must give: CLAP host extensions, LV2 `lv2:requiredFeature` and `lv2:optionalFeature`, a `time:Position` input | new |
| `latency` | `reports`, `frames` | `reports: true` when the plugin reports its latency; `frames` only for a constant the plugin defines, never a measured figure | new |
| `source` | `from`, `impl`, `at` | As in [contract-dir.md](contract-dir.md); for a scan, links into the `.ttl` or the CLAP binary | existing |

Never in a descriptor: measured latency per rate, CPU cost, stability, real-time safety, verdicts. They are
measurements of one machine and belong to a qualification record, which no descriptor carries.

### What each kind carries

| `kind` | Carries | Leaves out |
|---|---|---|
| `travel` | `travel`, with `unit` and `scale` always stated | `ids`, `labels`, `values` |
| `choice` | `ids`; optionally `labels` (one per id), `values` (one number per id: the value the plugin reads for it) and a `default` among the ids | `travel` |
| `toggle` | optionally a boolean `default` | `travel`, `ids` |
| `trigger` | nothing more: a trigger has no state, so no `default` | `travel`, `ids`, `default` |

### Units

A descriptor's `travel.unit` is a unit of the item list (`dB dBFS ms s min Hz oct cents st % x` and `""`), one of
the five below, or `unknown`.

| Unit | Taken from |
|---|---|
| `frames` | LV2 `units:frame`, whose symbol is `frames` |
| `bpm` | LV2 `units:bpm` (its symbol is `BPM`) |
| `midiNote` | LV2 `units:midiNote` (its symbol is `note`) |
| `LUFS` | No LV2 unit: loudness, ITU-R BS.1770 |
| `deg` | LV2 `units:degree`, whose symbol is `deg` |
| `unknown` | The plugin states no unit (every CLAP parameter; an LV2 port without `units:unit`), or one with no word here; the LV2 unit stays in `source` |

The item list stays the units the items use; these six are for descriptors only.

### Scales

`travel.scale` is an id of `PARAM_SCALES` (`linear`, `log`, `stepped`) or `unknown`: the plugin states none.

### Meanings

The closed list, seeded from the roles our plugin panels bind. Where LV2's `param:` vocabulary or `lv2:designation`
has the term, the meaning carries its name.

| Meaning | LV2 term |
|---|---|
| `gain`, `threshold`, `ratio`, `attack`, `release`, `hold`, `decay`, `frequency`, `cutoffFrequency`, `resonance`, `bypass` | `param:` of the same name |
| `wetDryRatio` (the mix of a wet and a dry signal) | `param:wetDryRatio` |
| `delay` (a delay time) | `param:delay` |
| `enabled` (on when the control is on; the inverse of `bypass`) | `lv2:enabled` |
| `range`, `knee`, `hysteresis`, `makeup`, `lookahead`, `ceiling`, `output`, `q`, `slope`, `width`, `drive`, `tone`, `rate`, `depth`, `feedback`, `spread`, `predelay`, `size`, `damping`, `lowCut`, `highCut`, `shift`, `fine`, `sync`, `division`, `listen` | none |
| `unknown` | The plugin states no meaning |

A control with no meaning in the list leaves `meaning` out and is shown by its `group` and `name`. A new meaning is
a schema minor.

## The three origins

| Origin | What | Made by | Lives in | Its links |
|---|---|---|---|---|
| `authored` | Our kernels and plugins: meaning, units, scale, come-up values | The owner, when the item is created | the contract directory, shipped by the owner | at least one `impl` into the owner's tree |
| `built` | A plugin we build whose parameter list lives only in its code (a ported or wrapped plugin) | The owner's build, from a scan of its built binary; the extras authored on top | the contract directory, shipped by the owner | `from` the built binary |
| `scanned` | Third-party CLAP and LV2 plugins | A scan on the user's machine, from the plugin's own metadata only | the console's own state directory: never the contract directory, never shipped | `from` the `.ttl` or the CLAP binary |

- An `authored` descriptor states what a person declared, so it never says `unknown`: a unit, a scale or a meaning
  of `unknown` in it is refused.
- A `built` or `scanned` descriptor writes only what the plugin states: what it does not state is `unknown`.
- The contract-directory reader refuses a `scanned` descriptor: what a machine found about itself is not a
  declaration.

## What validation refuses

A descriptor is held to the schema first; a word the schema does not have is `contract.file.invalid`. Then the
rules a schema cannot state, each with its own code in `CONTRACT_CODES` (`data/codes.json`). A refusal names the
file, the control or port, and the code; the reader refuses the whole read on the first one.

| Code | When |
|---|---|
| `contract.descriptor.origin-source` | An `authored` descriptor with no `impl` link, or a `built` or `scanned` one with a control that has no `from` link (its own or the file's). |
| `contract.descriptor.unknown-authored` | An `authored` descriptor with a unit, a scale or a meaning of `unknown`. |
| `contract.descriptor.control-duplicate` | Two controls with one `id`, one `name` or one `symbol`. |
| `contract.descriptor.port-duplicate` | Two ports of one kind and direction with one `id` (CLAP numbers audio and note ports, inputs and outputs, apart). |
| `contract.descriptor.range` | A travel whose `min` is above its `max`, whose `step` is negative, or whose `default` lies outside it. |
| `contract.descriptor.choice` | A choice whose `default` is not one of its ids, or whose `labels` or `values` are not one per id. |
| `contract.descriptor.scale-undeclared` | A scale that is neither an id of `PARAM_SCALES` nor `unknown`. |
| `contract.descriptor.port-words` | `role`, `channels` or `layout` on a port that is not audio; `dialects` on a port that is not a note port, or a note port without them; a `layout` its `channels` contradict (`mono` 1, `stereo` 2, `surround` more than 2). |
| `contract.descriptor.instrument` | An `instrument` block without the `instrument` feature or the feature without the block; an instrument without a note or MIDI input, or without an audio output. |
| `contract.descriptor.when-unresolved` | A `when` whose `control` names no choice of the descriptor, or whose `is` is not one of that choice's ids. |
| `contract.origin.misplaced` | A `scanned` descriptor installed in the contract directory. |
| `contract.descriptor.face-differs` | A plugin's built face, scanned as a host scans it, states other than its authored descriptor. The reader compares no faces: the owner's face check raises it (omx-plugins `tools/face-descriptor-check.mjs`). |

Each code has a test that breaks one fixture to raise it and reads its value back: `test/descriptor.test.mjs`,
over the example files in `test/fixtures/descriptors/`. A code another package raises, such as
`contract.descriptor.face-differs`, is named instead in `test/fixtures/codes-raised-elsewhere.json` with the
code that raises it, and the test holds that list to the registered codes.
