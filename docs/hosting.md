<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com> -->
# Hosting limits and refusal codes

The code that hosts a third-party plugin in a strip (the stage around the plugin and the CLAP core under it) reads
two kinds of declared fact: the numbers it limits itself to, and the codes it names a refusal by. Both are declared
by the CLAP core, omx-clap-core, in its own `data/hosting.json`, and installed into the contract directory as its
package (docs/contract-dir.md); omx-contract holds the words they are written in and the tool that renders them. The
tool's tests read that file as it stood in 2.14.0, with its render word, from `test/fixtures/owners-2.14.0/`, less the
two refusal codes 3.0.0 removed from omx-clap-core (they and their two `CLAP_HOST_CODE_` defines left the fixture and
its header with them).

## The stage limits

`HOSTED_STAGE_LIMITS` is a sheet of numbers: the warm-up before a stage is published, the blocks of non-finite output
that strike it, the level its output is clamped at, the depth of the parameter queue, the polls and timeouts of the
hand-over between threads, the port counts the core accepts, and the caps on a plugin's state, log and parameter
count. Its optional `docs` object gives each field one line of prose; a field without one has none.

The numbers whose field name starts with `worker` belong to the LV2 adapter, not to the CLAP core.

## The refusal codes

`HOSTING_CODES` is a `codes` item: the refusals the CLAP core returns, each a lowerCamel name, its code (a string
`hosting.<group>.<reason>`, all lower case) and optionally one line of prose. A code is never reworded: a verdict
that names it is read by code. A changed code is a MAJOR change, an added one MINOR; a removed one is MAJOR outside
the development phase and MINOR in it, and a code its writers stop writing is removed, never carried
(docs/data-layout.md).

## Every hosting code, in the core

More than one package writes or reads a hosting code (the qualifier in its verdicts, the CLAP core and its LV2
adapter in their refusals, the console when it renders them), so every one of them is declared once, by the CLAP
core: omx-clap-core's own `data/hosting/`, one file per dimension (`HOSTING_STABILITY_CODES`,
`HOSTING_RT_SAFETY_CODES`, `HOSTING_TOPOLOGY_CODES` and the rest, with `HOSTING_REALISED_CODES` for what the console
did with a verdict), installed as `contract.d/3/omx-clap-core/hosting/`. omx-contract declared them in its own
`data/hosting/` until 2.20.0; 3.0.0 moved the 16 files to omx-clap-core byte for byte and holds no hosting code. Each
code's name is the operator-facing key a consumer reads it by, unique across the files. omx-clap-core renders them
with `omx-contract render --target c|ts --package omx-clap-core` (docs/render.md), as `omx_clap_core_vocabulary.h`
and its ts module, with the C names omx-contract's `omx_vocabulary.h` gave them.

## The render

The file's `render` word (docs/render.md) declares the CLAP core's own renders of these two items: `clap_host_limits.h`,
one `CLAP_HOST_<FIELD>` define per core number (an integer as an unsigned literal, a level in dBFS as a float; the
`worker*` fields left out) and one `CLAP_HOST_CODE_<NAME>` define per refusal code, each followed by its prose as a
`///<` comment; `hosted_stage_limits.h`, every number as `OMX_HOSTED_STAGE_<FIELD>`, the worker fields included; and a
TypeScript module of both items. omx-clap-core renders them with `omx-contract render --target c|ts --package
omx-clap-core` and commits them, byte for byte, so it builds on its own and its source is public; the render of a whole
read writes `clap_host_limits.h` as `omxcontract/clap_host_limits.h` beside `omx_contract_limits.h`.
