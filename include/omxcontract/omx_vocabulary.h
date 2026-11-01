// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
#ifndef OMX_VOCABULARY_H
#define OMX_VOCABULARY_H
/*
 * GENERATED: DO NOT EDIT BY HAND.
 * Produced by `omx-contract render --target c` from FreeMixer/omx-contract's data/: the vocabulary
 * (docs/data-layout.md). A code is OMX_ and the code in upper snake case, and a reply code that carries a resp has it as that name and _RESP; a word is OMX_<ITEM>_<NAME>, each words
 * item with its _COUNT and an _INIT of its words in their order. A consumer writes and compares these, never a
 * literal of its own.
 */

/* CURVE_AXES (data/curves.json) */
#define OMX_CURVE_AXES_FREQUENCY "frequency" ///< Frequency, on the points of EQ_CURVE_GRID where the curve is a response.
#define OMX_CURVE_AXES_MAGNITUDE "magnitude" ///< The magnitude of a response at a frequency: 0 dB is unity, a boost positive, a cut negative.
#define OMX_CURVE_AXES_INPUT_LEVEL "input-level" ///< The level a gain computer reads, the static law's input.
#define OMX_CURVE_AXES_OUTPUT_LEVEL "output-level" ///< The level the static law gives for an input level; the diagonal is no gain change.
#define OMX_CURVE_AXES_INPUT_AMPLITUDE "input-amplitude" ///< A memoryless shaper's input sample, linear, -1 to +1 full scale: bipolar, so an even/odd asymmetry shows.
#define OMX_CURVE_AXES_OUTPUT_AMPLITUDE "output-amplitude" ///< The shaper's output sample for an input amplitude, linear, on the same full scale.
#define OMX_CURVE_AXES_DELAY_TIME "delay-time" ///< The time after the dry sound at which a delay's tap or repeat sounds.
#define OMX_CURVE_AXES_DECAY_TIME "decay-time" ///< The time after an impulse over which a reverb's energy decays.
#define OMX_CURVE_AXES_LEVEL "level" ///< A level relative to the dry input: 0 dB is the input's own, a tap or a decay below it negative.
#define OMX_CURVE_AXES_PHASE "phase" ///< The position within one period of a modulation source, 0 to 1.
#define OMX_CURVE_AXES_MODULATION "modulation" ///< A modulation source's output at a phase, -1 to +1, before the depth scales it.
#define OMX_CURVE_AXES_INPUT_PITCH "input-pitch" ///< The pitch played into a pitch effect, semitones from an origin the host picks.
#define OMX_CURVE_AXES_OUTPUT_PITCH "output-pitch" ///< The pitch the effect sounds for an input pitch, semitones on the same origin: an unshifted map is the diagonal.
#define OMX_CURVE_AXES_COUNT 13u
#define OMX_CURVE_AXES_INIT { "frequency", "magnitude", "input-level", "output-level", "input-amplitude", "output-amplitude", "delay-time", "decay-time", "level", "phase", "modulation", "input-pitch", "output-pitch" }

/* CURVE_KINDS (data/curves.json) */
#define OMX_CURVE_KINDS_EQ_CURVE "eq-curve" ///< An EQ's summed magnitude response over log frequency.
#define OMX_CURVE_KINDS_DYNAMICS_CURVE "dynamics-curve" ///< A gate's or a compressor's static law, input level to output level, with the live needle.
#define OMX_CURVE_KINDS_TRANSFER_CURVE "transfer-curve" ///< A memoryless shaper's transfer, input sample to output sample over full scale.
#define OMX_CURVE_KINDS_DELAY_TAPS "delay-taps" ///< A delay's taps and repeats, each a line at its time and level.
#define OMX_CURVE_KINDS_DECAY_ENVELOPE "decay-envelope" ///< A reverb's decay envelope after an impulse.
#define OMX_CURVE_KINDS_COMB_RESPONSE "comb-response" ///< The wet path's comb or notch response at the current sweep position (chorus, flanger, phaser, doubler).
#define OMX_CURVE_KINDS_MODULATION_SHAPE "modulation-shape" ///< A modulation source over one period (tremolo, rotary).
#define OMX_CURVE_KINDS_INTERVAL_MAP "interval-map" ///< A pitch effect's map from the input pitch to the output pitch.
#define OMX_CURVE_KINDS_COUNT 8u
#define OMX_CURVE_KINDS_INIT { "eq-curve", "dynamics-curve", "transfer-curve", "delay-taps", "decay-envelope", "comb-response", "modulation-shape", "interval-map" }

/* MACHINE_CLASS_FIELDS (data/machine-class.json) */
#define OMX_MACHINE_CLASS_FIELDS_ARCH "arch" ///< The machine architecture as uname -m names it.
#define OMX_MACHINE_CLASS_FIELDS_FAMILY "family" ///< The CPU family and model.
#define OMX_MACHINE_CLASS_FIELDS_CORE_BAND "coreBand" ///< The cores, as a band of MACHINE_CORE_BANDS.
#define OMX_MACHINE_CLASS_FIELDS_CLOCK_BAND "clockBand" ///< The clock, as a band of MACHINE_CLOCK_BANDS.
#define OMX_MACHINE_CLASS_FIELDS_PREEMPT_RT "preemptRt" ///< Whether the kernel is PREEMPT_RT.
#define OMX_MACHINE_CLASS_FIELDS_CSTATES_LIMITED "cstatesLimited" ///< Whether the deep idle states are limited.
#define OMX_MACHINE_CLASS_FIELDS_COUNT 6u
#define OMX_MACHINE_CLASS_FIELDS_INIT { "arch", "family", "coreBand", "clockBand", "preemptRt", "cstatesLimited" }

