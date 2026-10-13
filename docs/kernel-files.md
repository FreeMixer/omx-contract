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
- A choice's `default` may be `{ "ref": … }` to the scalar that states it; a boolean names the second id of a
  two-id switch when true, the first when false (the delay's `pingpong` comes up at FX_DELAY_PINGPONG_DEFAULT).
- `tables`: a travels table whose fields are the controls that name it, in control order (`GATE_LIMITS`).
- `aggregates`: a travels table whose fields are references to controls declared once above, listed by name.
- `constants`: scalars, lists and sheets, as items.
- `readouts`, after the controls: the meters the kernel reports, in order, each `{ name, doc, unit, min, max, scale,
  rateHz }`. A readout is no item; `docs/readouts.md` is what each key means and how C and TypeScript render it.

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

A kernel with no controls (fbs, mixmatrix, rta) is listed with an empty `controls`. A kernel that declares readouts
carries `readouts` too, in their declared order, every reference resolved:

```json
"gate": {
  "controls": [ … ],
  "readouts": [
    { "name": "gainReductionDb", "doc": "…", "unit": "dB", "min": -90, "max": 0, "scale": "linear", "rateHz": 50 }
  ]
}
```
