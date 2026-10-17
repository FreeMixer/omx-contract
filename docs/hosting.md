<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com> -->
# Hosting limits and refusal codes

The code that hosts a third-party plugin in a strip (the stage around the plugin and the CLAP core under it) reads
two kinds of declared fact: the numbers it limits itself to, and the codes it names a refusal by. Both are declared
by the CLAP core, omx-clap-core, in its own `data/hosting.json`, and installed into the contract directory as its
package (docs/contract-dir.md); omx-contract holds the words they are written in and the tool that renders them. The
tool's tests read that file as it stood in 2.14.0, with its render word, from `test/fixtures/owners-2.14.0/`.

## The stage limits

`HOSTED_STAGE_LIMITS` is a sheet of numbers: the warm-up before a stage is published, the blocks of non-finite output
that strike it, the level its output is clamped at, the depth of the parameter queue, the polls and timeouts of the
hand-over between threads, the port counts the core accepts, and the caps on a plugin's state, log and parameter
count. Its optional `docs` object gives each field one line of prose; a field without one has none.

The numbers whose field name starts with `worker` belong to the LV2 adapter, not to the CLAP core.

## The refusal codes

`HOSTING_CODES` is a `codes` item: the refusals the CLAP core returns, each a lowerCamel name, its code (a string
`hosting.<group>.<reason>`, all lower case) and optionally one line of prose. A code is never reworded: a verdict
that names it is read by code. A removed or changed code is a MAJOR change, an added one MINOR.

## The render

The file's `render` word (docs/render.md) declares the CLAP core's own renders of these two items: `clap_host_limits.h`,
one `CLAP_HOST_<FIELD>` define per core number (an integer as an unsigned literal, a level in dBFS as a float; the
`worker*` fields left out) and one `CLAP_HOST_CODE_<NAME>` define per refusal code, each followed by its prose as a
`///<` comment; `hosted_stage_limits.h`, every number as `OMX_HOSTED_STAGE_<FIELD>`, the worker fields included; and a
TypeScript module of both items. omx-clap-core renders them with `omx-contract render --target c|ts --package
omx-clap-core` and commits them, byte for byte, so it builds on its own and its source is public; the render of a whole
read writes `clap_host_limits.h` as `omxcontract/clap_host_limits.h` beside `omx_contract_limits.h`.