/* MACHINE_PROFILE_FIELDS (data/machine-class.json) */
#define OMX_MACHINE_PROFILE_FIELDS_GOVERNOR "governor"
#define OMX_MACHINE_PROFILE_FIELDS_TURBO "turbo"
#define OMX_MACHINE_PROFILE_FIELDS_SMT "smt"
#define OMX_MACHINE_PROFILE_FIELDS_PREEMPT "preempt"
#define OMX_MACHINE_PROFILE_FIELDS_CPUIDLE "cpuidle"
#define OMX_MACHINE_PROFILE_FIELDS_COUNT 5u
#define OMX_MACHINE_PROFILE_FIELDS_INIT { "governor", "turbo", "smt", "preempt", "cpuidle" }

/* MACHINE_CORE_BANDS (data/machine-class.json) */
#define OMX_MACHINE_CORE_BANDS_CORES1_TO2 "1-2"
#define OMX_MACHINE_CORE_BANDS_CORES3_TO4 "3-4"
#define OMX_MACHINE_CORE_BANDS_CORES5_TO8 "5-8"
#define OMX_MACHINE_CORE_BANDS_CORES9_TO16 "9-16"
#define OMX_MACHINE_CORE_BANDS_CORES17_TO32 "17-32"
#define OMX_MACHINE_CORE_BANDS_CORES33_UP "33+"
#define OMX_MACHINE_CORE_BANDS_COUNT 6u
#define OMX_MACHINE_CORE_BANDS_INIT { "1-2", "3-4", "5-8", "9-16", "17-32", "33+" }

/* MACHINE_CLOCK_BANDS (data/machine-class.json) */
#define OMX_MACHINE_CLOCK_BANDS_UNDER1500_MHZ "<1.5GHz"
#define OMX_MACHINE_CLOCK_BANDS_FROM1500_TO2500_MHZ "1.5-2.5GHz"
#define OMX_MACHINE_CLOCK_BANDS_FROM2500_TO3500_MHZ "2.5-3.5GHz"
#define OMX_MACHINE_CLOCK_BANDS_FROM3500_TO4500_MHZ "3.5-4.5GHz"
#define OMX_MACHINE_CLOCK_BANDS_FROM4500_MHZ "4.5GHz+"
#define OMX_MACHINE_CLOCK_BANDS_COUNT 5u
#define OMX_MACHINE_CLOCK_BANDS_INIT { "<1.5GHz", "1.5-2.5GHz", "2.5-3.5GHz", "3.5-4.5GHz", "4.5GHz+" }

/* MACHINE_ARCHES (data/machine-class.json) */
#define OMX_MACHINE_ARCHES_X8664 "x86_64"
#define OMX_MACHINE_ARCHES_AARCH64 "aarch64"
#define OMX_MACHINE_ARCHES_COUNT 2u
#define OMX_MACHINE_ARCHES_INIT { "x86_64", "aarch64" }

/* MACHINE_CLASSES (data/machine-class.json) */
#define OMX_MACHINE_CLASSES_DESK "desk" ///< An x86-64 desk.
#define OMX_MACHINE_CLASSES_RASPBERRY_PI4 "raspberry-pi-4" ///< A Raspberry Pi 4, aarch64.
#define OMX_MACHINE_CLASSES_RASPBERRY_PI5 "raspberry-pi-5" ///< A Raspberry Pi 5, aarch64.
#define OMX_MACHINE_CLASSES_COUNT 3u
#define OMX_MACHINE_CLASSES_INIT { "desk", "raspberry-pi-4", "raspberry-pi-5" }

/* MEASUREMENT_DIMENSIONS (data/measurement.json) */
#define OMX_MEASUREMENT_DIMENSIONS_LATENCY "latency"
#define OMX_MEASUREMENT_DIMENSIONS_COST "cost"
#define OMX_MEASUREMENT_DIMENSIONS_STABILITY "stability"
#define OMX_MEASUREMENT_DIMENSIONS_RT_SAFETY "rtSafety"
#define OMX_MEASUREMENT_DIMENSIONS_FEATURES "features"
#define OMX_MEASUREMENT_DIMENSIONS_COUNT 5u
#define OMX_MEASUREMENT_DIMENSIONS_INIT { "latency", "cost", "stability", "rtSafety", "features" }

/* MEASUREMENT_UNMEASURED_KINDS (data/measurement.json) */
#define OMX_MEASUREMENT_UNMEASURED_KINDS_NOTHING_TO_MEASURE "nothing-to-measure" ///< A property of the plugin: any prober on any machine reaches it, so it may override a figure.
#define OMX_MEASUREMENT_UNMEASURED_KINDS_PROBE_FAILED "probe-failed" ///< A property of this run: it says nothing about the plugin and never overrides a figure.
#define OMX_MEASUREMENT_UNMEASURED_KINDS_NOT_ATTEMPTED "not-attempted" ///< The run did not cover this plugin or this dimension: a partial run, not a finding.
#define OMX_MEASUREMENT_UNMEASURED_KINDS_COUNT 3u
#define OMX_MEASUREMENT_UNMEASURED_KINDS_INIT { "nothing-to-measure", "probe-failed", "not-attempted" }

