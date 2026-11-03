// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
/** Types for the contract-limits renderer (contract-limits-render.mjs). */
/**
 * Render `omx_contract_limits.h` from a declaration sheet. `coreStageFacts` names the `CORE_LIMITS` facts
 * rendered as stage blocks (default: pan, delay, reverb, drive).
 */
export function renderContractLimits(sheet: object & { coreStageFacts?: readonly string[] }): string;
/** The sheet the renderer reads, from a core namespace and its declarations. */
export function contractLimitsSheet(coreNs: object, declarations: object, extra?: object): object;
/** A declared scalar's C literal: an integer literal for an integer value, a float literal otherwise. */
export function scalarLiteral(n: number): string;
/** A non-integer declared scalar's C double literal. */
export function scalarDoubleLiteral(n: number): string;
/** A string as a C string literal, escaped for the record sets' string fields. */
export function cStringLiteral(s: string): string;
