<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com> -->
# Building omx-contract

Needs Node.js 20 or newer and npm for the CLI and the test suite. The data package (omx-contract-devel,
libomx-contract-dev) needs no node, only `make` and a C compiler to check the header; the command package
(omx-contract, RPM and deb) needs node at run time and nothing else, since it carries its dependencies from `vendor/`.

```
npm ci
make check                       # the committed C header compiles on its own, warnings as errors
make test                        # the node suite: schema, semantic checks, goldens, perturbation, semver, round trip
make install PREFIX=/usr DESTDIR=…   # headers, JSON render, schema and omx-contract.pc
make install-cli PREFIX=/usr DESTDIR=…   # the omx-contract command, its files under CLIDIR (/usr/lib/omx-contract), its man page
```

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
share/omx-contract/          the committed json render (resolved data)
test/                        schema, semantic checks, goldens, perturbation, semver, round trip
  fixtures/owners-2.14.0/    the definitions omx-dsp, omx-clap-core and the console now hold, at their 2.14.0 bytes (the hosting file less the two codes 3.0.0 removed): what the tests read kernels from
  fixtures/answers-2.14.0/   the kernels' answers that went with them; `make completeness` runs over both
  fixtures/package-codes/    omx-clap-core's hosting/cost.json as omx-contract held it until 2.20.0: the codes kind's fixture
recipes/kernel.recipe.json   what a complete kernel has; an owner's recipes/answers/ records where each value comes from
tools/omx-new-kernel.mjs     the kernel wizard and importer; tools/kernel-recipe.mjs is `make completeness`
packaging/ debian/           omx-contract-devel (RPM) and libomx-contract-dev (deb), the data; omx-contract (RPM and deb), the command
```

How a kernel file is written: [docs/kernel-files.md](docs/kernel-files.md).