/* MEASUREMENT_UNMEASURED_REASONS (data/measurement.json) */
#define OMX_MEASUREMENT_UNMEASURED_REASONS_NO_AUDIO_IN "no-audio-in" ///< No audio input port: nothing to drive.
#define OMX_MEASUREMENT_UNMEASURED_REASONS_NO_AUDIO_OUT "no-audio-out" ///< No audio output port: nothing to read.
#define OMX_MEASUREMENT_UNMEASURED_REASONS_SILENT_OUTPUT "silent-output" ///< Driven, and silent under a stimulus that should have passed.
#define OMX_MEASUREMENT_UNMEASURED_REASONS_NEEDS_CARRIER "needs-carrier" ///< Needs a second audio input the prober did not supply.
#define OMX_MEASUREMENT_UNMEASURED_REASONS_NEEDS_IMPULSE_RESPONSE "needs-impulse-response" ///< A convolver needing an impulse response the prober did not load.
#define OMX_MEASUREMENT_UNMEASURED_REASONS_UNPINNABLE "unpinnable" ///< The files the host loads cannot be pinned.
#define OMX_MEASUREMENT_UNMEASURED_REASONS_NO_VOICES "no-voices" ///< An instrument whose voice-info declares a capacity of 0.
#define OMX_MEASUREMENT_UNMEASURED_REASONS_NOTES_UNPLAYABLE "notes-unplayable" ///< An instrument whose note input reads no dialect the prober speaks.
#define OMX_MEASUREMENT_UNMEASURED_REASONS_VOICES_UNKNOWN "voices-unknown" ///< An instrument that declares no voice capacity, run with no probe count.
#define OMX_MEASUREMENT_UNMEASURED_REASONS_REFUSED_INSTANTIATION "refused-instantiation" ///< The plugin would not instantiate at this rate or block size.
#define OMX_MEASUREMENT_UNMEASURED_REASONS_PROBE_CRASHED "probe-crashed" ///< The probe worker died while hosting the plugin.
#define OMX_MEASUREMENT_UNMEASURED_REASONS_PROBE_TIMEOUT "probe-timeout" ///< The probe passed its per-plugin time limit.
#define OMX_MEASUREMENT_UNMEASURED_REASONS_NON_FINITE_OUTPUT "non-finite-output" ///< The output held NaN or infinity.
#define OMX_MEASUREMENT_UNMEASURED_REASONS_NOT_INSTALLED "not-installed" ///< The plugin is not installed on this machine.
#define OMX_MEASUREMENT_UNMEASURED_REASONS_WORKER_NONCONFORMING "worker-nonconforming" ///< An LV2 worker interface with work or work_response NULL.
#define OMX_MEASUREMENT_UNMEASURED_REASONS_PROBE_ERROR "probe-error" ///< A failure with no more specific reason; its own words are kept beside it.
#define OMX_MEASUREMENT_UNMEASURED_REASONS_NOT_ATTEMPTED "not-attempted" ///< The run did not cover this plugin for this dimension.
#define OMX_MEASUREMENT_UNMEASURED_REASONS_COUNT 17u
#define OMX_MEASUREMENT_UNMEASURED_REASONS_INIT { "no-audio-in", "no-audio-out", "silent-output", "needs-carrier", "needs-impulse-response", "unpinnable", "no-voices", "notes-unplayable", "voices-unknown", "refused-instantiation", "probe-crashed", "probe-timeout", "non-finite-output", "not-installed", "worker-nonconforming", "probe-error", "not-attempted" }

/* MEASUREMENT_LATENCY_METHODS (data/measurement.json) */
#define OMX_MEASUREMENT_LATENCY_METHODS_IMPULSE_ONSET "impulse-onset" ///< The delay from a unit impulse to the first output sample above the residual floor: what the plugin does.
#define OMX_MEASUREMENT_LATENCY_METHODS_DECLARED_PORT "declared-port" ///< Read from the plugin's own latency report: what it claims.
#define OMX_MEASUREMENT_LATENCY_METHODS_NOTE_ONSET "note-onset" ///< The delay from a note on to the first output sample above the floor.
#define OMX_MEASUREMENT_LATENCY_METHODS_COUNT 3u
#define OMX_MEASUREMENT_LATENCY_METHODS_INIT { "impulse-onset", "declared-port", "note-onset" }

/* MEASUREMENT_COST_METHODS (data/measurement.json) */
#define OMX_MEASUREMENT_COST_METHODS_BLOCK_TIME_PERCENTILE "block-time-percentile" ///< A percentile of per-block wall time under a sustained stimulus, warm-up discarded, in nanoseconds per sample.
#define OMX_MEASUREMENT_COST_METHODS_COUNT 1u
#define OMX_MEASUREMENT_COST_METHODS_INIT { "block-time-percentile" }

/* MEASUREMENT_LATENCY_SCALING (data/measurement.json) */
#define OMX_MEASUREMENT_LATENCY_SCALING_FIXED_FRAME "fixed-frame" ///< The same frame count at every rate.
#define OMX_MEASUREMENT_LATENCY_SCALING_FIXED_TIME "fixed-time" ///< The same milliseconds at every rate.
#define OMX_MEASUREMENT_LATENCY_SCALING_ZERO "zero" ///< No latency a mix can notice at any measured rate.
#define OMX_MEASUREMENT_LATENCY_SCALING_NONCONFORMING "nonconforming" ///< Fits neither law at a magnitude that reaches a mix: flagged, never averaged.
#define OMX_MEASUREMENT_LATENCY_SCALING_SINGLE_RATE "single-rate" ///< One usable reading: no law can be fitted.
#define OMX_MEASUREMENT_LATENCY_SCALING_UNMEASURED "unmeasured" ///< No rate produced a figure.
#define OMX_MEASUREMENT_LATENCY_SCALING_COUNT 6u
#define OMX_MEASUREMENT_LATENCY_SCALING_INIT { "fixed-frame", "fixed-time", "zero", "nonconforming", "single-rate", "unmeasured" }

/* MEASUREMENT_LATENCY_SCALING_NOTES (data/measurement.json) */
#define OMX_MEASUREMENT_LATENCY_SCALING_NOTES_BELOW_BUDGET "below-budget" ///< The readings fit no law but every one is inside the latency budget: the detector's noise.
#define OMX_MEASUREMENT_LATENCY_SCALING_NOTES_INFORMATIONAL_RATE "informational-rate" ///< Only a reading below the operational rates breaks the law; it stays as information.
#define OMX_MEASUREMENT_LATENCY_SCALING_NOTES_COUNT 2u
#define OMX_MEASUREMENT_LATENCY_SCALING_NOTES_INIT { "below-budget", "informational-rate" }

/* MEASUREMENT_LATENCY_EXCLUSIONS (data/measurement.json) */
#define OMX_MEASUREMENT_LATENCY_EXCLUSIONS_IMPOSSIBLE_ZERO "impossible-zero" ///< Zero frames at this rate while another rate measured non-zero.
#define OMX_MEASUREMENT_LATENCY_EXCLUSIONS_COUNT 1u
#define OMX_MEASUREMENT_LATENCY_EXCLUSIONS_INIT { "impossible-zero" }

