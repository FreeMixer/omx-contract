<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com> -->
# Overrides

An override file corrects what a scan could not say about one external plugin: a unit, a scale, a meaning, a label,
a narrower range, a hidden control. It is the contract's half of the override module: the console resolves the layers
and the module writes the files. Since 3.7.0 the contract holds the file's words and the one function that applies it, so every
consumer gets the same answer.

The engine, plugin-hostd and a session never see an override. An override never changes the scan's
`paramsFingerprint`.

## The file

```json
{
  "$schema": "https://github.com/FreeMixer/omx-contract/raw/v3/schema/omx-contract.schema.json",
  "requires": { "omx-contract-schema": ">= 3.7.0" },
  "override": 1,
  "plugin": { "id": "com.example.vintage-eq", "format": "clap" },
  "against": { "version": "1.4.2", "paramsFingerprint": "5f0c" },
  "family": "eq",
  "controls": {
    "3": { "label": "Low freq", "meaning": "frequency", "band": 0,
           "travel": { "unit": "Hz", "scale": "log" }, "basis": "person" },
    "7": { "hidden": true, "basis": "person" }
  },
  "made": { "at": "2026-10-17T21:04:00+02:00", "by": "wizard", "tool": "openmixer" }
}
```

`$defs.override` holds the words and no other key stands: `override` (the major, `1`), `plugin` (`id`, `format`),
`against` (`version`, `paramsFingerprint`), `family` (a word of `PANEL_FAMILIES`), `controls` and `made`. A control is
keyed by the descriptor control's `id` (a CLAP `clap_id` as a decimal string, an LV2 port symbol) and carries `label`,
`group`, `meaning` (never `unknown`: absence means unknown), `band`, `hidden`, `travel` (`unit`, `scale`, `min`,
`max`, `default`), `map` (`points`, `unit`, `scale`), `basis` (`person`, `measured`, `starter`; required) and `evidence`
(`sha256` of the response file). A file that fails the schema is `contract.file.invalid`.

## applyOverride

`applyOverride(descriptor, layers, { paramsFingerprint })`, in `lib/descriptor.mjs` beside `descriptorProblems`,
returns `{ descriptor, family, answered, dropped, warnings, refused }`.

1. `layers` are override files, lowest first. For each control id the highest layer's entry wins whole, and so does
   `family`; a lower layer's entry for that control is not merged in.
2. A file that fails the schema or names another plugin is refused whole (`refused`); the plugin is drawn from its
   scan alone.
3. Each winning entry is checked against the descriptor. One that fails is dropped with its code (`dropped`) and the
   rest of the file stands.
4. An entry may narrow, relabel, regroup, hide, give a meaning, fill an unknown unit or scale, or correct a stated
   one; the effective control then carries `corrected: ["unit"]`. It may never widen a stated range or change a
   control's kind.
5. A file written against another `paramsFingerprint` than the scan's is a warning (`warnings`); the entries that
   still pass apply.

The effective control gains `band`, `map`, `basis`, `evidence` and `corrected` beside the descriptor's words; the
effective descriptor is a reader's view and is not itself a descriptor file.

## Codes

| Code | When | Effect |
|---|---|---|
| `contract.file.invalid` | the file fails the schema | file refused whole |
| `contract.override.plugin-mismatch` | `plugin.id` or `format` differ from the plugin | file refused whole |
| `contract.override.control-absent` | an entry names a control the descriptor does not have | entry dropped |
| `contract.override.widens` | a travel end outside the plugin's ends, or a default outside the travel | entry dropped |
| `contract.override.kind-mismatch` | a travel or map on a control that is not a travel; a `band` without `family: eq` or without an EQ meaning (`frequency`, `gain`, `q`, `slope`, `enabled`) | entry dropped |
| `contract.override.scale-floor` | `log` over a floor that is not positive, or a log map over a quantity that is not | entry dropped |
| `contract.override.map-invalid` | points not strictly monotonic in the plain value and the quantity, not running from the plugin's min to its max, or outside them | entry dropped |
| `contract.override.basis-evidence` | `basis: measured` without `evidence`, or `evidence` with another basis | entry dropped |
| `contract.override.fingerprint-differs` | `against.paramsFingerprint` differs from the scan's | warning only |

`test/override.test.mjs` raises each from a fixture of `test/fixtures/overrides/`, one file per code.
