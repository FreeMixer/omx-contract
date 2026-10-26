// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
#ifndef OMX_HOST_VERBS_H
#define OMX_HOST_VERBS_H
/*
 * GENERATED: DO NOT EDIT BY HAND.
 * Produced by `omx-contract render --target c` from the whole read.
 * The host verbs (docs/contract-dir.md): a verb is OMX_VERB_<VERB>, its word, OMX_VERB_<VERB>_FMT, the line
 * protocol_add_command takes, and OMX_VERB_<VERB>_REPLY; a verb that answers refusals carries their resp numbers
 * in OMX_VERB_<VERB>_CODES_INIT. omx_host_verbs() is the table of what each host owes each verb.
 */

#include <string.h>

#ifndef OMX_HOST_VERB_TYPES_H
#define OMX_HOST_VERB_TYPES_H
/* What a host owes a verb: required, answered as its grammar says; optional, answered or refused, never misread;
 * unsupported, refused on purpose. */
enum omx_host_verb_level {
  OMX_HOST_VERB_UNSUPPORTED = 0,
  OMX_HOST_VERB_OPTIONAL = 1,
  OMX_HOST_VERB_REQUIRED = 2,
};
/* The hosts of VERB_HOSTS, a column each of a verb's level, in this order. */
#define OMX_HOST_VERB_HOST_PLUGIN_HOSTD 0u
#define OMX_HOST_VERB_HOST_OMX_CLAP_HOST 1u
#define OMX_HOST_VERB_HOST_MOD_HOST 2u
#define OMX_HOST_VERB_HOST_COUNT 3u
#define OMX_HOST_VERB_HOSTS_INIT { "plugin-hostd", "omx-clap-host", "mod-host" }
struct omx_host_verb {
  const char *verb;
  const char *format;
  const char *reply;
  enum omx_host_verb_level level[OMX_HOST_VERB_HOST_COUNT];
};
#endif /* OMX_HOST_VERB_TYPES_H */

/* HOST_VERBS.trackInfo (data/verbs.json): The strip's name, colour and kind: <instance> <name> <#RRGGBB | -> [bus | return | master]; a CLAP plugin reads them through clap.track-info, and the daemon answers an LV2 instance itself. */
#define OMX_VERB_TRACK_INFO "track_info"
#define OMX_VERB_TRACK_INFO_FMT "track_info %i %s %s ..."
#define OMX_VERB_TRACK_INFO_REPLY "resp 0"
#define OMX_VERB_TRACK_INFO_CODES_COUNT 1u
#define OMX_VERB_TRACK_INFO_CODES_INIT { -902 } /* reply.mod-host.invalid-operation */

/* HOST_VERBS.remotePages (data/verbs.json): The plugin's remote-control pages, from clap.remote-controls; 0 for an LV2 instance. */
#define OMX_VERB_REMOTE_PAGES "remote_pages"
#define OMX_VERB_REMOTE_PAGES_FMT "remote_pages %i"
#define OMX_VERB_REMOTE_PAGES_REPLY "resp <count>"

/* HOST_VERBS.paramInfo (data/verbs.json): What a parameter's value means: its unit, its scale, and the symbol it keeps across hosts and versions. */
#define OMX_VERB_PARAM_INFO "param_info"
#define OMX_VERB_PARAM_INFO_FMT "param_info %i %s"
#define OMX_VERB_PARAM_INFO_REPLY "resp 0 <unit> <scale> <min> <max> <default> <step> <stable_symbol>"
#define OMX_VERB_PARAM_INFO_CODES_COUNT 2u
#define OMX_VERB_PARAM_INFO_CODES_INIT { -103, -511 } /* reply.mod-host.param-symbol-invalid, reply.plugin-hostd.no-param-contract */

/* HOST_VERBS.chain (data/verbs.json): The instances, in this order, are one chain run in one worker: <chain> <instance> [<instance> ...]; a worker that runs chains in one client is sent the line with the members it holds. */
#define OMX_VERB_CHAIN "chain"
#define OMX_VERB_CHAIN_FMT "chain %i %i ..."
#define OMX_VERB_CHAIN_REPLY "resp 0"
#define OMX_VERB_CHAIN_CODES_COUNT 5u
#define OMX_VERB_CHAIN_CODES_INIT { -518, -519, -520, -521, -902 } /* reply.plugin-hostd.chain-unknown-instance, reply.plugin-hostd.chain-duplicate, reply.plugin-hostd.chain-instance-busy, reply.plugin-hostd.chain-mixed-format, reply.mod-host.invalid-operation */

#define OMX_HOST_VERB_COUNT 4u

/* Every verb, in the order of its items, with what each host owes it. */
static inline const struct omx_host_verb *omx_host_verbs(void) {
  static const struct omx_host_verb table[OMX_HOST_VERB_COUNT] = {
    { OMX_VERB_TRACK_INFO, OMX_VERB_TRACK_INFO_FMT, OMX_VERB_TRACK_INFO_REPLY, { OMX_HOST_VERB_OPTIONAL, OMX_HOST_VERB_OPTIONAL, OMX_HOST_VERB_UNSUPPORTED } },
    { OMX_VERB_REMOTE_PAGES, OMX_VERB_REMOTE_PAGES_FMT, OMX_VERB_REMOTE_PAGES_REPLY, { OMX_HOST_VERB_OPTIONAL, OMX_HOST_VERB_OPTIONAL, OMX_HOST_VERB_UNSUPPORTED } },
    { OMX_VERB_PARAM_INFO, OMX_VERB_PARAM_INFO_FMT, OMX_VERB_PARAM_INFO_REPLY, { OMX_HOST_VERB_OPTIONAL, OMX_HOST_VERB_OPTIONAL, OMX_HOST_VERB_UNSUPPORTED } },
    { OMX_VERB_CHAIN, OMX_VERB_CHAIN_FMT, OMX_VERB_CHAIN_REPLY, { OMX_HOST_VERB_REQUIRED, OMX_HOST_VERB_REQUIRED, OMX_HOST_VERB_UNSUPPORTED } },
  };
  return table;
}

/* The verb whose word is `verb`, or NULL. */
static inline const struct omx_host_verb *omx_host_verb_find(const char *verb) {
  const struct omx_host_verb *t = omx_host_verbs();
  for (unsigned i = 0; i < OMX_HOST_VERB_COUNT; i++)
    if (!strcmp(t[i].verb, verb)) return &t[i];
  return NULL;
}

/* What the host at column `host` (an OMX_HOST_VERB_HOST_* index) owes `verb`: unsupported for a verb not here. */
static inline enum omx_host_verb_level omx_host_verb_level(const char *verb, unsigned host) {
  const struct omx_host_verb *v = omx_host_verb_find(verb);
  return v && host < OMX_HOST_VERB_HOST_COUNT ? v->level[host] : OMX_HOST_VERB_UNSUPPORTED;
}

#endif /* OMX_HOST_VERBS_H */
