<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com> -->
# The resource hints: what a plugin declares about its own footprint

A host plans for every resource of a plugin (`RESOURCE_KINDS`). CLAP and LV2 already carry some of them
(`clap.latency`, `clap.tail`, `clap.voice-info`, `clap.scratch-memory/1`, `clap.thread-pool`, `lv2:latency`, the LV2
worker, options and buf-size); the rest a plugin states in openmixer's own hints, which this contract declares once
(FreeMixer/omx-contract#119, FreeMixer/plugin-qualify#116). A hint is a claim: plugin-qualify measures the same
resource and a declared figure that the measurement does not bear out is a finding.

## The declaration

`RESOURCE_HINTS`, a `words` item of `data/resource-profile.json`. Each word is one hint, in the order that is part of
the contract:

| Word property | Meaning |
|---|---|
| `word` | The hint's name as it is written on the wire. |
| `group` | The resource it declares, a word of `RESOURCE_KINDS` (the item's `groups`). |
| `figureUnit` | The unit of its figure, a word of `RESOURCE_UNITS` (the item's `units`). |
| `basis` | How its figure is known, a word of `RESOURCE_BASES` (the item's `bases`); a hint is `declared`. |
| `from` | The CLAP or LV2 terms it is name-compatible with, where there are any. |

The item's `extension` word names the two carriers: `clap`, the extension id, and `lv2`, the prefix and the
namespace the properties live in. The schema (3.1.0) takes `units`, `bases` and `extension` on a words item and
`figureUnit` and `basis` on a word; the validator refuses (rules `word-unit`, `word-basis`) a unit or basis that is no word
of the item named, and (rule `extension`) an extension whose item carries no hint.

The hints: `footprint-at-rest` and `footprint-per-voice` and `shared-load` (bytes), `threads-spawned` (count),
`streams-from-disk` and `opens-sockets` (flag), `activate-time` (ms).

## The carriers, each rendered from the declaration

| Carrier | File | Command |
|---|---|---|
| CLAP draft `org.openmixer.resource-hints.draft/0` | `include/omxcontract/omx_resource_hints.h` | `render --target c` |
| LV2 properties in the openmixer namespace | `share/omx-contract/omx-resource-hints.ttl` | `render --target lv2` |
| TypeScript | `RESOURCE_HINTS` and `RESOURCE_HINTS_WORDS` in the ts module | `render --target ts` |
| JSON | the item in `omx-contract.json`, its enum in `omx-vocabulary.schema.json` | `render --target json` |

The CLAP header declares the extension id, one bit per hint in the order of the declaration
(`OMX_RESOURCE_HINT_<NAME>`), and the structure a plugin fills: one member per hint, typed by its unit (bytes a
`uint64_t`, a count and a time in milliseconds a `uint32_t`, a flag a `bool`), and `declared`, the mask of the hints
the plugin states (a mask name; the word `declared` of `RESOURCE_BASES` is the hint's basis, how a figure is known, and
the two are unrelated). A hint whose bit is clear is unknown, never zero: a host reads an unknown resource as unknown, and
omx-clap-core's host reads the structure from the plugin's `get_extension`. The header carries no function the
plugin must export beyond `get`, and no CLAP code leaves omx-clap-core.

The Turtle file declares the prefix and one property per hint, with its resource, unit and basis, its range, and the
LV2 specification term it is name-compatible with where `from` names one. A plugin states a hint in the bundle's
manifest or its plugin file as a triple of that property.

## Conformance

`test/resource-hints.test.mjs` holds each carrier equal to the declaration: the header's bit order, member and type
per hint, the Turtle's property per hint, the ts and JSON words, and the committed files to a fresh render. Each
carrier has a sabotage in the test: change the carrier, watch the check go red.
