// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
/** Types for the position law of each scale word (scale.mjs). */
export type PositionLaw = 'linear' | 'log' | 'stepped' | 'map';
export const POSITION_LAWS: readonly PositionLaw[];
/** A travel as a descriptor states it: `step` for a stepped one, `unknown` is served linear. */
export interface ScaleTravel {
  readonly scale?: PositionLaw | 'unknown';
  readonly min?: number;
  readonly max?: number;
  readonly step?: number;
}
/** The override module's map: [plain value, quantity] points, linear between them. */
export interface ScaleMap {
  readonly scale: 'map';
  readonly points: readonly (readonly [number, number])[];
}
/** The position of `value` on `travel`, 0 at its min and 1 at its max, unclamped. @throws RangeError on a travel without a law. */
export function scalePosition(travel: ScaleTravel | ScaleMap, value: number): number;
/** The value at position `p`: the inverse of scalePosition. */
export function scaleValue(travel: ScaleTravel | ScaleMap, p: number): number;
