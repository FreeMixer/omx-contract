<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com> -->
# Kernel files and the JSON render

How a declaration is written and what the JSON render carries. The schema is
`schema/omx-contract.schema.json`; `omx-contract validate` holds the data to it.

## The kernel file

A kernel file, `data/kernels/<kernel>.json`, holds four sections that declare items, and the kernel's readouts,
and nothing else. A sketch, values abridged
(the tremolo's controls, a gate table, a constant):

```json
{
  "$schema": "../../schema/omx-contract.schema.json",
  "controls": [
    { "name": "rateHz", "kind": "travel", "global": "TREMOLO_RATE_RANGE", "doc": "…", "travel": { "min": 0.1, "max": 20, "unit": "Hz", "default": 5 } },
    { "name": "depth", "kind": "travel", "doc": "…", "travel": { "min": 0, "max": 1, "unit": "", "default": 0.5 } },
    { "name": "mode", "kind": "choice", "doc": "…", "ids": ["tremolo", "pan"], "labels": ["Tremolo", "Pan"] },
    { "name": "thresholdDb", "kind": "travel", "table": "GATE_LIMITS", "travel": { "min": -80, "max": 0, "unit": "dB" } }
  ],
  "tables": { "GATE_LIMITS": { "doc": "…" } },
  "aggregates": { "TREMOLO_TRAVELS": { "doc": "…", "fields": ["rateHz", "depth"] } },
  "constants": { "CHORUS_BASE_MS": { "kind": "scalar", "doc": "…", "unit": "ms", "value": 10 } }
}
```

- `controls`, in order: a `travel` (one travel) or a `choice` (ordered `ids`, an optional `default` and `labels`).
  Its item name is `<KERNEL>_<NAME>_RANGE` for a travel and `<KERNEL>_<NAME>S` for a choice (`depth` in
  tremolo.json is `TREMOLO_DEPTH_RANGE`, `mode` is `TREMOLO_MODES`); `global` names it when it is anything else.
  A control with a `table` is one field of that table. `"rearms": true` marks a control whose change re-arms the
  kernel's state, so it is not a smooth parameter (the limiter's `lookaheadMs`: omx-dsp's limiter face re-arms
  the state and restarts the gain at unity when the look-ahead moves by a frame). It is a boolean, only on a
  control; it is no item, so the C and TypeScript renders do not carry it.
