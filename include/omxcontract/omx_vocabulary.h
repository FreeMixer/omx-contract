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

/* HOSTING_CLAP_CODES (data/hosting/clap.json) */
#define OMX_HOSTING_CLAP_EXTENSIONS_NOT_COVERED "hosting.clap.extensions-not-covered"
#define OMX_HOSTING_CLAP_FORMAT_NOT_HOSTED "hosting.clap.format-not-hosted"
#define OMX_HOSTING_CLAP_HEADLESS_FAILED "hosting.clap.headless-failed"
#define OMX_HOSTING_CLAP_LATENCY_MISMATCH "hosting.clap.latency-mismatch"
#define OMX_HOSTING_CLAP_NOT_AUDIO_EFFECT "hosting.clap.not-audio-effect" ///< the plugin is not an audio effect
#define OMX_HOSTING_CLAP_NOTE_INPUT "hosting.clap.note-input" ///< the plugin declares a note input the configuration refuses
#define OMX_HOSTING_CLAP_PROCESS_ERROR "hosting.clap.process-error"
#define OMX_HOSTING_CLAP_THREAD_VIOLATION "hosting.clap.thread-violation"
#define OMX_HOSTING_CLAP_UNQUALIFIED "hosting.clap.unqualified"

/* HOSTING_COST_CODES (data/hosting/cost.json) */
#define OMX_HOSTING_COST_ABOVE_CEILING "hosting.cost.above-ceiling"
#define OMX_HOSTING_COST_FIELDS_MISSING "hosting.cost.fields-missing"
#define OMX_HOSTING_COST_SPIKY_TAIL "hosting.cost.spiky-tail"
#define OMX_HOSTING_COST_UNMEASURED_AT_RATE_AND_QUANTUM "hosting.cost.unmeasured-at-rate-and-quantum"
#define OMX_HOSTING_COST_WITHIN_CEILING "hosting.cost.within-ceiling"

/* HOSTING_FEATURES_CODES (data/hosting/features.json) */
#define OMX_HOSTING_FEATURES_ATOM_IN_UNFED "hosting.features.atom-in-unfed" ///< a non-MIDI atom input no buffer here can feed
#define OMX_HOSTING_FEATURES_CV_PORTS "hosting.features.cv-ports"
#define OMX_HOSTING_FEATURES_HOST_NOT_PROVIDED "hosting.features.host-not-provided"
#define OMX_HOSTING_FEATURES_MIDI_IN_FED_EMPTY "hosting.features.midi-in-fed-empty"
#define OMX_HOSTING_FEATURES_REQUIRED_NOT_PROVIDED "hosting.features.required-not-provided" ///< retired (omx-contract#127): hosting.features.missing names the same fact; plugin-qualify stops writing this one (plugin-qualify#120), and the first major release removes it
#define OMX_HOSTING_FEATURES_MISSING "hosting.features.missing"
#define OMX_HOSTING_FEATURES_ALL_PROVIDED "hosting.features.all-provided"
#define OMX_HOSTING_FEATURES_SCAN_PREDATES_FIELD "hosting.features.scan-predates-field"

/* HOSTING_INTEGRITY_CODES (data/hosting/integrity.json) */
#define OMX_HOSTING_INTEGRITY_BINARY_MISMATCH "hosting.integrity.binary-mismatch"
#define OMX_HOSTING_INTEGRITY_LAYOUT_MISMATCH "hosting.integrity.layout-mismatch"
#define OMX_HOSTING_INTEGRITY_UNPINNED "hosting.integrity.unpinned"

/* HOSTING_LATENCY_CODES (data/hosting/latency.json) */
#define OMX_HOSTING_LATENCY_NONCONFORMING "hosting.latency.nonconforming"
#define OMX_HOSTING_LATENCY_PARAMETER_DEPENDENT "hosting.latency.parameter-dependent"
#define OMX_HOSTING_LATENCY_RESOLVED "hosting.latency.resolved"
#define OMX_HOSTING_LATENCY_UNMEASURED "hosting.latency.unmeasured"

