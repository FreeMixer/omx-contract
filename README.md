<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com> -->
# omx-contract

The FreeMixer declarations as data: what a value may be (a travel, a default, a kernel constant, a
list), as JSON validated by a JSON Schema, rendered by one CLI into
every language that reads it. Governed by openmixer's
`docs/design/specs/2026-10-05-omx-contract.md`; 1.0.0 carries the phase-1 items of its §4.1, what
omx-dsp needs, 1.1.0 adds the flanger, de-esser, phaser, rotary, tremolo and graphic EQ kernels, and
1.2.0 the chorus, drive, EQ, reverb and pan travels omx-dsp and omx-plugins still kept locally, and
1.3.0 everything else more than one repository reads: the feedback detector, ring correction and
RTA constants, the EQ band budget, the choice enums (as the `set` kind), the EQ band counts and the
one rule that gives a fresh EQ its bands, the measurement rate sets and the bus input cap. What is
declared here is declared nowhere else: the EQ band budget that 1.2.0 left in openmixer is here too.
2.0.0 changes how a kernel file is written, not what it declares: every render is the same.
2.1.0 adds each kernel's ordered controls to the JSON render, and a control's `rearms` flag.
2.2.0 declares the controls an instance has that were missing: the delay's ping-pong, the drive's auto-gain, stereo
link and HF roll-off, the compressor's kind and detector oversampling, and an EQ instance's switches, slopes and
per-band controls (a control's `count`, a use, `of` and `when`, and a default by reference).
2.3.0 declares the input trim as a kernel, `trim`, whose one control is the console's TRIM_RANGE.

```
data/                        the declaration, one file per group, edited by hand
  rates.json  primitives.json  kernels/<kernel>.json
schema/omx-contract.schema.json   JSON Schema 2020-12: five kinds (scalar, travels, sheet, list, set), closed units, refs, closed derivations
lib/eq-defaults.mjs          the one default rule for a fresh EQ's bands; the ts and c renders carry it
bin/omx-contract.mjs         the CLI
render/                      c.mjs (openmixer's renderer, moved unchanged, under c/), ts.mjs, json.mjs
include/omxcontract/         the committed c render (what omx-contract-devel installs)
share/omx-contract/          the committed json render (resolved data)
test/                        schema, semantic checks, goldens, perturbation, semver, round trip
tools/proof/round-trip.mjs   the spec §4.4 steps 1 and 2 proof against omx-dsp v0.1.3
recipes/kernel.recipe.json   what a complete kernel has; recipes/answers/ cites each value in the engine
tools/omx-new-kernel.mjs     the kernel wizard and importer; tools/kernel-recipe.mjs is `make completeness`
tools/seed/                  the one-time seed from openmixer's built core (provenance; never run by CI)
packaging/ debian/           omx-contract-devel (RPM), libomx-contract-dev (deb)
```

## The kernel file

A kernel file, `data/kernels/<kernel>.json`, holds four sections and nothing else. A sketch, values abridged
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
- A choice's `default` may be `{ "ref": … }` to the scalar that states it; a boolean names the second id of a
  two-id switch when true, the first when false (the delay's `pingpong` comes up at FX_DELAY_PINGPONG_DEFAULT).
- `tables`: a travels table whose fields are the controls that name it, in control order (`GATE_LIMITS`).
- `aggregates`: a travels table whose fields are references to controls declared once above, listed by name.
- `constants`: scalars, lists and sheets, as items.

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

A kernel with no controls (fbs, mixmatrix, rta) is listed with an empty `controls`.

## The CLI

```
npm ci
node bin/omx-contract.mjs validate                       # schema + semantic checks
node bin/omx-contract.mjs fmt [--check]                  # the one formatting
node bin/omx-contract.mjs render --target c|ts|json --out <dir> [--check]
node bin/omx-contract.mjs semver <previous tag>          # exit 1 if the version bump is short
```

Exit 0 is a pass, 1 a failure naming file, item and rule, 2 a usage or environment error. A change to
`data/` is followed by `render --target c --out include`, `render --target json --out
share/omx-contract` and `render --target ts --out test/golden/ts`; CI holds all three to the data.

## Consuming it

Pin one version (`omx-contract 2.3.0` in `.github/pins.txt`) and build against its renders, committing
none: the installed `omx-contract-devel` / `libomx-contract-dev` at exactly that version
(`pkg-config --exact-version=2.3.0 omx-contract`), else the release's npm tarball, unpacked, and
`omx-contract render --target c --out build/omx-contract/include`. Include
`<omxcontract/omx_contract_limits.h>`. A plugin's parameter header is rendered by omx-plugins from its
declaration, by reference to the kernel travels here (since 1.1.0).

The npm package is `@openmixer/omx-contract` on npmjs.org (the `ts` render is its main export); every
GitHub release also carries the `npm pack` tarball, the RPMs and the debs.

## License

GPL-3.0-or-later. JSON cannot carry an SPDX comment; every data file is covered by `LICENSE`.