/* MEASUREMENT_VOICE_BASES (data/measurement.json) */
#define OMX_MEASUREMENT_VOICE_BASES_DECLARED "declared"
#define OMX_MEASUREMENT_VOICE_BASES_PROBE "probe"
#define OMX_MEASUREMENT_VOICE_BASES_COUNT 2u
#define OMX_MEASUREMENT_VOICE_BASES_INIT { "declared", "probe" }

/* MEASUREMENT_VERDICT_RATINGS (data/measurement.json) */
#define OMX_MEASUREMENT_VERDICT_RATINGS_SUITABLE "suitable"
#define OMX_MEASUREMENT_VERDICT_RATINGS_CONDITIONAL "conditional"
#define OMX_MEASUREMENT_VERDICT_RATINGS_UNKNOWN "unknown"
#define OMX_MEASUREMENT_VERDICT_RATINGS_UNSUITABLE "unsuitable"
#define OMX_MEASUREMENT_VERDICT_RATINGS_COUNT 4u
#define OMX_MEASUREMENT_VERDICT_RATINGS_INIT { "suitable", "conditional", "unknown", "unsuitable" }

/* PANEL_FAMILIES (data/panel.json) */
#define OMX_PANEL_FAMILIES_NONE "none" ///< a plugin with no family: its panel is laid out from its groups and roles
#define OMX_PANEL_FAMILIES_GATE "gate" ///< a gate or expander
#define OMX_PANEL_FAMILIES_DYNAMICS "dynamics" ///< a compressor
#define OMX_PANEL_FAMILIES_LIMITER "limiter" ///< a limiter
#define OMX_PANEL_FAMILIES_DEESSER "deesser" ///< a de-esser
#define OMX_PANEL_FAMILIES_EQ "eq" ///< an equaliser, parametric or graphic
#define OMX_PANEL_FAMILIES_FILTER "filter" ///< a filter
#define OMX_PANEL_FAMILIES_DRIVE "drive" ///< a saturator or distortion
#define OMX_PANEL_FAMILIES_MODULATION "modulation" ///< a chorus, flanger, phaser or tremolo
#define OMX_PANEL_FAMILIES_DELAY "delay" ///< a delay
#define OMX_PANEL_FAMILIES_REVERB "reverb" ///< a reverb
#define OMX_PANEL_FAMILIES_PITCH "pitch" ///< a pitch shifter
#define OMX_PANEL_FAMILIES_COUNT 12u
#define OMX_PANEL_FAMILIES_INIT { "none", "gate", "dynamics", "limiter", "deesser", "eq", "filter", "drive", "modulation", "delay", "reverb", "pitch" }

/* PANEL_STANDARD_WIDGETS (data/panel.json) */
#define OMX_PANEL_STANDARD_WIDGETS_KNOB "knob" ///< a travel
#define OMX_PANEL_STANDARD_WIDGETS_FADER "fader" ///< a travel drawn long
#define OMX_PANEL_STANDARD_WIDGETS_SWITCH "switch" ///< a toggle
#define OMX_PANEL_STANDARD_WIDGETS_SELECTOR "selector" ///< an integer travel or labelled values
#define OMX_PANEL_STANDARD_WIDGETS_METER "meter" ///< a readout
#define OMX_PANEL_STANDARD_WIDGETS_CURVE "curve" ///< a response or transfer curve
#define OMX_PANEL_STANDARD_WIDGETS_XY "xy" ///< two controls drawn as one point
#define OMX_PANEL_STANDARD_WIDGETS_DISPLAY "display" ///< a value shown as text
#define OMX_PANEL_STANDARD_WIDGETS_COUNT 8u
#define OMX_PANEL_STANDARD_WIDGETS_INIT { "knob", "fader", "switch", "selector", "meter", "curve", "xy", "display" }

/* PANEL_WIDGETS (data/panel.json) */
#define OMX_PANEL_WIDGETS_AUTO "auto" ///< left out of a panel declaration: the layout picks the widget from the control
#define OMX_PANEL_WIDGETS_KNOB "knob" ///< a rotary control
#define OMX_PANEL_WIDGETS_FADER "fader" ///< a linear control
#define OMX_PANEL_WIDGETS_SWITCH "switch" ///< a two-state control
#define OMX_PANEL_WIDGETS_SELECTOR "selector" ///< a control that picks one of a few values
#define OMX_PANEL_WIDGETS_COUNT 5u
#define OMX_PANEL_WIDGETS_INIT { "auto", "knob", "fader", "switch", "selector" }

