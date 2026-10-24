<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com> -->
# Curves: the kinds, their axes and the EQ grid

An EQ response curve is a list of frequencies and the summed response at each. The frequencies come from one
declaration, `EQ_CURVE_GRID`, so the code that evaluates a curve and the server that serves it sample the same points,
and no client spells them. omx-dsp declares it, in its `data/primitives/eq-curve-grid.json`, and installs it into the
contract directory; this page says what the words mean.

## The grid

`EQ_CURVE_GRID` is a sheet of three numbers:

- `startHz`, the first point, in Hz;
- `pointsPerDecade`, the points in each decade;
- `nyquistFraction`, the fraction of the Nyquist frequency (the rate / 2) no point passes.

Point `k` is `startHz × 10^(k / pointsPerDecade)`, for `k = 0, 1, 2, …` while the point is at or below
`nyquistFraction × rate / 2`. The grid has no fixed upper frequency: it ends where the live rate puts the bound.

At the declared values (20 Hz, 53 points per decade, 0.999) the points up to 20 kHz are the 160 points from 20 Hz to
20 kHz the console draws its EQ curve on (`20 × 1000^(i / 159)`, `i = 0 … 159`; 159 steps over three decades is 53 a
decade). They are the same at every rate whose bound lies above 20 kHz; above 20 kHz the grid goes on at the same
step: 164 points at 48 kHz, 180 at 96 kHz, 196 at 192 kHz.

A curve may add points of its own between grid points (a band's centre and edges, so a narrow notch is sampled at
its null); those are the curve's, not the grid's.

## The render

The C header carries `OMX_EQ_CURVE_GRID_START_HZ`, `OMX_EQ_CURVE_GRID_POINTS_PER_DECADE` and
`OMX_EQ_CURVE_GRID_NYQUIST_FRACTION` (a float, with its `_DOUBLE` spelling); the TypeScript render exports
`EQ_CURVE_GRID`. A moved value is a MAJOR change: every curve already served would move.

## The curve kinds

A plugin's panel section draws one picture over its controls, and a console's card shows it. The kinds of picture
are declared once, in `data/curves.json`: `CURVE_KINDS` names each kind and the two axes it is drawn on, and
`CURVE_AXES` gives each axis its unit (one of the items' units) and its scale (an id of PARAM_SCALES). A kernel
file and a plugin declaration name a kind by its word; the omx-plugins schema reads the words from
`omx-vocabulary.schema.json` (`$defs.CURVE_KINDS.enum`) instead of keeping its own list, and a console keeps only
its map from a kind to the drawing that renders it.

| kind | x | y | drawn for |
|---|---|---|---|
| `eq-curve` | `frequency` (Hz, log) | `magnitude` (dB) | an EQ's summed response |
| `dynamics-curve` | `input-level` (dBFS) | `output-level` (dBFS) | a gate's or a compressor's static law, with the live needle |
| `transfer-curve` | `input-amplitude` (-1 to +1) | `output-amplitude` (-1 to +1) | a memoryless shaper (drive) |
| `delay-taps` | `delay-time` (ms) | `level` (dB) | a delay's taps and repeats |
| `decay-envelope` | `decay-time` (s) | `level` (dB) | a reverb's decay after an impulse |
| `comb-response` | `frequency` (Hz, log) | `magnitude` (dB) | the wet comb or notch response at the sweep position (chorus, flanger, phaser, doubler) |
| `modulation-shape` | `phase` (0 to 1) | `modulation` (-1 to +1) | a modulation source over one period (tremolo, rotary) |
| `interval-map` | `input-pitch` (st) | `output-pitch` (st) | a pitch effect's input to output pitch |

The first five are the graph kinds the omx-plugins schema carried; the last three are the remaining-FX wave's
(FX-6). `modulation-shape` is the picture the schema's `lfo` stood for, which no plugin declared: one picture has
one word, so `lfo` is not declared beside it.

Each word of a words item that names `axes` names its `x` and its `y`, each a word of that item; each word of the
axes item states its `unit` and `scale`. The validator refuses a kind with an axis missing or one that is no axis
word (`word-axis`), and an axis with no unit or no scale (`axis`) or a scale that is no PARAM_SCALES id (`scale`).
The renders carry them generically: `OMX_CURVE_KINDS_<NAME>`, `_COUNT` and `_INIT` in `omx_vocabulary.h`, the
`CURVE_KINDS` and `CURVE_AXES` items with their axes, units and scales in the JSON and ts renders, and
`CURVE_KINDS_WORDS` in ts.

The list is append-only and its order is part of the contract: a kind is never renamed, moved or removed while a
reader draws it. A new kind is a word appended here (a minor release), then a drawing in each renderer.
