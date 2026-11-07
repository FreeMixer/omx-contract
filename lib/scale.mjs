// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
/**
 * What each PARAM_SCALES word means as a position, beside the word (docs/scale-position.md). A position `p` runs
 * from 0 at the travel's `min` to 1 at its `max`.
 *
 * - `linear`: p = (v - min) / (max - min).
 * - `log`: p = ln(v / min) / ln(max / min), over a positive floor `min`. A log travel whose floor is not positive
 *   has no logarithm: it is served linear (the validator drops an override entry that asks for one, and
 *   `contract.override.scale-floor` is its code).
 * - `stepped`: p = k / (n - 1), k the step's index and n the number of steps, n = (max - min) / step + 1.
 * - `map`, the override module's table: linear between its `points`, a list of [plain value, quantity]. The
 *   position is the plain value's, linear over the first and last point; the value is the quantity.
 *
 * A word's law is not overridable per control. Nothing is clamped: a value outside the travel has a position
 * outside 0..1, and the ends are exact.
 */

/** The words this library gives a law to: PARAM_SCALES' ids and the override `map`. `unknown` is served linear. */
export const POSITION_LAWS = Object.freeze(['linear', 'log', 'stepped', 'map']);

const isNum = (x) => typeof x === 'number' && Number.isFinite(x);

/** The word whose law serves `travel`: log over a floor that is not positive is linear. */
function lawOf(travel) {
  if (travel === null || typeof travel !== 'object') throw new RangeError('a travel is an object');
  const word = travel.scale ?? 'linear';
  if (word === 'unknown') return 'linear';
  if (!POSITION_LAWS.includes(word)) throw new RangeError(`no position law for the scale ${JSON.stringify(word)}`);
  if (word === 'log' && !(travel.min > 0)) return 'linear';
  return word;
}

function pointsOf(travel) {
  const pts = travel.points;
  if (!Array.isArray(pts) || pts.length < 2 || !pts.every((p) => Array.isArray(p) && p.length === 2 && isNum(p[0]) && isNum(p[1]))) {
    throw new RangeError('a map travel carries at least two [plain value, quantity] points');
  }
  return pts;
}

function endsOf(travel, law) {
  const [min, max] = law === 'map' ? [pointsOf(travel)[0][0], pointsOf(travel).at(-1)[0]] : [travel.min, travel.max];
  if (!isNum(min) || !isNum(max) || !(max > min)) throw new RangeError(`a travel runs upward from its min to its max, not ${min} to ${max}`);
  return [min, max];
}

function stepsOf(travel, min, max) {
  if (!(travel.step > 0)) throw new RangeError('a stepped travel states a positive step');
  const n = Math.round((max - min) / travel.step) + 1;
  if (n < 2) throw new RangeError('a stepped travel has at least two steps');
  return n;
}

/** The piece of `pts` that holds `x` on its `from` column (0 plain, 1 quantity); the end pieces extend outward. */
function piece(pts, from, x) {
  const dir = pts[pts.length - 1][from] > pts[0][from] ? 1 : -1;
  let i = 0;
  while (i < pts.length - 2 && (x - pts[i + 1][from]) * dir > 0) i++;
  return [pts[i], pts[i + 1]];
}

/** The position of `value` on `travel` ({ scale, min, max, step? } or { scale: 'map', points }). */
export function scalePosition(travel, value) {
  const law = lawOf(travel);
  if (law === 'map') {
    const pts = pointsOf(travel);
    const [min, max] = endsOf(travel, law);
    const [a, b] = piece(pts, 1, value);
    const plain = a[0] + ((value - a[1]) / (b[1] - a[1])) * (b[0] - a[0]);
    return (plain - min) / (max - min);
  }
  const [min, max] = endsOf(travel, law);
  if (value === min) return 0;
  if (value === max) return 1;
  if (law === 'log') return Math.log(value / min) / Math.log(max / min);
  if (law === 'stepped') {
    const n = stepsOf(travel, min, max);
    const k = Math.min(n - 1, Math.max(0, Math.round((value - min) / travel.step)));
    return k / (n - 1);
  }
  return (value - min) / (max - min);
}

/** The value at position `p` on `travel`: the inverse of scalePosition (a stepped one lands on the nearest step). */
export function scaleValue(travel, p) {
  const law = lawOf(travel);
  const [min, max] = endsOf(travel, law);
  if (law === 'map') {
    const pts = pointsOf(travel);
    const plain = min + p * (max - min);
    const [a, b] = piece(pts, 0, plain);
    if (plain === min) return a[1];
    if (plain === max) return b[1];
    return a[1] + ((plain - a[0]) / (b[0] - a[0])) * (b[1] - a[1]);
  }
  if (p === 0) return min;
  if (p === 1) return max;
  if (law === 'log') return min * Math.pow(max / min, p);
  if (law === 'stepped') {
    const n = stepsOf(travel, min, max);
    const k = Math.min(n - 1, Math.max(0, Math.round(p * (n - 1))));
    return min + k * travel.step;
  }
  return min + p * (max - min);
}