/* HOSTING_OUTPUT_CODES (data/hosting/output.json) */
#define OMX_HOSTING_OUTPUT_NON_FINITE "hosting.output.non-finite" ///< the plugin produced non-finite output

/* HOSTING_OVERRIDE_CODES (data/hosting/override.json) */
#define OMX_HOSTING_OVERRIDE_CURATOR_ISOLATED "hosting.override.curator-isolated"

/* HOSTING_PATCH_CODES (data/hosting/patch.json) */
#define OMX_HOSTING_PATCH_BUSY "hosting.patch.busy"
#define OMX_HOSTING_PATCH_NOT_WRITABLE "hosting.patch.not-writable"
#define OMX_HOSTING_PATCH_TOO_LARGE "hosting.patch.too-large"

/* HOSTING_PRESET_CODES (data/hosting/preset.json) */
#define OMX_HOSTING_PRESET_NOT_FOUND "hosting.preset.not-found"

/* HOSTING_PROVENANCE_CODES (data/hosting/provenance.json) */
#define OMX_HOSTING_PROVENANCE_HOST_DIFFERS "hosting.provenance.host-differs"
#define OMX_HOSTING_PROVENANCE_SWEEP_CONTROL_DID_NOT_FIRE "hosting.provenance.sweep-control-did-not-fire"

/* HOSTING_REALISED_CODES (data/hosting/realised.json) */
#define OMX_HOSTING_DISABLED "hosting.disabled"
#define OMX_HOSTING_LINKED "hosting.linked"
#define OMX_HOSTING_NO_REALISATION "hosting.no-realisation"
#define OMX_HOSTING_REALISED_IN_PROCESS "hosting.realised.in-process"
#define OMX_HOSTING_UNJUDGED "hosting.unjudged"

/* HOSTING_RT_SAFETY_CODES (data/hosting/rt-safety.json) */
#define OMX_HOSTING_RT_SAFETY_CLEAN_UNDER_SWEEP "hosting.rt-safety.clean-under-sweep"
#define OMX_HOSTING_RT_SAFETY_NOT_REPRODUCIBLE "hosting.rt-safety.not-reproducible"
#define OMX_HOSTING_RT_SAFETY_CLEAN_UNDER_NOTES "hosting.rt-safety.clean-under-notes"
#define OMX_HOSTING_RT_SAFETY_NOTES_UNMEASURED "hosting.rt-safety.notes-unmeasured"
#define OMX_HOSTING_RT_SAFETY_VIOLATIONS_UNDER_NOTES "hosting.rt-safety.violations-under-notes"
#define OMX_HOSTING_RT_SAFETY_UNMEASURED "hosting.rt-safety.unmeasured"
#define OMX_HOSTING_RT_SAFETY_VIOLATIONS_IN_RUN "hosting.rt-safety.violations-in-run"

/* HOSTING_STABILITY_CODES (data/hosting/stability.json) */
#define OMX_HOSTING_STABILITY_CYCLES_BELOW_FLOOR "hosting.stability.cycles-below-floor"
#define OMX_HOSTING_STABILITY_CRASH_UNATTRIBUTED "hosting.stability.crash-unattributed"
#define OMX_HOSTING_STABILITY_CRASHED_ATTRIBUTED_PLUGIN "hosting.stability.crashed-attributed-plugin"
#define OMX_HOSTING_STABILITY_CRASHED_LIVE_ON_THIS_RIG "hosting.stability.crashed-live-on-this-rig" ///< the plugin crashed live on this rig
#define OMX_HOSTING_STABILITY_LINKS_GUI_TOOLKIT "hosting.stability.links-gui-toolkit"
#define OMX_HOSTING_STABILITY_SOAK_FAILED_AT_RATE "hosting.stability.soak-failed-at-rate"
#define OMX_HOSTING_STABILITY_SOAKED "hosting.stability.soaked"
#define OMX_HOSTING_STABILITY_SPAWNS_THREADS "hosting.stability.spawns-threads"
#define OMX_HOSTING_STABILITY_UNMEASURED "hosting.stability.unmeasured"
#define OMX_HOSTING_STABILITY_UNSOAKED "hosting.stability.unsoaked"

