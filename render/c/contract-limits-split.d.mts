// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
/** Types for the contract-limits split (contract-limits-split.mjs). */
export const CONTRACT_HEADER: string;
export const CONTRACT_PATH: string;
export const DSP_DEFINITIONS_HEADER: string;
export const OWNER_PATHS: Readonly<Record<string, string>>;
export const OWNER_HEADERS: readonly { readonly owner: string; readonly header: string }[];
/** An installed owner's header: the owner's name, its include path and its text. */
export interface OwnerHeader { readonly owner: string; readonly header: string; readonly text: string }
export type LimitItem =
  | { readonly frame: string; readonly key?: undefined }
  | { readonly frame?: undefined; readonly key: string; readonly names: string[]; readonly lines: string[]; readonly macro: boolean };
export function limitUnits(text: string): LimitItem[];
export function contractNames(text: string): Set<string>;
export interface LimitsSplit {
  readonly contract: string;
  /** Each owner's render, in the order the owners were given; `contract` is the first. */
  readonly renders: string[];
  readonly console: string;
  readonly contractNames: Set<string>;
  readonly consoleNames: Set<string>;
  readonly added: number;
}
export function splitContractLimits(input: {
  full: string;
  pinned: string | readonly OwnerHeader[];
  generator?: string;
}): LimitsSplit;
export function pinVerdict(contract: string, pinned: string, owner?: string): string | null;
export function pinVerdicts(split: LimitsSplit, pinned: string | readonly OwnerHeader[]): string[];
