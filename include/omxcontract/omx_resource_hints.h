// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
#ifndef OMX_RESOURCE_HINTS_H
#define OMX_RESOURCE_HINTS_H
/*
 * GENERATED: DO NOT EDIT BY HAND.
 * Produced by `omx-contract render --target c` from RESOURCE_HINTS (data/resource-profile.json, docs/resource-hints.md):
 * the CLAP extension org.openmixer.resource-hints.draft/0, the hints a plugin declares about its own footprint. A hint is a claim:
 * plugin-qualify measures the same resource and a declared figure the measurement does not bear out is a finding.
 */

#include <stdbool.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

#ifndef CLAP_ABI
#define CLAP_ABI
#endif

struct clap_plugin;

/** The extension id, as a plugin's get_extension is asked for it. */
#define OMX_CLAP_EXT_RESOURCE_HINTS_DRAFT "org.openmixer.resource-hints.draft/0"

/** One bit of `declared` per hint, in the order of RESOURCE_HINTS. */
#define OMX_RESOURCE_HINT_FOOTPRINT_AT_REST (1u << 0) ///< The memory one instance holds at rest, once activated and idle, with no note playing. (bytes)
#define OMX_RESOURCE_HINT_FOOTPRINT_PER_VOICE (1u << 1) ///< The memory each voice adds while it plays, for an instrument. (bytes)
#define OMX_RESOURCE_HINT_SHARED_LOAD (1u << 2) ///< The one-time load every instance of the plugin shares, counted once however many are instantiated. (bytes)
#define OMX_RESOURCE_HINT_THREADS_SPAWNED (1u << 3) ///< The threads the plugin starts itself, apart from any it asks the host pool for. (count)
#define OMX_RESOURCE_HINT_STREAMS_FROM_DISK (1u << 4) ///< Whether the plugin reads from disk while it processes. (flag)
#define OMX_RESOURCE_HINT_OPENS_SOCKETS (1u << 5) ///< Whether the plugin opens any socket. (flag)
#define OMX_RESOURCE_HINT_ACTIVATE_TIME (1u << 6) ///< The wall time of activate and the first block the plugin expects. (ms)

/** The number of hints. */
#define OMX_RESOURCE_HINT_COUNT 7u

/** The hints of a plugin. A member whose bit of `declared` is clear is unknown, never zero. */
typedef struct omx_resource_hints
{
    uint32_t declared; ///< The OMX_RESOURCE_HINT_ bits of the hints the plugin states.
    uint64_t footprint_at_rest; ///< The memory one instance holds at rest, once activated and idle, with no note playing. (bytes)
    uint64_t footprint_per_voice; ///< The memory each voice adds while it plays, for an instrument. (bytes)
    uint64_t shared_load; ///< The one-time load every instance of the plugin shares, counted once however many are instantiated. (bytes)
    uint32_t threads_spawned; ///< The threads the plugin starts itself, apart from any it asks the host pool for. (count)
    bool streams_from_disk; ///< Whether the plugin reads from disk while it processes. (flag)
    bool opens_sockets; ///< Whether the plugin opens any socket. (flag)
    uint32_t activate_time; ///< The wall time of activate and the first block the plugin expects. (ms)
} omx_resource_hints_t;

/** The org.openmixer.resource-hints.draft/0 extension a plugin offers. */
typedef struct omx_clap_plugin_resource_hints
{
    /** [main-thread] Fills `hints`; false when the plugin has none to state. */
    bool (CLAP_ABI *get)(const struct clap_plugin *plugin, omx_resource_hints_t *hints);
} omx_clap_plugin_resource_hints_t;

#ifdef __cplusplus
}
#endif

#endif /* OMX_RESOURCE_HINTS_H */
