# Changelog

What changed in each release of omx-contract, in plain words. The RPM and Debian changelogs and the
GitHub release notes are generated from this file.

## 1.1.0 - 2026-10-07

- Every kernel cites where the engine declares each of its values (`recipes/answers/`), and
  `make completeness` checks each kernel against the kernel recipe: its file, the citations, the
  renders and the changelog. `tools/omx-new-kernel.mjs` adds a kernel by reading its values from
  the engine's own code.
- The delay plugin's parameter selection (`data/plugins/delay.json`, `DELAY_PLUGIN`) and the
  `omxcontract/params/` headers are gone: omx-plugins now declares each plugin's parameters by
  reference to the kernel travels here and renders those headers itself. While every consumer of
  omx-contract is a FreeMixer repository, removing an item is a minor release.
- A travels table may name each field's travel by reference, and `x` (a multiplier) joins the
  units.
- The flanger kernel: 4 values, read from the engine where it declares them.
- The deesser kernel: 8 values, read from the engine where it declares them.
- The geq kernel: 4 values, read from the engine where it declares them.
- The phaser kernel: 8 values, read from the engine where it declares them.
- The rotary kernel: 20 values, read from the engine where it declares them.
- The tremolo kernel: 4 values, read from the engine where it declares them.

## 1.0.0 - 2026-10-05

- First release: the shared declarations the FreeMixer DSP library needs (value ranges, defaults,
  kernel constants, sample rates and plugin parameter choices), as JSON data with a JSON Schema and
  as C headers. The headers match the ones omx-dsp 0.1.3 shipped, unit for unit.
