<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com> -->
# Building omx-contract

Needs Node.js 20 or newer and npm for the CLI and the test suite. The packages need no node to build, only `make` and
a C compiler to check the header. Three binary packages come out of one build:

| RPM | deb | Holds | Needs at run time |
|---|---|---|---|
| omx-contract-data (noarch) | omx-contract-data (Architecture: all) | what a reader reads at run time: `/usr/share/omx-contract/contract.d/3/omx-contract/`, the JSON Schema, the resolved json render, the vocabulary's schema fragment and the resource hints' Turtle | nothing |
| omx-contract-devel | libomx-contract-dev | what a build reads: the C render under `/usr/include/omxcontract`, `omx-contract.pc`, `install-contract-dir.sh` | omx-contract-data |
| omx-contract | omx-contract | the command, its vendored npm packages and its man page | node, omx-contract-data |

The paths are the ones every release installed, so no reader changes. A program that reads the contract directory or
the json render at run time requires omx-contract-data, never the development package; every other owner ships its
own directory the same way, in `<owner>-contract` (FreeMixer/omx-contract#150).

```
npm ci
make check                       # the committed C header compiles on its own, warnings as errors
make test                        # the node suite: schema, semantic checks, goldens, perturbation, semver, round trip
make install PREFIX=/usr DESTDIR=…   # headers, JSON render, schema, the contract directory and omx-contract.pc
make install-cli PREFIX=/usr DESTDIR=…   # the omx-contract command, its files under CLIDIR (/usr/lib/omx-contract), its man page
```

The goldens run over the frozen 2.14.0 kernels; CI also fetches the latest omx-dsp release (`tools/live-owner-data.sh`) and
sets `OMX_LIVE_OWNER_DATA` to its `data/`, so `test/live-owners.test.mjs` checks every kernel of the freeze against a live
owner and is red, not skipped, when it finds none. Locally: `OMX_LIVE_OWNER_DATA=$(sh tools/live-owner-data.sh /tmp/omx-dsp) npm test`.

## The CLI

```
npm ci
node bin/omx-contract.mjs validate                       # schema + semantic checks
node bin/omx-contract.mjs fmt [--check]                  # the one formatting
node bin/omx-contract.mjs render --target c|ts|json|lv2 --out <dir> [--check]
node bin/omx-contract.mjs semver <previous tag>          # exit 1 if the version bump is short
```

Exit 0 is a pass, 1 a failure naming file, item and rule, 2 a usage or environment error. A change to
`data/` is followed by `render --target c --out include`, `render --target json --out
share/omx-contract`, `render --target lv2 --out share/omx-contract` and `render --target ts --out test/golden/ts`;
CI holds all four to the data.

## Layout

```
data/                        omx-contract's own definitions, one file per group, edited by hand
  rates.json  primitives.json
schema/omx-contract.schema.json   JSON Schema 2020-12: five kinds (scalar, travels, sheet, list, set), closed units, refs, closed derivations
bin/omx-contract.mjs         the CLI
man/omx-contract.1           its man page
vendor/                      the CLI's runtime dependencies, the npm tarballs package-lock.json pins (test/vendor.test.mjs)
render/                      the c, ts and json renderers
include/omxcontract/         the committed c render (what omx-contract-devel installs)
share/omx-contract/          the committed json render (resolved data, what omx-contract-data installs)
test/                        schema, semantic checks, goldens, perturbation, semver, round trip
  fixtures/owners-2.14.0/    the definitions omx-dsp, omx-clap-core and the console now hold, at their 2.14.0 bytes (the hosting file less the two codes 3.0.0 removed): what the tests read kernels from
  fixtures/answers-2.14.0/   the kernels' answers that went with them; `make completeness` runs over both
  fixtures/package-codes/    omx-clap-core's hosting/cost.json as omx-contract held it until 2.20.0: the codes kind's fixture
recipes/kernel.recipe.json   what a complete kernel has; an owner's recipes/answers/ records where each value comes from
tools/omx-new-kernel.mjs     the kernel wizard and importer; tools/kernel-recipe.mjs is `make completeness`
packaging/ debian/           omx-contract-data (RPM and deb), the run-time data; omx-contract-devel (RPM) and libomx-contract-dev (deb),
                             the headers and pc file; omx-contract (RPM and deb), the command
```

How a kernel file is written: [docs/kernel-files.md](docs/kernel-files.md).
