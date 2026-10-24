// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
#ifndef OMX_VOCABULARY_H
#define OMX_VOCABULARY_H
/*
 * GENERATED — DO NOT EDIT BY HAND.
 * Produced by `omx-contract render --target c` from FreeMixer/omx-contract's data/: the vocabulary
 * (docs/data-layout.md). A code is OMX_ and the code in upper snake case; a word is OMX_<ITEM>_<NAME>, each words
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

#endif /* OMX_VOCABULARY_H */
