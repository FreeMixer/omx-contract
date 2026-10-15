<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com> -->
# Hosting limits and refusal codes

The code that hosts a third-party plugin in a strip (the stage around the plugin and the CLAP core under it) reads
two kinds of declared fact: the numbers it limits itself to, and the codes it names a refusal by. Both are contract
data in `data/hosting.json`, so a library that hosts plugins builds from the contract and not from a tree its reader
cannot see.

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

`omx-contract render --target c` writes `omxcontract/clap_host_limits.h` beside `omx_contract_limits.h`: one
`CLAP_HOST_<FIELD>` define per core number (an integer as an unsigned literal, a level in dBFS as a float) and one
`CLAP_HOST_CODE_<NAME>` define per refusal code, each followed by its prose as a `///<` comment. The CLAP core
(omx-clap-core) commits that file, byte for byte, so it builds on its own and its source is public.