/* PLUGIN_FEATURE_AUDIO_EFFECT (data/plugin-features.json) */
#define OMX_PLUGIN_FEATURE_AUDIO_EFFECT_CLAP_AUDIO_EFFECT "clap.audio-effect"
#define OMX_PLUGIN_FEATURE_AUDIO_EFFECT_CLAP_CHORUS "clap.chorus"
#define OMX_PLUGIN_FEATURE_AUDIO_EFFECT_CLAP_COMPRESSOR "clap.compressor"
#define OMX_PLUGIN_FEATURE_AUDIO_EFFECT_CLAP_DE_ESSER "clap.de-esser"
#define OMX_PLUGIN_FEATURE_AUDIO_EFFECT_CLAP_DELAY "clap.delay"
#define OMX_PLUGIN_FEATURE_AUDIO_EFFECT_CLAP_DISTORTION "clap.distortion"
#define OMX_PLUGIN_FEATURE_AUDIO_EFFECT_CLAP_EQUALIZER "clap.equalizer"
#define OMX_PLUGIN_FEATURE_AUDIO_EFFECT_CLAP_EXPANDER "clap.expander"
#define OMX_PLUGIN_FEATURE_AUDIO_EFFECT_CLAP_FILTER "clap.filter"
#define OMX_PLUGIN_FEATURE_AUDIO_EFFECT_CLAP_FLANGER "clap.flanger"
#define OMX_PLUGIN_FEATURE_AUDIO_EFFECT_CLAP_FREQUENCY_SHIFTER "clap.frequency-shifter"
#define OMX_PLUGIN_FEATURE_AUDIO_EFFECT_CLAP_GATE "clap.gate"
#define OMX_PLUGIN_FEATURE_AUDIO_EFFECT_CLAP_GLITCH "clap.glitch"
#define OMX_PLUGIN_FEATURE_AUDIO_EFFECT_CLAP_GRANULAR "clap.granular"
#define OMX_PLUGIN_FEATURE_AUDIO_EFFECT_CLAP_LIMITER "clap.limiter"
#define OMX_PLUGIN_FEATURE_AUDIO_EFFECT_CLAP_MASTERING "clap.mastering"
#define OMX_PLUGIN_FEATURE_AUDIO_EFFECT_CLAP_MIXING "clap.mixing"
#define OMX_PLUGIN_FEATURE_AUDIO_EFFECT_CLAP_MULTI_EFFECTS "clap.multi-effects"
#define OMX_PLUGIN_FEATURE_AUDIO_EFFECT_CLAP_PHASE_VOCODER "clap.phase-vocoder"
#define OMX_PLUGIN_FEATURE_AUDIO_EFFECT_CLAP_PHASER "clap.phaser"
#define OMX_PLUGIN_FEATURE_AUDIO_EFFECT_CLAP_PITCH_CORRECTION "clap.pitch-correction"
#define OMX_PLUGIN_FEATURE_AUDIO_EFFECT_CLAP_PITCH_SHIFTER "clap.pitch-shifter"
#define OMX_PLUGIN_FEATURE_AUDIO_EFFECT_CLAP_RESTORATION "clap.restoration"
#define OMX_PLUGIN_FEATURE_AUDIO_EFFECT_CLAP_REVERB "clap.reverb"
#define OMX_PLUGIN_FEATURE_AUDIO_EFFECT_CLAP_TRANSIENT_SHAPER "clap.transient-shaper"
#define OMX_PLUGIN_FEATURE_AUDIO_EFFECT_CLAP_TREMOLO "clap.tremolo"
#define OMX_PLUGIN_FEATURE_AUDIO_EFFECT_CLAP_UTILITY "clap.utility"
#define OMX_PLUGIN_FEATURE_AUDIO_EFFECT_LV2_ALLPASS "lv2.Allpass"
#define OMX_PLUGIN_FEATURE_AUDIO_EFFECT_LV2_AMPLIFIER "lv2.Amplifier"
#define OMX_PLUGIN_FEATURE_AUDIO_EFFECT_LV2_BANDPASS "lv2.Bandpass"
#define OMX_PLUGIN_FEATURE_AUDIO_EFFECT_LV2_CHORUS "lv2.Chorus"
#define OMX_PLUGIN_FEATURE_AUDIO_EFFECT_LV2_COMB "lv2.Comb"
#define OMX_PLUGIN_FEATURE_AUDIO_EFFECT_LV2_COMPRESSOR "lv2.Compressor"
#define OMX_PLUGIN_FEATURE_AUDIO_EFFECT_LV2_CONVERTER "lv2.Converter"
#define OMX_PLUGIN_FEATURE_AUDIO_EFFECT_LV2_DELAY "lv2.Delay"
#define OMX_PLUGIN_FEATURE_AUDIO_EFFECT_LV2_DISTORTION "lv2.Distortion"
#define OMX_PLUGIN_FEATURE_AUDIO_EFFECT_LV2_DYNAMICS "lv2.Dynamics"
#define OMX_PLUGIN_FEATURE_AUDIO_EFFECT_LV2_EQ "lv2.EQ"
#define OMX_PLUGIN_FEATURE_AUDIO_EFFECT_LV2_ENVELOPE "lv2.Envelope"
#define OMX_PLUGIN_FEATURE_AUDIO_EFFECT_LV2_EXPANDER "lv2.Expander"
#define OMX_PLUGIN_FEATURE_AUDIO_EFFECT_LV2_FILTER "lv2.Filter"
#define OMX_PLUGIN_FEATURE_AUDIO_EFFECT_LV2_FLANGER "lv2.Flanger"
#define OMX_PLUGIN_FEATURE_AUDIO_EFFECT_LV2_GATE "lv2.Gate"
#define OMX_PLUGIN_FEATURE_AUDIO_EFFECT_LV2_HIGHPASS "lv2.Highpass"
#define OMX_PLUGIN_FEATURE_AUDIO_EFFECT_LV2_LIMITER "lv2.Limiter"
#define OMX_PLUGIN_FEATURE_AUDIO_EFFECT_LV2_LOWPASS "lv2.Lowpass"
#define OMX_PLUGIN_FEATURE_AUDIO_EFFECT_LV2_MIXER "lv2.Mixer"
#define OMX_PLUGIN_FEATURE_AUDIO_EFFECT_LV2_MODULATOR "lv2.Modulator"
#define OMX_PLUGIN_FEATURE_AUDIO_EFFECT_LV2_MULTI_EQ "lv2.MultiEQ"
#define OMX_PLUGIN_FEATURE_AUDIO_EFFECT_LV2_PARA_EQ "lv2.ParaEQ"
#define OMX_PLUGIN_FEATURE_AUDIO_EFFECT_LV2_PHASER "lv2.Phaser"
#define OMX_PLUGIN_FEATURE_AUDIO_EFFECT_LV2_PITCH "lv2.Pitch"
#define OMX_PLUGIN_FEATURE_AUDIO_EFFECT_LV2_REVERB "lv2.Reverb"
#define OMX_PLUGIN_FEATURE_AUDIO_EFFECT_LV2_SIMULATOR "lv2.Simulator"
#define OMX_PLUGIN_FEATURE_AUDIO_EFFECT_LV2_SPATIAL "lv2.Spatial"
#define OMX_PLUGIN_FEATURE_AUDIO_EFFECT_LV2_SPECTRAL "lv2.Spectral"
#define OMX_PLUGIN_FEATURE_AUDIO_EFFECT_LV2_UTILITY "lv2.Utility"
#define OMX_PLUGIN_FEATURE_AUDIO_EFFECT_LV2_WAVESHAPER "lv2.Waveshaper"
#define OMX_PLUGIN_FEATURE_AUDIO_EFFECT_COUNT 58u
#define OMX_PLUGIN_FEATURE_AUDIO_EFFECT_INIT { "clap.audio-effect", "clap.chorus", "clap.compressor", "clap.de-esser", "clap.delay", "clap.distortion", "clap.equalizer", "clap.expander", "clap.filter", "clap.flanger", "clap.frequency-shifter", "clap.gate", "clap.glitch", "clap.granular", "clap.limiter", "clap.mastering", "clap.mixing", "clap.multi-effects", "clap.phase-vocoder", "clap.phaser", "clap.pitch-correction", "clap.pitch-shifter", "clap.restoration", "clap.reverb", "clap.transient-shaper", "clap.tremolo", "clap.utility", "lv2.Allpass", "lv2.Amplifier", "lv2.Bandpass", "lv2.Chorus", "lv2.Comb", "lv2.Compressor", "lv2.Converter", "lv2.Delay", "lv2.Distortion", "lv2.Dynamics", "lv2.EQ", "lv2.Envelope", "lv2.Expander", "lv2.Filter", "lv2.Flanger", "lv2.Gate", "lv2.Highpass", "lv2.Limiter", "lv2.Lowpass", "lv2.Mixer", "lv2.Modulator", "lv2.MultiEQ", "lv2.ParaEQ", "lv2.Phaser", "lv2.Pitch", "lv2.Reverb", "lv2.Simulator", "lv2.Spatial", "lv2.Spectral", "lv2.Utility", "lv2.Waveshaper" }

