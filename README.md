<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com> -->
# omx-contract

The FreeMixer declarations as data: what a value may be (a travel, a default, a kernel constant, a list),
written once as JSON, checked by a JSON Schema and rendered into the languages that read it. The mixer
engine, the DSP library and the plugins all take their ranges, defaults and constants from the same
definitions, so a knob means the same thing on the console, in a plugin and in a test.

- One declaration per value, validated against a closed schema. This package holds the schema, the one tool,
  and the facts no single package owns (`data/`: the sample rates, the readout rate, the parameter scales, the hosting codes, the measurement, resource and machine-class words, and the whole LV2 and CLAP vocabulary mapped, laid out by [docs/data-layout.md](docs/data-layout.md)); a package that implements a definition ships its own file into the
  contract directory ([docs/contract-dir.md](docs/contract-dir.md)): omx-dsp its kernels and design constants,
  omx-clap-core its hosting limits.
- Renders for C (a header), TypeScript and resolved JSON, each held equal to the data by CI.
- Semantic versioning enforced by a check: a change that narrows a declaration needs a major bump, one that adds
  or widens needs a minor ([what the check judges](docs/kernel-files.md#what-semver-judges)).

## Install

Fedora 44:

```
sudo dnf config-manager addrepo --from-repofile=https://freemixer.github.io/rpm/freemixer.repo
sudo dnf install omx-contract-devel
```

Debian bookworm and trixie (also Raspberry Pi OS and Zynthian):

```
curl -fsSL https://freemixer.github.io/deb/freemixer.asc | sudo tee /usr/share/keyrings/freemixer.asc >/dev/null
echo "deb [signed-by=/usr/share/keyrings/freemixer.asc] https://freemixer.github.io/deb/debian/$(. /etc/os-release; echo $VERSION_CODENAME) ./" | sudo tee /etc/apt/sources.list.d/freemixer.list
sudo apt update && sudo apt install libomx-contract-dev
```

JavaScript and TypeScript projects (the `ts` render is the main export, the CLI is `omx-contract`):

```
npm install @openmixer/omx-contract
```

Every GitHub release also carries the `npm pack` tarball, the RPMs and the debs.

## Use

Include the C header and read the constants by name:

```c
#include <omxcontract/omx_contract_limits.h>
```

```
pkg-config --cflags omx-contract
```

Pin one version and build against its renders instead of keeping a copy: the installed package at exactly
that version (`pkg-config --exact-version=2.20.0 omx-contract`), else the npm tarball, unpacked, and
`omx-contract render --target c --out build/omx-contract/include`. A kernel's controls and readouts, in their
order, are in the json render of the contract directory (`omx-contract render --target json --installed`); how a declaration is written is in
[docs/kernel-files.md](docs/kernel-files.md), and what a readout is in [docs/readouts.md](docs/readouts.md). The hosting limits, the refusal codes and the `clap_host_limits.h` rendered from them are in [docs/hosting.md](docs/hosting.md). How an owner's own header is spelled by a `render` word in its file is in [docs/render.md](docs/render.md). The frequency grid an EQ curve is sampled on is in [docs/curves.md](docs/curves.md). How a package installs its own definitions into the contract directory, and how a reader reads them, is in [docs/contract-dir.md](docs/contract-dir.md). How a plugin, ours or anyone's, is described in the same words (controls, ports, instruments, what it needs from a host) is in [docs/descriptors.md](docs/descriptors.md).

## Building

See [BUILDING.md](BUILDING.md).

## License

GPL-3.0-or-later. JSON cannot carry an SPDX comment; every data file is covered by `LICENSE`.
