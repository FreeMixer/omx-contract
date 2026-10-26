// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
#ifndef VERBS_FIXTURE_VOCABULARY_H
#define VERBS_FIXTURE_VOCABULARY_H
/*
 * GENERATED — DO NOT EDIT BY HAND.
 * Produced by `omx-contract render --target c` from FreeMixer/verbs-fixture's data/: the vocabulary
 * (docs/data-layout.md). A code is OMX_ and the code in upper snake case, and a reply code that carries a resp has it as that name and _RESP; a word is OMX_<ITEM>_<NAME>, each words
 * item with its _COUNT and an _INIT of its words in their order. A consumer writes and compares these, never a
 * literal of its own.
 */

/* MOD_HOST_REPLY_CODES (data/errors.json) */
#define OMX_REPLY_MOD_HOST_INVALID_OPERATION "reply.mod-host.invalid-operation" ///< ERR_INVALID_OPERATION: a word outside the verb's grammar
#define OMX_REPLY_MOD_HOST_INVALID_OPERATION_RESP (-902)
#define OMX_REPLY_MOD_HOST_PARAM_SYMBOL_INVALID "reply.mod-host.param-symbol-invalid" ///< ERR_LV2_INVALID_PARAM_SYMBOL: a symbol that is not a parameter of the instance
#define OMX_REPLY_MOD_HOST_PARAM_SYMBOL_INVALID_RESP (-103)

/* PLUGIN_HOSTD_REPLY_CODES (data/errors.json) */
#define OMX_REPLY_PLUGIN_HOSTD_NO_PARAM_CONTRACT "reply.plugin-hostd.no-param-contract" ///< PHD_ERR_NO_PARAM_CONTRACT: the host holds no checked unit and scale for this parameter
#define OMX_REPLY_PLUGIN_HOSTD_NO_PARAM_CONTRACT_RESP (-511)
#define OMX_REPLY_PLUGIN_HOSTD_CHAIN_UNKNOWN_INSTANCE "reply.plugin-hostd.chain-unknown-instance" ///< PHD_ERR_CHAIN_UNKNOWN_INSTANCE: a member is an instance no add made
#define OMX_REPLY_PLUGIN_HOSTD_CHAIN_UNKNOWN_INSTANCE_RESP (-518)
#define OMX_REPLY_PLUGIN_HOSTD_CHAIN_DUPLICATE "reply.plugin-hostd.chain-duplicate" ///< PHD_ERR_CHAIN_DUPLICATE: an instance is named twice in one chain
#define OMX_REPLY_PLUGIN_HOSTD_CHAIN_DUPLICATE_RESP (-519)
#define OMX_REPLY_PLUGIN_HOSTD_CHAIN_INSTANCE_BUSY "reply.plugin-hostd.chain-instance-busy" ///< PHD_ERR_CHAIN_INSTANCE_BUSY: a member is already in another chain
#define OMX_REPLY_PLUGIN_HOSTD_CHAIN_INSTANCE_BUSY_RESP (-520)
#define OMX_REPLY_PLUGIN_HOSTD_CHAIN_MIXED_FORMAT "reply.plugin-hostd.chain-mixed-format" ///< PHD_ERR_CHAIN_MIXED_FORMAT: no one worker program runs every member
#define OMX_REPLY_PLUGIN_HOSTD_CHAIN_MIXED_FORMAT_RESP (-521)

#endif /* VERBS_FIXTURE_VOCABULARY_H */
