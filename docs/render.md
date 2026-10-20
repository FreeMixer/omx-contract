<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com> -->
# The render word: an owner's own renders

A package that owns definitions commits the C headers and the TypeScript module of its own items, held equal to them
by `render --check`. How they are framed and spelled is declared beside the items, in a file's `render` word, and the
tool reads the word. The tool itself names no item: an owner's spelling lives in the owner's files and nowhere else.

```json
{ "$schema": "../schema/omx-contract.schema.json",
  "requires": { "omx-contract-schema": ">= 2.15.0" },
  "render": {
    "c": [
      { "header": "clap_host_limits.h", "guard": "CLAP_HOST_LIMITS_H", "project": "omx-clap-host",
        "banner": ["Rendered from HOSTED_STAGE_LIMITS and HOSTING_CODES of data/hosting.json, ..."],
        "brief": "The limits and refusal codes of the hosting code.", "includes": ["stddef.h"],
        "numbers": { "comment": "the stage and the host: every number the core reads", "prefix": "CLAP_HOST_",
                     "omit": ["worker*"], "levels": "*Dbfs" },
        "codes": { "comment": "the refusals the core returns", "prefix": "CLAP_HOST_CODE_" } },
      { "header": "hosted_stage_limits.h", "guard": "HOSTED_STAGE_LIMITS_H", "project": "omx-clap-host",
        "banner": ["..."], "brief": "The hosted stage's numbers, as the OMX_HOSTED_STAGE_ names a host reads.",
        "scalars": { "comment": "every number of the stage, sorted by name" } } ],
    "ts": { "module": "omx-clap-core-hosting" } },
  "HOSTED_STAGE_LIMITS": { "kind": "sheet", ... },
  "HOSTING_CODES": { "kind": "codes", ... } }
```

## A header

| Word | Meaning |
|---|---|
| `header` | The header's path, under the output directory of `render --package`. |
| `guard` | The include guard. |
| `project` | The project its licence block names ("This file is part of ..."). |
| `banner` | The lines of the GENERATED comment after its first line: what the file is rendered from, in the owner's words. |
| `brief` | The `@brief` of its `@file` block. |
| `includes` | System headers it includes, in order. Optional. |
| `scope` | Which items its sections read: `file` (the default), the items of the file that declares it; `package`, every item of its package. |

and one section or more, in this order:

| Section | What it renders |
|---|---|
| `numbers` `{ comment, prefix, omit?, levels? }` | Every sheet: field `f` as `<prefix><F>`, `F` in upper snake case; a field matching `levels` (a glob) is a level, a float literal, every other a non-negative integer, an unsigned literal; fields matching `omit` are left out. Each define carries the field's `docs` line as a trailing `///<` comment. |
| `codes` `{ comment, prefix }` | Every codes item: code `n` as `<prefix><N>`, a string literal, with its `doc`. |
| `scalars` `{ comment }` | Every number spelled `OMX_<macro>` as `omx_contract_limits.h` spells it, sorted by macro. |
| `limits` `{ comment? }` | Every section of `omx_contract_limits.h`, the same defines under the same comments: the tables, aliases, scalars, lists, sets, readouts and the default EQ rule. With `scope: package` this is an owner's whole header (omx-dsp's `omxdsp/omxdsp_definitions.h`). |

A glob is a name, its start (`worker*`), its end (`*Dbfs`) or a part (`*Ring*`). `validate` refuses (rule `render-c`)
a section with nothing to render, a number that is neither a level nor a non-negative integer, a prose of more than one
line and two files that declare one header; the schema refuses an unknown word.

## The module

`ts.module` names the TypeScript module of the file's items: `<module>.js` and `<module>.d.ts`, each item exported
under its name with its literal type, as the whole ts render writes it; two files naming one module are refused.

## Rendering

```sh
omx-contract render --target c|ts --package <owner> --out <dir> [--check] [--data data | --contract-dir <dir>]
```

`--package` renders only that package's headers (c) or modules (ts), at their paths under `--out`; `--check` compares
exactly those files, so the owner's other files beside them are never reported as extra. Read from a contract
directory the package is one installed there; read from `--data` the data directory is the owner's own tree and is the
package named. Every reference resolves over the whole read. The json render is the whole read and takes no
`--package`.

Beside its headers and modules, `--package` renders the package's vocabulary: every codes and words item of its files
that carry no `render` word, spelled by kind exactly as the whole read spells it (docs/data-layout.md), so a file moves
between packages byte for byte and its C names do not change. A code is `OMX_` and the code in upper snake case, never
its key; a word is `OMX_<ITEM>_<NAME>`, each words item with its `_COUNT` and `_INIT`. The c target writes
`<stem>_vocabulary.h` (guard `<STEM>_VOCABULARY_H`), the ts target `<stem>-vocabulary.js` and `.d.ts` (each item
exported under its name, and `<ITEM>_WORDS`), at the top of `--out`. The stem is the package's name, `omx` for
omx-contract: `render --target c --package omx-contract --out include/omxcontract` is `omx_vocabulary.h` byte for byte,
and omx-clap-core's is `omx_clap_core_vocabulary.h`, guard `OMX_CLAP_CORE_VOCABULARY_H`, so the two include together.
A package with no such item renders no vocabulary file.

The render of a whole read (no `--package`) writes `omxcontract/omx_contract_limits.h` and, beside it as
`omxcontract/<header>`, every declared header that spells no `OMX_` name (no `scalars`, no `limits`): the layout
omx-contract 2.14.0 installed. Beside them it writes `omxcontract/omx_vocabulary.h`, and the json render
`omx-vocabulary.schema.json`, from every codes and words item of a file with no render word (docs/data-layout.md). An owner's items are items like any other, so their `OMX_` defines are in
omx_contract_limits.h of a whole read once, not a second time. A define of a package header whose value names another
package's (a readout's `OMX_PARAM_SCALES_*` scale) needs that package's header included first.

## Links

`omx-contract links --check` takes a C name a header spells as naming its item, as it takes `OMX_<NAME>`: an `impl`
link to a function that reads `CLAP_HOST_CLAMP_DBFS` names `HOSTED_STAGE_LIMITS`; an omitted field is no name of it
(docs/contract-dir.md).
