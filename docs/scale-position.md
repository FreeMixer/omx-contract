<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com> -->
# The position of a scale word

`PARAM_SCALES` (`linear`, `log`, `stepped`) says how a host draws a parameter. This page says what each word means as a
position `p`, 0 at the travel's `min` and 1 at its `max`, so every surface that draws or nudges a control agrees.
The fader of a level is not here: its curve is the desk's.

| Word | Position | Value at `p` |
|---|---|---|
| `linear` | `(v - min) / (max - min)` | `min + p (max - min)` |
| `log` | `ln(v / min) / ln(max / min)`, over a positive floor | `min (max / min)^p` |
| `stepped` | `k / (n - 1)`, `k` the step's index, `n = (max - min) / step + 1` | the step nearest `p (n - 1)` |
| `map` | the plain value's linear position; the value is linear between the points | linear between the `[plain value, quantity]` points |

20 Hz to 20 kHz puts 1 kHz at 0.5663. `map` is the override module's table (`map.points`), not a word of
`PARAM_SCALES`; its function names are the same two.

A log travel over a floor that is not positive has no logarithm: the validator drops an override entry that asks for one
(`contract.override.scale-floor`) and a consumer serves such a travel linear. A word's law is not overridable
per control; an override may change the word (`travel.scale`) or give points (`map`), never the law.

## The library

`@openmixer/omx-contract/scale` (`lib/scale.mjs`, with `lib/scale.d.mts`):

- `scalePosition(travel, value)` and `scaleValue(travel, p)`; `travel` is `{ scale, min, max, step? }`, or
  `{ scale: 'map', points }`. Nothing is clamped; the ends are exact. A stepped value between steps lands on the nearest
  step. `unknown` is served linear. Anything else throws `RangeError`.

The library is JS only: the C header and the TypeScript render hold data, none of the contract's functions.

## The vectors

`data/scale-vectors.json` holds, per law, the travel and six rows `{ value, p }`: the ends, the middle and three interior
points, computed in 60-digit decimal arithmetic and never by the library; the log law has the 1 kHz row beside them.
Both directions hold within one ulp (relative 2.220446049250313e-16). It is no declaration: it is not loaded,
rendered or installed in the contract directory, and the packages install it as
`share/omx-contract/scale-vectors.json`, the file other surfaces' twins are held to.
