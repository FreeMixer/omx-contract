<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com> -->
# omx-contract

The FreeMixer declarations as data: what a value may be (a travel, a default, a kernel constant, a list),
written once as JSON, checked by a JSON Schema and rendered into the languages that read it (a C header,
TypeScript, resolved JSON). The mixer engine, the DSP library and the plugins all take their ranges, defaults and
constants from the same definitions, so a knob means the same thing on the console, in a plugin and in a test.

## Install

Fedora 44:

```
sudo dnf install https://www.openmixer.org/rpm/openmixer-release.noarch.rpm
sudo dnf install omx-contract-devel
```

Debian bookworm and trixie (also Raspberry Pi OS and Zynthian):

```
curl -fsSLO https://www.openmixer.org/deb/openmixer-release.deb && sudo apt install ./openmixer-release.deb
sudo apt install libomx-contract-dev
```

JavaScript and TypeScript: `npm install @openmixer/omx-contract` (the CLI is `omx-contract`).

## Start

```c
#include <omxcontract/omx_contract_limits.h>
```

```
cc -c app.c $(pkg-config --cflags omx-contract)
omx-contract render --target json --installed     # every declaration in the contract directory
```

## Documentation

<https://www.openmixer.org/projects/omx-contract>, `man omx-contract`, and in this repository: what the package
holds, pinning a version and where each subject is ([docs/overview.md](docs/overview.md)); building
([BUILDING.md](BUILDING.md)).

## Licence

GPL-3.0-or-later. See [LICENSE](LICENSE).
