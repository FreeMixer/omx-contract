// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
#ifndef OMX_DELAY_PARAMS_H
#define OMX_DELAY_PARAMS_H
/*
 * GENERATED — DO NOT EDIT BY HAND.
 * Produced by `omx-contract render --target c` from FreeMixer/omx-contract's data/plugins/delay.json
 * (DELAY_PLUGIN): FX_DELAY_TIME_RANGE, FX_DELAY_FEEDBACK_RANGE, DELAY_MIX_RANGE for kind input, DELAY_TONE_RANGE, FX_DELAY_PINGPONG_DEFAULT.
 * Change the data, never this file. Order is append-only (omx-contract spec §3.3).
 */
#include "omx_plugin_param.h"

enum {
  OMX_DELAY_PARAM_TIME_MS = 0,
  OMX_DELAY_PARAM_FEEDBACK = 1,
  OMX_DELAY_PARAM_MIX = 2,
  OMX_DELAY_PARAM_TONE = 3,
  OMX_DELAY_PARAM_PINGPONG = 4,
  OMX_DELAY_PARAM_COUNT = 5
};

static const omx_plugin_param OMX_DELAY_PARAMS[OMX_DELAY_PARAM_COUNT] = {
  { "timeMs", "Time", "ms", 0.0f, 2000.0f, 300.0f, OMX_PLUGIN_PARAM_INTEGER },
  { "feedback", "Feedback", "", 0.0f, 0.99f, 0.3f, 0u },
  { "mix", "Mix", "", 0.0f, 1.0f, 0.3f, 0u },
  { "tone", "Tone", "", 0.0f, 1.0f, 0.3f, 0u },
  { "pingpong", "Pingpong", "", 0.0f, 1.0f, 0.0f, OMX_PLUGIN_PARAM_TOGGLE },
};

/* One macro per declared bound: what a C face reads where a constant is needed. */
#define OMX_DELAY_PARAM_TIME_MS_MIN 0.0f
#define OMX_DELAY_PARAM_TIME_MS_MAX 2000.0f
#define OMX_DELAY_PARAM_TIME_MS_DEFAULT 300.0f
#define OMX_DELAY_PARAM_FEEDBACK_MIN 0.0f
#define OMX_DELAY_PARAM_FEEDBACK_MAX 0.99f
#define OMX_DELAY_PARAM_FEEDBACK_DEFAULT 0.3f
#define OMX_DELAY_PARAM_MIX_MIN 0.0f
#define OMX_DELAY_PARAM_MIX_MAX 1.0f
#define OMX_DELAY_PARAM_MIX_DEFAULT 0.3f
#define OMX_DELAY_PARAM_TONE_MIN 0.0f
#define OMX_DELAY_PARAM_TONE_MAX 1.0f
#define OMX_DELAY_PARAM_TONE_DEFAULT 0.3f
#define OMX_DELAY_PARAM_PINGPONG_MIN 0.0f
#define OMX_DELAY_PARAM_PINGPONG_MAX 1.0f
#define OMX_DELAY_PARAM_PINGPONG_DEFAULT 0.0f

#endif /* OMX_DELAY_PARAMS_H */
