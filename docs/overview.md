<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com> -->
# omx-contract: overview

- One declaration per value, validated against a closed schema. This package holds the schema, the one tool,
  and the facts no single package owns (`data/`: the sample rates, the readout rate, the parameter scales, the measurement, resource and machine-class words, and the whole LV2 and CLAP vocabulary mapped, laid out by [data-layout.md](data-layout.md)); a package that implements a definition ships its own file into the
  contract directory ([contract-dir.md](contract-dir.md)): omx-dsp its kernels and design constants,
  omx-clap-core its hosting limits.
- Renders for C (a header), TypeScript and resolved JSON, each held equal to the data by CI.
- Semantic versioning enforced by a check: a change that narrows a declaration needs a major bump, one that adds
  or widens needs a minor ([what the check judges](kernel-files.md#what-semver-judges)).

## The packages

The development package pulls in omx-contract-data, the files a program reads at run time (the contract directory,
the schema and the resolved json); a program that only reads them at run time requires omx-contract-data alone.
Every GitHub release also carries the `npm pack` tarball, the RPMs and the debs.

## Pinning a version

Pin one version and build against its renders instead of keeping a copy: the installed package at exactly
that version (`pkg-config --exact-version=2.20.0 omx-contract`), else the npm tarball, unpacked, and
`omx-contract render --target c --out build/omx-contract/include`.

## Where each subject is

- A kernel's controls and readouts, in their order: the json render of the contract directory
  (`omx-contract render --target json --installed`).
- How a declaration is written: [kernel-files.md](kernel-files.md); what a readout is: [readouts.md](readouts.md).
- The hosting limits, the refusal codes and the `clap_host_limits.h` rendered from them: [hosting.md](hosting.md).
- How an owner's own header is spelled by a `render` word in its file: [render.md](render.md).
- The curve kinds a panel draws, the axes each is drawn on, and the frequency grid an EQ curve is sampled on:
  [curves.md](curves.md).
- How a package installs its own definitions into the contract directory, and how a reader reads them:
  [contract-dir.md](contract-dir.md).
- How a plugin, ours or anyone's, is described in the same words (controls, ports, instruments, what it needs from
  a host): [descriptors.md](descriptors.md).
- Override files over a scanned descriptor: [overrides.md](overrides.md); resource hints:
  [resource-hints.md](resource-hints.md).

JSON cannot carry an SPDX comment; every data file is covered by `LICENSE`.
