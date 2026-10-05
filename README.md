<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com> -->
# omx-contract

The FreeMixer declarations as data: what a value may be (a travel, a default, a kernel constant, a
list, a plugin's parameter selection), as JSON validated by a JSON Schema, rendered by one CLI into
every language that reads it. Governed by openmixer's
`docs/design/specs/2026-10-05-omx-contract.md`; 1.0.0 carries the phase-1 items of its §4.1, what
omx-dsp needs.

```
data/                        the declaration, one file per group, edited by hand
  rates.json  primitives.json  kernels/<kernel>.json  plugins/<plugin>.json
schema/omx-contract.schema.json   JSON Schema 2020-12: five kinds, closed units, refs, closed derivations
bin/omx-contract.mjs         the CLI
render/                      c.mjs (openmixer's renderer, moved unchanged, under c/), ts.mjs, json.mjs
include/omxcontract/         the committed c render (what omx-contract-devel installs)
share/omx-contract/          the committed json render (resolved data)
test/                        schema, semantic checks, goldens, perturbation, semver, round trip
tools/proof/round-trip.mjs   the spec §4.4 steps 1 and 2 proof against omx-dsp v0.1.3
tools/seed/                  the one-time seed from openmixer's built core (provenance; never run by CI)
packaging/ debian/           omx-contract-devel (RPM), libomx-contract-dev (deb)
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

## Consuming it

Pin one version (`omx-contract 1.0.0` in `.github/pins.txt`) and build against its renders, committing
none: the installed `omx-contract-devel` / `libomx-contract-dev` at exactly that version
(`pkg-config --exact-version=1.0.0 omx-contract`), else the release's npm tarball, unpacked, and
`omx-contract render --target c --out build/omx-contract/include`. Include
`<omxcontract/omx_contract_limits.h>` and `<omxcontract/params/omx_delay_params.h>`.

The npm package is `@openmixer/omx-contract` on npmjs.org (the `ts` render is its main export); every
GitHub release also carries the `npm pack` tarball, the RPMs and the debs.

## License

GPL-3.0-or-later. JSON cannot carry an SPDX comment; every data file is covered by `LICENSE`.