/* PLUGIN_FEATURE_INSTRUMENT (data/plugin-features.json) */
#define OMX_PLUGIN_FEATURE_INSTRUMENT_CLAP_DRUM "clap.drum"
#define OMX_PLUGIN_FEATURE_INSTRUMENT_CLAP_DRUM_MACHINE "clap.drum-machine"
#define OMX_PLUGIN_FEATURE_INSTRUMENT_CLAP_INSTRUMENT "clap.instrument"
#define OMX_PLUGIN_FEATURE_INSTRUMENT_CLAP_SAMPLER "clap.sampler"
#define OMX_PLUGIN_FEATURE_INSTRUMENT_CLAP_SYNTHESIZER "clap.synthesizer"
#define OMX_PLUGIN_FEATURE_INSTRUMENT_LV2_INSTRUMENT "lv2.Instrument"
#define OMX_PLUGIN_FEATURE_INSTRUMENT_COUNT 6u
#define OMX_PLUGIN_FEATURE_INSTRUMENT_INIT { "clap.drum", "clap.drum-machine", "clap.instrument", "clap.sampler", "clap.synthesizer", "lv2.Instrument" }

/* PLUGIN_FEATURE_NOTE_EFFECT (data/plugin-features.json) */
#define OMX_PLUGIN_FEATURE_NOTE_EFFECT_CLAP_NOTE_EFFECT "clap.note-effect"
#define OMX_PLUGIN_FEATURE_NOTE_EFFECT_LV2_MIDI "lv2.MIDI"
#define OMX_PLUGIN_FEATURE_NOTE_EFFECT_COUNT 2u
#define OMX_PLUGIN_FEATURE_NOTE_EFFECT_INIT { "clap.note-effect", "lv2.MIDI" }

/* PLUGIN_FEATURE_ANALYZER (data/plugin-features.json) */
#define OMX_PLUGIN_FEATURE_ANALYZER_CLAP_ANALYZER "clap.analyzer"
#define OMX_PLUGIN_FEATURE_ANALYZER_CLAP_NOTE_DETECTOR "clap.note-detector"
#define OMX_PLUGIN_FEATURE_ANALYZER_LV2_ANALYSER "lv2.Analyser"
#define OMX_PLUGIN_FEATURE_ANALYZER_COUNT 3u
#define OMX_PLUGIN_FEATURE_ANALYZER_INIT { "clap.analyzer", "clap.note-detector", "lv2.Analyser" }

/* PLUGIN_FEATURE_OTHER (data/plugin-features.json) */
#define OMX_PLUGIN_FEATURE_OTHER_CLAP_AMBISONIC "clap.ambisonic"
#define OMX_PLUGIN_FEATURE_OTHER_CLAP_MONO "clap.mono"
#define OMX_PLUGIN_FEATURE_OTHER_CLAP_STEREO "clap.stereo"
#define OMX_PLUGIN_FEATURE_OTHER_CLAP_SURROUND "clap.surround"
#define OMX_PLUGIN_FEATURE_OTHER_LV2_CONSTANT "lv2.Constant"
#define OMX_PLUGIN_FEATURE_OTHER_LV2_FUNCTION "lv2.Function"
#define OMX_PLUGIN_FEATURE_OTHER_LV2_GENERATOR "lv2.Generator"
#define OMX_PLUGIN_FEATURE_OTHER_LV2_OSCILLATOR "lv2.Oscillator"
#define OMX_PLUGIN_FEATURE_OTHER_LV2_PLUGIN "lv2.Plugin"
#define OMX_PLUGIN_FEATURE_OTHER_COUNT 9u
#define OMX_PLUGIN_FEATURE_OTHER_INIT { "clap.ambisonic", "clap.mono", "clap.stereo", "clap.surround", "lv2.Constant", "lv2.Function", "lv2.Generator", "lv2.Oscillator", "lv2.Plugin" }

