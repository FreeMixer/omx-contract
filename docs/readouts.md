<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com> -->
# Readouts

A readout is a value a kernel reports while it runs, which a host draws and never writes: a meter. A control is
what the operator sets; a readout is what the operator reads. Both are contract data: a plugin generated from the
contract declares its meters from the readouts the way it declares its parameters from the controls, and the
console draws the same meter with the same range.

## A readout declaration

A kernel file lists its readouts under `readouts`, after its controls, in order:

```json
"readouts": [
  { "name": "gainReductionDb", "doc": "…", "unit": "dB", "min": { "ref": "GATE_LIMITS.rangeDb.min" }, "max": 0, "scale": "linear", "rateHz": { "ref": "READOUT_RATE_HZ" } }
]
```

- `name`: lowerCamel, unique among the kernel's readouts. Its position in the list is its id, as a set's named id
  is its position: a readout is appended, never inserted, so a host's meter id stays the same across releases.
- `doc`: what the value measures and its sign.
- `unit`: one of the contract's units. A gain reduction is `dB` with CLAP's sign (0 no reduction, negative the
  reduction applied); a level is `dBFS`.
- `min`, `max`: the display range, in the unit, `min` below `max`. A number or a reference to the item that
  states it, so a range read off a control's travel is stated once.
- `scale`: an id of PARAM_SCALES, how a host draws the value. It is required: a host never infers a readout's
  scale. A value in dB is drawn `linear`: the dB is already the logarithm.
- `rateHz`: how often the value is published, in Hz. A number or a reference.

Nothing else. A readout is not an item: it holds no number the kernel computes with, only how its output is
drawn, so it has no engine value to cite and the kernel recipe does not ask for one.

## How it renders

- C, in `omx_contract_limits.h`, per kernel that declares readouts: `enum omx_<kernel>_readouts` with
  `OMX_<KERNEL>_READOUT_<NAME>` at its position, `OMX_<KERNEL>_READOUT_COUNT`, and per readout `_MIN` and `_MAX`
  (float literals), `_RATE_HZ`, `_SCALE` (an `OMX_PARAM_SCALES_*` member) and `_UNIT` (a string literal).
- TypeScript: `READOUTS`, by kernel, each readout `{ name, doc, unit, min, max, scale, rateHz }` with every
  reference resolved, as literal types.
- JSON: the same list as `kernels.<kernel>.readouts`, beside the kernel's controls; a kernel with none carries no
  `readouts`.

`omx-contract semver` classifies a change to a readout: one appended is MINOR; one removed, renamed or moved, or
its unit changed, is MAJOR (a removal is MINOR in the development phase, as an item's is); its range, scale or
rate changed is MINOR; its doc is PATCH.

## The readouts declared

The gain reduction of the four dynamics kernels: the one meter every dynamics plugin carries and every host
draws (CLAP's gain adjustment). Each display range runs from 0 down to the deepest reduction the kernel's own
travels allow, read off the travel that bounds it:

| kernel  | readout           | min                               | why                                                        |
|---------|-------------------|-----------------------------------|------------------------------------------------------------|
| gate    | `gainReductionDb` | `GATE_LIMITS.rangeDb.min`         | the gate attenuates by its range at most                   |
| deesser | `gainReductionDb` | `DEESS_RANGE_RANGE.min`           | the de-esser reduces by its range at most                  |
| comp    | `gainReductionDb` | `COMP_LIMITS.thresholdDb.min`     | at or below 0 dBFS, `(x - T)(1 - 1/R)` never exceeds `-T`  |
| limiter | `gainReductionDb` | `LIMITER_LIMITS.ceilingDb.min`    | at or below 0 dBFS, the limiter pulls the peak to its ceiling at most |

All four are `linear` and published at READOUT_RATE_HZ, 50 Hz: one value every 20 ms, the rate a host sends a
moving meter at.

The graphic EQ declares one more, `designClamped`: 0 or 1, drawn `stepped`, published at READOUT_RATE_HZ. It is 1
when the last design in `true` mode asked a section for more than GEQ_DESIGN_GAIN_MAX_DB and got the ceiling, so a
host shows that the curve could not be met instead of the solve clamping silently. The design step derives it; no
host writes it.

## Per-band readouts

A kernel with bands reports one readout per band, named `band<n>` and the name the one-band readout has with its
first letter raised: `gainReductionDb` per band is `band1GainReductionDb`, `band2GainReductionDb`, and so on. The
bands are numbered from 1 and declared in order with no gap, so band n's meter id is the first band's id plus
n - 1, and every band of one name is drawn alike (one unit, range, scale and rate), since a host draws them as one
row of meters. The validator refuses a gap, a band out of order or a band drawn unlike the others (`readout-band`).

The remaining-FX wave's kernel files declare these in omx-dsp (FreeMixer/omx-dsp#188), in this grammar:

| kernel | readouts | unit | range | why |
|---|---|---|---|---|
| dyneq (FX-1) | `band1GainDb` … `band6GainDb` | dB | the band's dynamic range travel, −24 to +12 | the gain the band's dynamics applies now, both ways: a cut negative, a boost positive |
| mbcomp (FX-3) | `band1GainReductionDb` … `band5GainReductionDb` | dB | the band threshold's travel to 0 | each band's gain reduction, CLAP's sign as `gainReductionDb` |
| transient (FX-16) | `attackGainDb`, `sustainGainDb` | dB | `TRANSIENT_LIMITS.attackDb` and `.sustainDb`, −24 to +24 | the gain the attack and the sustain stages apply now, both ways |

The multiband's reduction is `band<n>GainReductionDb`, not an abbreviation such as `band<n>GrDb`: it is the
compressor's own `gainReductionDb` per band, and one quantity has one spelling. All are `linear` (a dB value is
already the logarithm) at READOUT_RATE_HZ. The ranges are read off the kernel's own travels in its file, never
restated here.

Not declared yet: a level meter (the strip's input and output peak are the strip's, not a kernel's) and the
analysers (rta, fbs), whose output is a spectrum, not a value.

## scale

PARAM_SCALES stays and has two readers: EQ_CONTINUOUS_TRAVELS names `log` on the EQ's three frequency travels,
and every readout names its scale. A kernel's own travels do not name one: the console's travels are stepped,
and the drawn form of a continuous travel is the `*_CONTINUOUS_TRAVELS` table that carries it.
