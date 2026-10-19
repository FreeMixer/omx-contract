<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com> -->
# The data directory: one domain per file, placed by rule

`data/` holds the vocabulary and the facts no single package implements. Every file is an item map read by
`lib/data.mjs` and validated by the one schema; nothing else declares these words. The words are our own,
name-compatible with LV2 and CLAP: a word borrows the name the format already gives it, and the format's whole
vocabulary is mapped beside them, so a word is there before a consumer asks for it.

## The tree

```
data/
  codes.json                   CONTRACT_CODES, the reader's own refusals (a tool table: not installed, not rendered)
  primitives.json  rates.json  the parameter scales, the readout rate, the sample rates
  hosting/<dimension>.json     HOSTING_<DIMENSION>_CODES: every hosting.<dimension>.* code
  hosting/realised.json        HOSTING_REALISED_CODES: hosting.realised.* and the outcomes with no dimension
                               (hosting.disabled, hosting.unjudged, hosting.no-realisation, hosting.linked)
  measurement.json             MEASUREMENT_*: how a figure was taken, why it is absent, what a verdict says
  resource-profile.json        RESOURCE_*: what a host plans a plugin for, and the host profile's budget shape
  machine-class.json           MACHINE_*: the machine a figure was taken on, and the classes a profile names
  formats/lv2/<spec>.json      LV2_<SPEC>_TERMS: the terms of the LV2 specification bundle <spec>.lv2
  formats/clap/<header>.json   CLAP_<HEADER>_TERMS: the identifiers of the CLAP header clap/<header>.h
                               (formats/clap/events.json, ext/params.json, ext/draft/scratch-memory.json, ...)
inventory/lv2.json  clap.json  the formats as installed, written by tools/format-inventory.mjs, never by hand
```

## Where a new word goes

| A word that is | Goes in | Its item |
|---|---|---|
| a hosting code `hosting.<dimension>.<reason>` | `hosting/<dimension>.json` | `HOSTING_<DIMENSION>_CODES`, kind `codes` |
| a hosting code with no dimension, `hosting.<reason>`, or `hosting.realised.<reason>` | `hosting/realised.json` | `HOSTING_REALISED_CODES` |
| a word of the measurement format: a method, an absent figure's reason, a rating | `measurement.json` | `MEASUREMENT_<LIST>`, kind `words` |
| a resource a host plans for, its unit, its basis, a budget's scope | `resource-profile.json` | `RESOURCE_<LIST>`, kind `words` |
| a field of a machine class, a band, a named class | `machine-class.json` | `MACHINE_<LIST>`, kind `words` |
| an LV2 term `<spec URI>#<name>` | `formats/lv2/<spec>.json`, `<spec>` the bundle it is defined in | `LV2_<SPEC>_TERMS`, kind `terms` |
| a CLAP identifier declared in `clap/<header>.h` | `formats/clap/<header>.json` | `CLAP_<HEADER>_TERMS`, the path in upper snake case |

`<DIMENSION>`, `<SPEC>` and `<HEADER>` are the file's path below its domain directory in upper snake case
(`rt-safety` is `RT_SAFETY`, `ext/draft/scratch-memory` is `EXT_DRAFT_SCRATCH_MEMORY`). A file holds the items of its
domain only: `test/data-layout.test.mjs` fails on a hosting code outside `hosting/<its dimension>.json`, an LV2 URI
outside the file of its specification, a CLAP identifier outside the file of its header, and an item whose name is
not the one its path gives.

## Inside a file

- A `codes` item's codes are sorted by name; the name is the operator-facing key a consumer reads the code by, unique
  across every file of `hosting/`, and the code is never reworded. A removed or changed code is a MAJOR change, an
  added one MINOR.
- A `words` item's words keep their declared order, which is part of the contract (a rating's severity, a band's
  ascent). A word may name its `group`, a word of the item its `groups` names, and the format terms it is
  name-compatible with (`from: ["LV2_CORE_TERMS#latency", "CLAP_EXT_LATENCY_TERMS#latency"]`); each resolves.
- A `terms` item's terms are sorted by name (`omx-contract fmt` sorts them). The name is the format's own: an LV2
  term's local name (the specification's own URI is named after its bundle), a CLAP string constant's text less
  `clap.`, any other CLAP identifier in lowerCamel less `CLAP_`. Beside the name stands the URI or the identifier, so
  the mapping reads against the format one line at a time.

## A term's status

Every term carries one:

| Status | Means | Carries |
|---|---|---|
| `used` | a consumer reads or writes it today | `by`: the consumers' files, `<repository>:<path>` |
| `supported-later` | we will support it | `issue`: the issue that brings it |
| `out-of-scope` | we will not support it | `ruling`: why, with its source; `by` may still name a consumer that reads it to refuse it |

`word` names the contract's own word a term maps onto where the descriptor has one (LV2 `units:db` is the unit
`dB`, CLAP `CLAP_NOTE_DIALECT_MIDI_MPE` the dialect `midiMpe`). `deprecated` marks a term the format itself
deprecates.

## The inventory

`node tools/format-inventory.mjs` reads the installed LV2 bundles (through `serdi`) and CLAP headers and writes
`inventory/lv2.json` and `inventory/clap.json` with the versions they were read from; `--check` compares instead.
`test/format-coverage.test.mjs` holds the mapping equal to the inventory: every term of the inventory is mapped with
a status, and no mapped term is missing from it. When a newer LV2 or CLAP is installed, refresh the inventory and
map what it adds; the test names each term.

## The renders

The whole read renders the vocabulary generically, by kind, for the items of every file that carries no `render`
word of its own (docs/render.md): `omxcontract/omx_vocabulary.h`, a string define per code (`OMX_` and the code in
upper snake case) and per word (`OMX_<ITEM>_<NAME>`) with each words item's `_COUNT` and `_INIT`;
`omx-vocabulary.schema.json`, a JSON Schema fragment with one `$defs.<ITEM>.enum` per codes and words item, for a
schema that references the words instead of repeating them; and the ts module's `<ITEM>_WORDS`, each words item's
words in order. A `terms` item is rendered to JSON and TypeScript only.
