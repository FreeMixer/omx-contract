<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com> -->
# omx-contract

The FreeMixer declarations as data: what a value may be (a travel, a default, a kernel constant, a list),
written once as JSON, checked by a JSON Schema and rendered into the languages that read it. The mixer
engine, the DSP library and the plugins all take their ranges, defaults and constants from here, so a knob
means the same thing on the console, in a plugin and in a test.

- One declaration per value, one file per group (`data/`), validated against a closed schema.
- Renders for C (a header), TypeScript and resolved JSON, each held equal to the data by CI.
- Semantic versioning enforced by a check: a change that narrows or removes a declaration needs a major bump.

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
that version (`pkg-config --exact-version=2.11.0 omx-contract`), else the npm tarball, unpacked, and
`omx-contract render --target c --out build/omx-contract/include`. A kernel's controls and readouts, in their
order, are in `share/omx-contract/omx-contract.json`; how a declaration is written is in
[docs/kernel-files.md](docs/kernel-files.md), and what a readout is in [docs/readouts.md](docs/readouts.md).

## Building

See [BUILDING.md](BUILDING.md).

## License

GPL-3.0-or-later. JSON cannot carry an SPDX comment; every data file is covered by `LICENSE`.
