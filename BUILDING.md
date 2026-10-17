<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com> -->
# Building omx-contract

Needs Node.js 20 or newer and npm for the CLI and the test suite; the installed package itself needs no
node, only `make` and a C compiler to check the header.

```
npm ci
make check                       # the committed C header compiles on its own, warnings as errors
make test                        # the node suite: schema, semantic checks, goldens, perturbation, semver, round trip
make install PREFIX=/usr DESTDIR=…   # headers, JSON render, schema and omx-contract.pc
```

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

## Layout

```
data/                        omx-contract's own definitions, one file per group, edited by hand
  rates.json  primitives.json
schema/omx-contract.schema.json   JSON Schema 2020-12: five kinds (scalar, travels, sheet, list, set), closed units, refs, closed derivations
lib/eq-defaults.mjs          the one default rule for a fresh EQ's bands; the ts and c renders carry it
bin/omx-contract.mjs         the CLI
render/                      the c, ts and json renderers
include/omxcontract/         the committed c render (what omx-contract-devel installs)
share/omx-contract/          the committed json render (resolved data)
test/                        schema, semantic checks, goldens, perturbation, semver, round trip
  fixtures/owners-2.14.0/    the definitions omx-dsp, omx-clap-core and the console now hold, at their 2.14.0 bytes: what the tests read kernels from
  fixtures/answers-2.14.0/   the kernels' answers that went with them; `make completeness` runs over both
recipes/kernel.recipe.json   what a complete kernel has; an owner's recipes/answers/ records where each value comes from
tools/omx-new-kernel.mjs     the kernel wizard and importer; tools/kernel-recipe.mjs is `make completeness`
packaging/ debian/           omx-contract-devel (RPM), libomx-contract-dev (deb)
```

How a kernel file is written: [docs/kernel-files.md](docs/kernel-files.md).
