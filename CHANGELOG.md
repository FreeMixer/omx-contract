# Changelog

The releases are in `debian/changelog` and `packaging/omx-contract.spec`. This file holds what the next release will carry.

## Unreleased

- A code gains `text` (`en` and `ca`, both required) and `args` (the `{name}` placeholders), written by the code's owner; the
  validator refuses differing placeholder sets and a placeholder outside `args`, and the c, json and vocabulary-schema renders carry
  them (docs/data-layout.md). Schema 3.11.0.
- `scalePosition(travel, value)` and `scaleValue(travel, p)` (`lib/scale.mjs`, exported as `@openmixer/omx-contract/scale`):
  what `linear`, `log` and `stepped`, and the override `map`, mean as a position (docs/scale-position.md).
- `data/scale-vectors.json`: the golden vectors of each law, installed as `share/omx-contract/scale-vectors.json`; 20 Hz
  to 20 kHz puts 1 kHz at 0.5663.
- A log travel over a floor that is not positive is served linear by the library; the validator already drops an
  override entry that asks for one (`contract.override.scale-floor`), and a test holds both outcomes.
- `descriptorMeter` gains `held` (the plugin holds the block value until the host reads it; a foreign plugin is false and
  its meter unheld) and `clip` (a level meter carries a sticky clip word; false declares it absent), both optional booleans.
  The kinds stay `level` and `gain-reduction`; a level is in dBFS, dBTP, LUFS or LU and a gain reduction in dB, so
  `dBTP` and `LU` join the plugin-only units. A clip word on a gain reduction, or `clip: true` on a loudness unit, is
  refused with `contract.descriptor.meter`. `rms`, `vu` and `ppm` are not meter kinds.
- `descriptorMeter` gains `measurement` (`peak`, `true-peak`, `lufs-m`, `lufs-s`, `lufs-i`, `lra`, `gain-reduction`), optional.
  `true-peak` is in dBTP, `lufs-*` in LUFS, `lra` in LU, `peak` in dBFS; `gain-reduction` is the one measurement of a
  gain-reduction meter. A measurement in another unit is refused with `contract.descriptor.meter`.
- The schema states `x-omx-schema-version` 3.10.0 (the vocabulary's own number, as 4e85a8d did for 3.9.0; not a release).
  The semver command reads an `anyOf` member by member: a value added to an enum inside it, or a member appended, is
  MINOR; a member removed or rewritten is still MAJOR.