/* HOSTING_STATE_CODES (data/hosting/state.json) */
#define OMX_HOSTING_STATE_NOT_A_COPY "hosting.state.not-a-copy" ///< not a save's copy directory of the root
#define OMX_HOSTING_STATE_PATH_ON_AUDIO "hosting.state.path-on-audio" ///< makePath: called on the audio role
#define OMX_HOSTING_STATE_PATH_OUTSIDE "hosting.state.path-outside" ///< makePath: empty, absolute, or a `..` component
#define OMX_HOSTING_STATE_PATH_SYMLINK "hosting.state.path-symlink" ///< makePath: a component is a symbolic link
#define OMX_HOSTING_STATE_PATH_TOO_LONG "hosting.state.path-too-long" ///< makePath: PATH_MAX or more, or a long component
#define OMX_HOSTING_STATE_PATH_UNMAKEABLE "hosting.state.path-unmakeable" ///< makePath: a directory could not be made
#define OMX_HOSTING_STATE_UNREADABLE "hosting.state.unreadable"

/* HOSTING_TOPOLOGY_CODES (data/hosting/topology.json) */
#define OMX_HOSTING_TOPOLOGY_AMBISONIC_CONFIG "hosting.topology.ambisonic-config" ///< an ambisonic port refuses the carrier's ordering or normalisation
#define OMX_HOSTING_TOPOLOGY_CHANNEL_MAP_UNKNOWN "hosting.topology.channel-map-unknown" ///< a surround port names a channel id the host does not know, or refuses the carrier's channel mask
#define OMX_HOSTING_TOPOLOGY_EXTRA_INPUTS_FED_SILENCE "hosting.topology.extra-inputs-fed-silence" ///< retired for hosting.topology.too-many-ports: the plugin has extra inputs, fed silence; written by nobody once omx-clap-core#92 lands, and the first major release removes it
#define OMX_HOSTING_TOPOLOGY_INSTRUMENT "hosting.topology.instrument"
#define OMX_HOSTING_TOPOLOGY_MATCHED "hosting.topology.matched"
#define OMX_HOSTING_TOPOLOGY_NO_AUDIO_INPUT "hosting.topology.no-audio-input" ///< the plugin has no audio input
#define OMX_HOSTING_TOPOLOGY_NO_AUDIO_OUTPUT "hosting.topology.no-audio-output" ///< the plugin has no audio output
#define OMX_HOSTING_TOPOLOGY_PORT_TOO_WIDE "hosting.topology.port-too-wide" ///< a port of more channels than the limit, or an ambisonic port whose channels are not (order+1)²
#define OMX_HOSTING_TOPOLOGY_PORT_WITHOUT_CHANNELS "hosting.topology.port-without-channels" ///< a port of zero channels
#define OMX_HOSTING_TOPOLOGY_TOO_MANY_PORTS "hosting.topology.too-many-ports" ///< more than the limit of auxiliary ports on one side, or more than one main port on a side
#define OMX_HOSTING_TOPOLOGY_WIDER_THAN_STRIP "hosting.topology.wider-than-strip" ///< the plugin is wider than the strip

/* HOSTING_WORKER_CODES (data/hosting/worker.json) */
#define OMX_HOSTING_WORKER_NONCONFORMING "hosting.worker.nonconforming"

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
#define OMX_RESOURCE_UNITS_COUNT 8u
#define OMX_RESOURCE_UNITS_INIT { "ns-per-sample", "frames", "ms", "us", "s", "bytes", "count", "ratio" }

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

#endif /* OMX_VOCABULARY_H */
