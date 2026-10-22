// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
#ifndef OMX_CONTRACT_LIMITS_H
#define OMX_CONTRACT_LIMITS_H
#include <math.h>
/*
 * GENERATED — DO NOT EDIT BY HAND.
 * Produced by `omx-contract render --target c` from FreeMixer/omx-contract's data/, the declaration
 * as data (each item's reason is its `doc`). Change the data, never this file: a consumer builds
 * against the render of the omx-contract version it pins and commits none.
 *
 * A C contract (OMX_PRE/OMX_POST/OMX_INVARIANT) reads a limit from HERE, never a literal.
 */

/* Every scalar, sheet leaf and single travel's numbers, one block sorted by macro. An integer value
 * is an integer literal, any other a float literal AND its OMX_<macro>_DOUBLE spelling. */
#define OMX_READOUT_RATE_HZ 50
#define OMX_RT_HARD_TARGET_QUANTUM 128
#define OMX_RT_HARD_TARGET_RATE 192000

/* Every list rendered to C, sorted by list: OMX_<LIST>_COUNT and OMX_<LIST>_INIT { a, b, … }. */
#define OMX_ORACLE_FLOOR_RATES_COUNT 4u
#define OMX_ORACLE_FLOOR_RATES_INIT { 44100, 48000, 96000, 192000 }
#define OMX_ORACLE_FULL_RATES_COUNT 9u
#define OMX_ORACLE_FULL_RATES_INIT { 32000, 44100, 48000, 64000, 88200, 96000, 128000, 176400, 192000 }
#define OMX_STANDARD_QUANTA_COUNT 6u
#define OMX_STANDARD_QUANTA_INIT { 32, 64, 128, 256, 512, 1024 }
#define OMX_STANDARD_SAMPLE_RATES_COUNT 6u
#define OMX_STANDARD_SAMPLE_RATES_INIT { 44100, 48000, 88200, 96000, 176400, 192000 }

/* Every set rendered to C, sorted by set: an enum of the ids (a named id's position, or a numeric id's number), `OMX_<SET>_COUNT` and,
 * where the set names a default, `OMX_<SET>_DEFAULT`. */
enum omx_param_scales {
  OMX_PARAM_SCALES_LINEAR = 0,
  OMX_PARAM_SCALES_LOG = 1,
  OMX_PARAM_SCALES_STEPPED = 2,
};
#define OMX_PARAM_SCALES_COUNT 3u
#define OMX_PARAM_SCALES_DEFAULT OMX_PARAM_SCALES_LINEAR

#endif /* OMX_CONTRACT_LIMITS_H */

/* The standard sample rates (STANDARD_SAMPLE_RATES, declared in omx-contract's rates.json): the set
 * a rate is checked against and the grid a native tool iterates. Guarded on its own, outside the
 * include guard, so a tool built against an older copy of this header can include this one after
 * it and gain the rates without mixing the two copies' limits. */
#ifndef OMX_DECLARED_RATE_COUNT
#define OMX_DECLARED_RATE_COUNT 6u
static const float OMX_DECLARED_RATES[OMX_DECLARED_RATE_COUNT] = { 44100.0f, 48000.0f, 88200.0f, 96000.0f, 176400.0f, 192000.0f };
/* The declared rates that are whole multiples of `base` (a tool's default grid: the 48 kHz family),
 * in declaration order, at most `cap` of them; returns how many were written to `out`. */
static inline int omx_declared_rates_multiple_of(unsigned base, int *out, int cap) {
  int n = 0;
  for (unsigned k = 0; k < OMX_DECLARED_RATE_COUNT && n < cap; k++)
    if ((unsigned)OMX_DECLARED_RATES[k] % base == 0) out[n++] = (int)OMX_DECLARED_RATES[k];
  return n;
}
#endif
