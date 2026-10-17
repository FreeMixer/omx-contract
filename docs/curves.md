<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com> -->
# The EQ curve grid

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
