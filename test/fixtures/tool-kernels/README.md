<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com> -->
# tool-kernels

Invented kernels, primitives and answers, for the tool's own tests: no owner declares them, and no value here is any
library's. They cover each shape the reader, the renderer, the validator, semver and the kernel recipe's checkers handle,
so a test can break one and watch the check name it:

- `swell`: a table with a re-arming field, a readout bounded by reference, sets of named ids, ids starting with a digit,
  a set with no default;
- `contour`: per-band controls with their count, a conditional travel (`of`, `when`), a use, numeric ids, ids carrying a
  value, a sheet with a reference, a list and its derived count;
- `echo`: an integer travel, a travel with a come-up value by kind, a flat table keyed by field, two integer lists, a
  sheet field by reference to a scalar;
- `wave`: an aggregate and a `ceilSum`; `ripple` and `flutter`, which have answers: the kernel recipe's;
- `primitives/`: a square root and its readers, a Lagrange read norm, a travels item with fields of its own.

The definitions themselves are proved where they live (omx-dsp's `make contract-proof` and `make contract-tests`); the
one test against live owner data is test/live-owners.test.mjs.