/* RESOURCE_KINDS (data/resource-profile.json) */
#define OMX_RESOURCE_KINDS_CPU "cpu" ///< The cost per sample at a rate and quantum, its percentile and its tail (plugin-qualify#115).
#define OMX_RESOURCE_KINDS_MEMORY "memory" ///< The footprint per instance and its growth over a soak (plugin-qualify#114).
#define OMX_RESOURCE_KINDS_SCRATCH_MEMORY "scratch-memory" ///< The memory a plugin asks of its host for its process call.
#define OMX_RESOURCE_KINDS_LATENCY "latency" ///< The frames a plugin delays its output by, per rate and quantum.
#define OMX_RESOURCE_KINDS_TAIL "tail" ///< How long a plugin keeps sounding once its input goes silent.
#define OMX_RESOURCE_KINDS_VOICES "voices" ///< The notes an instrument plays at once.
#define OMX_RESOURCE_KINDS_STARTUP "startup" ///< The wall time of instantiate, activate and the first block.
#define OMX_RESOURCE_KINDS_THREADS "threads" ///< The threads a plugin starts and their scheduling class, or the host thread pool it asks for.
#define OMX_RESOURCE_KINDS_WORKER "worker" ///< The work a plugin hands to a non-real-time thread of the host.
#define OMX_RESOURCE_KINDS_BLOCK_LENGTH "block-length" ///< The block lengths a plugin accepts.
#define OMX_RESOURCE_KINDS_OPEN_FILES "open-files" ///< The file descriptors a plugin holds after activate, and their growth.
#define OMX_RESOURCE_KINDS_DISK_IO "disk-io" ///< The bytes a plugin reads at load and while it processes.
#define OMX_RESOURCE_KINDS_NETWORK "network" ///< Any socket a plugin opens.
#define OMX_RESOURCE_KINDS_STATE "state" ///< The size of a plugin's saved state, its save and restore time, and its round trip.
#define OMX_RESOURCE_KINDS_COUNT 14u
#define OMX_RESOURCE_KINDS_INIT { "cpu", "memory", "scratch-memory", "latency", "tail", "voices", "startup", "threads", "worker", "block-length", "open-files", "disk-io", "network", "state" }

/* RESOURCE_UNITS (data/resource-profile.json) */
#define OMX_RESOURCE_UNITS_NS_PER_SAMPLE "ns-per-sample"
#define OMX_RESOURCE_UNITS_FRAMES "frames"
#define OMX_RESOURCE_UNITS_MS "ms"
#define OMX_RESOURCE_UNITS_US "us"
#define OMX_RESOURCE_UNITS_S "s"
#define OMX_RESOURCE_UNITS_BYTES "bytes"
#define OMX_RESOURCE_UNITS_PLAIN_COUNT "count"
#define OMX_RESOURCE_UNITS_RATIO "ratio"
#define OMX_RESOURCE_UNITS_FLAG "flag" ///< A yes or a no: one when the plugin does the thing, zero when it does not.
#define OMX_RESOURCE_UNITS_COUNT 9u
#define OMX_RESOURCE_UNITS_INIT { "ns-per-sample", "frames", "ms", "us", "s", "bytes", "count", "ratio", "flag" }

/* RESOURCE_BASES (data/resource-profile.json) */
#define OMX_RESOURCE_BASES_DECLARED "declared"
#define OMX_RESOURCE_BASES_MEASURED "measured"
#define OMX_RESOURCE_BASES_PROBE "probe"
#define OMX_RESOURCE_BASES_COUNT 3u
#define OMX_RESOURCE_BASES_INIT { "declared", "measured", "probe" }

/* RESOURCE_MEMORY_PHASES (data/resource-profile.json) */
#define OMX_RESOURCE_MEMORY_PHASES_AFTER_INSTANTIATE "after-instantiate"
#define OMX_RESOURCE_MEMORY_PHASES_AFTER_ACTIVATE "after-activate"
#define OMX_RESOURCE_MEMORY_PHASES_AT_REST "at-rest"
#define OMX_RESOURCE_MEMORY_PHASES_NOTES_HELD "notes-held"
#define OMX_RESOURCE_MEMORY_PHASES_SECOND_INSTANCE "second-instance"
#define OMX_RESOURCE_MEMORY_PHASES_COUNT 5u
#define OMX_RESOURCE_MEMORY_PHASES_INIT { "after-instantiate", "after-activate", "at-rest", "notes-held", "second-instance" }

/* RESOURCE_UNMEASURED_REASONS (data/resource-profile.json) */
#define OMX_RESOURCE_UNMEASURED_REASONS_UNMEASURED_ON_CLASS "unmeasured-on-class" ///< The only figure was taken on another machine class: never read as a pass, never scaled.
#define OMX_RESOURCE_UNMEASURED_REASONS_LIMIT_EXCEEDED "limit-exceeded" ///< The run hit the limit probe isolation set for the resource; the limit is recorded beside it.
#define OMX_RESOURCE_UNMEASURED_REASONS_COUNT 2u
#define OMX_RESOURCE_UNMEASURED_REASONS_INIT { "unmeasured-on-class", "limit-exceeded" }

/* RESOURCE_BUDGET_SCOPES (data/resource-profile.json) */
#define OMX_RESOURCE_BUDGET_SCOPES_PER_INSTANCE "per-instance"
#define OMX_RESOURCE_BUDGET_SCOPES_PER_CONSOLE "per-console"
#define OMX_RESOURCE_BUDGET_SCOPES_COUNT 2u
#define OMX_RESOURCE_BUDGET_SCOPES_INIT { "per-instance", "per-console" }

/* RESOURCE_HOST_ISOLATIONS (data/resource-profile.json) */
#define OMX_RESOURCE_HOST_ISOLATIONS_IN_PROCESS "in-process"
#define OMX_RESOURCE_HOST_ISOLATIONS_PER_PROCESS "per-process"
#define OMX_RESOURCE_HOST_ISOLATIONS_SHARED_PROCESS "shared-process"
#define OMX_RESOURCE_HOST_ISOLATIONS_COUNT 3u
#define OMX_RESOURCE_HOST_ISOLATIONS_INIT { "in-process", "per-process", "shared-process" }