- A USE is a control with a `global` and no `travel` or `ids`: it takes the item another control of the kernel
  declares, of its kind, and adds no item (the EQ's `lpfSlope` takes FILTER_SLOPES, which `hpfSlope` declares).
- `count` names the item that counts a control the kernel takes once per band: a positive integer scalar
  (`GEQ_BANDS`), or a sheet whose every variant gives its count as `max` (`EQ_BAND_COUNTS.eq8.max`).
- `of` and `when` mark a travel that is no control of its own but the travel the control `of` names reaches while
  the choice `when.control` holds `when.is` (the EQ's `notchQ`: the Q's travel while the band is a notch).
- A choice of named ids may carry `values`, one per id in id order, in its `unit`, `null` for an id that carries
  none: the drive's `hfRolloff` ids are `off`, `12000`, `16000` and their `values` `null`, 12000, 16000 Hz. The id
  stays the name a host stores; a kernel reads the number from the value, never from the id's spelling.
  The json render carries `values` and `unit` on the item, the ts render exports `<SET>_VALUES` (`{ <id>: value |
  null }`), and the C render `OMX_<SET>_UNIT`, `OMX_<SET>_<ID>_VALUE` and `omx_<set>_value(id, &out)`, which returns 1
  and writes the value, or returns 0 for an id that carries none.
- A choice's `default` may be `{ "ref": … }` to the scalar that states it; a boolean names the second id of a
  two-id switch when true, the first when false (the delay's `pingpong` comes up at FX_DELAY_PINGPONG_DEFAULT).
- `tables`: a travels table whose fields are the controls that name it, in control order (`GATE_LIMITS`).
- `aggregates`: a travels table whose fields are references to controls declared once above, listed by name.
- `constants`: scalars, lists and sheets, as items. A travels table with fields of its own that is no control of the
  kernel (a plugin host's continuous travels of a kernel, `GATE_CONTINUOUS_TRAVELS`) is no constant: it is an item of
  its own file beside the kernels, `primitives/<item>.json`, an item map like `primitives.json`.
- `readouts`, after the controls: the meters the kernel reports, in order, each `{ name, doc, unit, min, max, scale,
  rateHz }`. A readout is no item; `docs/readouts.md` is what each key means and how C and TypeScript render it.

Shapes a kernel file's items take beyond the sketch:

- A travel may carry `byKind`, a map from a strip kind (`fxReturn`) to the come-up value that kind has instead of
  `default`; each value lies inside `min`..`max`. The C render writes each as `OMX_<ITEM>_BY_KIND_<KIND>` (the
  delay's mix on an FX return, `OMX_DELAY_MIX_RANGE_BY_KIND_FX_RETURN`), the JSON render carries the map, and a
  host with no entry for its kind reads `default`. The name is `byKind` in the schema and in the semver check.
- A `scalar` is a number or a boolean (`FX_DELAY_PINGPONG_DEFAULT` is a boolean); a choice's `default` may point
  at one, as above.
- A `travels` item holds either `fields` (a table of travels, or references to controls declared once) or a single
  `travel`; the single travel is the item's value directly, and it is the one shape `c.alias` applies to.
- A `list` of numbers renders to C as a count and an initialiser (`OMX_<LIST>_COUNT`, `OMX_<LIST>_INIT`) unless it
  carries `"c": { "render": false }`, which keeps it in the JSON and TypeScript renders only. No list declared
  today sets it; it is the way to declare a list a C reader has no use for.
- A renamed `list` keeps its old name for one release with `"formerly": { "name": "<OLD>", "removedIn": "x.y.z" }`,
  so its readers move to the new name in their own release instead of in lockstep. The C render defines
  `OMX_<OLD>_COUNT` and `OMX_<OLD>_INIT` as the new list's own defines, the TypeScript render exports `<OLD>` bound
  to the new export and marked `@deprecated`, and the JSON render lists it under `formerNames` with the item to read
  instead. None of them repeats the values. `test/formerly.test.mjs` fails once the package version reaches
  `removedIn` while the word is still there, so the release that removes the name cannot forget it. `readers` names
  the registered consumers (`DEVELOPMENT_PHASE` in `lib/semver.mjs`) whose main still reads the old name; while it
  names one, the same test fails as soon as the package version reaches `removedIn`, and the fix is to move
  `removedIn` later, never to drop the alias under a reader.
- The repository commits its renders: `include/omxcontract/` (C), `share/omx-contract/` (JSON) and
  `test/golden/ts/` (TypeScript). CI regenerates each with `render --check` and fails on any byte of difference,
  so a data change and its renders land in one commit.

`omx-contract validate` refuses any other key, a constant that is a travel or a set, and a kernel file written
as a flat item map (the 1.x shape). `rates.json` and `primitives.json` stay item maps.

## The JSON render's kernels

Beside `items`, `share/omx-contract/omx-contract.json` carries `kernels`: for every kernel file, its controls in
the order the file declares them. A consumer reads control order and kinds here, never from a kernel file.

```json
"kernels": {
  "limiter": {
    "controls": [
      { "name": "ceilingDb", "kind": "travel", "global": "LIMITER_LIMITS", "table": "LIMITER_LIMITS" },
      { "name": "lookaheadMs", "kind": "travel", "global": "LIMITER_LIMITS", "table": "LIMITER_LIMITS", "rearms": true },
      { "name": "releaseMs", "kind": "travel", "global": "LIMITER_LIMITS", "table": "LIMITER_LIMITS" }
    ]
  },
  "tremolo": {
    "controls": [
      { "name": "rateHz", "kind": "travel", "global": "TREMOLO_RATE_RANGE" },
      { "name": "mode", "kind": "choice", "global": "TREMOLO_MODES" }
    ]
  }
}
```

- `kind`: `travel` or `choice`.
- `global`: the item the control's value lives in: `items[global].value` for a travel or a choice, and
  `items[global].value[name]` for a field of a table, when `table` (the same item) is present.
- `rearms`: present, and `true`, only on a control that declares it.
- `count`: present on a control taken once per band, the item that counts it.
- `when`: on a control another one is `of`, the list `{ control, is, global }`: while `control` holds `is`, the
  control's travel is `items[global]` (the EQ's `q` reaches EQ_NOTCH_Q_RANGE on a notch). A control that is `of`
  another is not listed on its own. A use is listed like any control, its `global` the item it takes.

A kernel with no controls (mixmatrix, rta) is listed with an empty `controls`. A kernel that declares readouts
carries `readouts` too, in their declared order, every reference resolved:

```json
"gate": {
  "controls": [ … ],
  "readouts": [
    { "name": "gainReductionDb", "doc": "…", "unit": "dB", "min": -90, "max": 0, "scale": "linear", "rateHz": 50 }
  ]
}
```

## What `semver` judges

`omx-contract semver` compares two resolved declarations, the data only, and names the bump the difference needs.
`lib/semver.mjs` holds the rules, and is the authority where this summary is short:

- MAJOR: a field, alias, `byKind` entry, set's `values` or code removed; a unit or kind changed; a travel
  narrowed; a default added to or removed from a travel or a set; a constant a kernel computes with changed (a
  scalar, a sheet leaf, a derived value, a list member, a set id, a value an id carries, a code); a list taken out
  of the C render; a readout removed, renamed or moved, or its unit changed.
- MINOR: an item, field, sheet leaf, list member, set id, `byKind` entry, alias or readout added; a set's `values`
  added; a travel widened; a default moved (inside its travel, or to another id of its set); a step,
  `defaultFrom`, scale or `byKind` value changed; a readout's range, scale or rate changed.
- PATCH: doc and why text, and a set's labels.

The development phase: while every consumer is one of the FreeMixer repositories `DEVELOPMENT_PHASE` names
(omx-clap-core, omx-dsp, omx-plugins, plugin-qualify and the console engine), an item or a readout removed is MINOR,
and a release whose changes the check finds MAJOR passes with a minor bump. The pull request that makes such a change
says why it is released as a minor. The phase ends, and the rule with it, in the release that names the first consumer outside the list.

It does not look at how the renders are produced. Two kinds of change are judged by hand, by the reviewer of the
pull request that makes them: a change to the naming scheme of the rendered symbols (`OMX_<ITEM>_…` in C, the
exported constants in TypeScript), which breaks every consumer that spells a name and is a MAJOR change; and a
change to the renderers that leaves every rendered byte as it was, which is a PATCH. A renderer change that does
alter the bytes shows up as a change to the committed renders and is judged by what a consumer reads there.
