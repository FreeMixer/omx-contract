# Changelog

What changed in each release of omx-contract, in plain words. The RPM and Debian changelogs and the
GitHub release notes are generated from this file.

## Unreleased

- Every kernel cites where the engine declares each of its values (`recipes/answers/`), and
  `make completeness` checks each kernel against the kernel recipe: its file, the citations, the
  renders and the changelog. `tools/omx-new-kernel.mjs` adds a kernel by reading its values from
  the engine's own code.
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