/* RESOURCE_HOST_LATENCY_HANDLING (data/resource-profile.json) */
#define OMX_RESOURCE_HOST_LATENCY_HANDLING_COMPENSATED "compensated"
#define OMX_RESOURCE_HOST_LATENCY_HANDLING_UNCOMPENSATED "uncompensated"
#define OMX_RESOURCE_HOST_LATENCY_HANDLING_COUNT 2u
#define OMX_RESOURCE_HOST_LATENCY_HANDLING_INIT { "compensated", "uncompensated" }

/* RESOURCE_THREAD_SCHEDULING (data/resource-profile.json) */
#define OMX_RESOURCE_THREAD_SCHEDULING_NONE "none"
#define OMX_RESOURCE_THREAD_SCHEDULING_FIFO "fifo"
#define OMX_RESOURCE_THREAD_SCHEDULING_COUNT 2u
#define OMX_RESOURCE_THREAD_SCHEDULING_INIT { "none", "fifo" }

/* RESOURCE_HINTS (data/resource-profile.json) */
#define OMX_RESOURCE_HINTS_FOOTPRINT_AT_REST "footprint-at-rest" ///< The memory one instance holds at rest, once activated and idle, with no note playing.
#define OMX_RESOURCE_HINTS_FOOTPRINT_PER_VOICE "footprint-per-voice" ///< The memory each voice adds while it plays, for an instrument.
#define OMX_RESOURCE_HINTS_SHARED_LOAD "shared-load" ///< The one-time load every instance of the plugin shares, counted once however many are instantiated.
#define OMX_RESOURCE_HINTS_THREADS_SPAWNED "threads-spawned" ///< The threads the plugin starts itself, apart from any it asks the host pool for.
#define OMX_RESOURCE_HINTS_STREAMS_FROM_DISK "streams-from-disk" ///< Whether the plugin reads from disk while it processes.
#define OMX_RESOURCE_HINTS_OPENS_SOCKETS "opens-sockets" ///< Whether the plugin opens any socket.
#define OMX_RESOURCE_HINTS_ACTIVATE_TIME "activate-time" ///< The wall time of activate and the first block the plugin expects.
#define OMX_RESOURCE_HINTS_COUNT 7u
#define OMX_RESOURCE_HINTS_INIT { "footprint-at-rest", "footprint-per-voice", "shared-load", "threads-spawned", "streams-from-disk", "opens-sockets", "activate-time" }

/* SCAN_DOCUMENTS (data/scan.json) */
#define OMX_SCAN_DOCUMENTS_CLAP_SCAN_DOCUMENT "CLAP_SCAN_DOCUMENT" ///< The JSON document of omx-clap-scan, one entry per file with its plugins, parameters and ports. Owned by omx-clap-core, which writes it; its shape is omx-clap-core's reference.
#define OMX_SCAN_DOCUMENTS_FIELD_DUMP "FIELD_DUMP" ///< The field dump of omx-clap-scan --fields: the line `# omx-clap-scan --fields 1`, the format's version, then one `<scope> TAB <field> TAB <value>` record per field a plugin states. Its scopes are SCAN_FIELD_SCOPES.
#define OMX_SCAN_DOCUMENTS_COUNT 2u
#define OMX_SCAN_DOCUMENTS_INIT { "CLAP_SCAN_DOCUMENT", "FIELD_DUMP" }

/* SCAN_FIELD_SCOPES (data/scan.json) */
#define OMX_SCAN_FIELD_SCOPES_PLUGIN "plugin" ///< the plugin as a whole
#define OMX_SCAN_FIELD_SCOPES_PARAM "param" ///< a CLAP parameter, indexed in get_info order
#define OMX_SCAN_FIELD_SCOPES_AUDIO_IN "audio_in" ///< an audio input port, indexed
#define OMX_SCAN_FIELD_SCOPES_AUDIO_OUT "audio_out" ///< an audio output port, indexed
#define OMX_SCAN_FIELD_SCOPES_NOTE_IN "note_in" ///< a note input port, indexed
#define OMX_SCAN_FIELD_SCOPES_NOTE_OUT "note_out" ///< a note output port, indexed
#define OMX_SCAN_FIELD_SCOPES_PORT "port" ///< an LV2 port, indexed by lv2:index
#define OMX_SCAN_FIELD_SCOPES_PANEL "panel" ///< the panel description of a plugin that serves org.openmixer.panel-description/1: its family and fingerprint
#define OMX_SCAN_FIELD_SCOPES_SECTION "section" ///< a section of the panel description, indexed
#define OMX_SCAN_FIELD_SCOPES_CONTROL "control" ///< a control of the panel description, indexed
#define OMX_SCAN_FIELD_SCOPES_ROLE "role" ///< a role of the panel description, indexed
#define OMX_SCAN_FIELD_SCOPES_DISPLAY "display" ///< a display of the panel description, indexed
#define OMX_SCAN_FIELD_SCOPES_PLACEMENT_DEFAULT "placement_default" ///< a per-placement come-up value of the panel description, indexed
#define OMX_SCAN_FIELD_SCOPES_COUNT 13u
#define OMX_SCAN_FIELD_SCOPES_INIT { "plugin", "param", "audio_in", "audio_out", "note_in", "note_out", "port", "panel", "section", "control", "role", "display", "placement_default" }

/* VERB_HOSTS (data/verbs.json) */
#define OMX_VERB_HOSTS_PLUGIN_HOSTD "plugin-hostd" ///< The daemon that places plugins in workers and answers the verbs it adds itself.
#define OMX_VERB_HOSTS_OMX_CLAP_HOST "omx-clap-host" ///< omx-clap-core's worker: a CLAP plugin's host, and an LV2 plugin's through its adapter.
#define OMX_VERB_HOSTS_MOD_HOST "mod-host" ///< mod-host, the LV2 host whose protocol the others speak.
#define OMX_VERB_HOSTS_COUNT 3u
#define OMX_VERB_HOSTS_INIT { "plugin-hostd", "omx-clap-host", "mod-host" }

#endif /* OMX_VOCABULARY_H */
