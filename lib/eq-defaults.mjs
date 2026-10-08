// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
/**
 * THE default rule for the bands of a fresh EQ, whatever the strip, the host or the band count: one
 * rule, no override, for the console, omx-plugins and any other host. Per strip type the contract
 * declares only the band counts (EQ_BAND_COUNTS: default and maximum); the bands come from here.
 *
 * Types   the first band is a low shelf and the last a high shelf (each switchable to a bell by the
 *         operator); every band between is a bell. A single band is a bell.
 * Gain, Q every band is EQ_BAND_DEFAULTS.gainDb and .q.
 * Centres
 *   4 bands   the declared four (EQ_DEFAULT_CENTRES_FOUR_BAND_HZ): 100, 400, 2000, 8000 Hz,
 *             ISO 266 preferred values.
 *   N bands   N slots of equal width on a log axis across EQ_FREQ_RANGE; band i sits in the
 *             middle of slot i (lo * (hi / lo) ** ((i + 0.5) / N)) and takes the nearest preferred
 *             frequency on that axis, from the ISO 266 R10 series (ISO_THIRD_OCTAVE_CENTRES_HZ);
 *             when two bands would share a value in R10 the same is done on its R20 refinement
 *             (EQ_CENTRE_SERIES_R20_HZ). Never a repeated centre: more bands than R20 holds is an
 *             error.
 *
 * The same functions are exported by the ts render (`eqDefaultCentres`, `eqDefaultTypes`,
 * `eqDefaultBands`) and the c render (`omx_eq_default_centres`, `omx_eq_default_type`); test/eq-defaults.test.mjs holds the three equal for every count.
 * This file is the one JavaScript spelling: the ts render embeds its source.
 */

/**
 * The default band centres (Hz) of an EQ with `count` bands.
 * @param {number} count how many bands the strip's EQ starts with, a positive integer.
 * @param {{ four: number[], series: number[][], lo: number, hi: number }} p the declared four-band
 *   set, the preferred-frequency series from coarsest to finest, and the band frequency travel.
 * @returns {number[]}
 */
export function eqDefaultCentres(count, p) {
  if (!Number.isInteger(count) || count < 1) throw new RangeError(`eqDefaultCentres: ${count} is not a band count`);
  if (count === 4) return [...p.four];
  const targets = [];
  for (let i = 0; i < count; i++) targets.push(Math.log(p.lo) + (Math.log(p.hi / p.lo) * (i + 0.5)) / count);
  for (const series of p.series) {
    const out = targets.map((t) => {
      let best = series[0];
      let bestD = Infinity;
      for (const f of series) {
        const d = Math.abs(Math.log(f) - t);
        if (d < bestD) { bestD = d; best = f; }
      }
      return best;
    });
    if (new Set(out).size === out.length) return out;
  }
  throw new RangeError(`eqDefaultCentres: ${count} bands have no distinct preferred centres across ${p.lo}..${p.hi} Hz`);
}

/**
 * The band types of an EQ with `count` bands, by EQ_BAND_TYPES id: a low shelf, bells, a high shelf.
 * @param {number} count
 * @returns {string[]}
 */
export function eqDefaultTypes(count) {
  if (!Number.isInteger(count) || count < 1) throw new RangeError(`eqDefaultTypes: ${count} is not a band count`);
  return Array.from({ length: count }, (_, i) => (count === 1 ? 'bell' : i === 0 ? 'lowShelf' : i === count - 1 ? 'highShelf' : 'bell'));
}

/**
 * Every default band of an EQ with `count` bands.
 * @param {number} count
 * @param {{ four: number[], series: number[][], lo: number, hi: number, gainDb: number, q: number }} p
 * @returns {{ type: string, freqHz: number, gainDb: number, q: number }[]}
 */
export function eqDefaultBands(count, p) {
  const types = eqDefaultTypes(count);
  return eqDefaultCentres(count, p).map((freqHz, i) => ({ type: types[i], freqHz, gainDb: p.gainDb, q: p.q }));
}

/** The parameters of the rule, read off the resolved items. */
export function eqDefaultParams(resolved) {
  const v = (name) => {
    const r = resolved.get(name);
    if (!r) throw new Error(`the default centre rule needs ${name}`);
    return r.value;
  };
  const range = v('EQ_FREQ_RANGE');
  const band = v('EQ_BAND_DEFAULTS');
  return {
    four: v('EQ_DEFAULT_CENTRES_FOUR_BAND_HZ'), series: [v('ISO_THIRD_OCTAVE_CENTRES_HZ'), v('EQ_CENTRE_SERIES_R20_HZ')],
    lo: range.min, hi: range.max, gainDb: band.gainDb, q: band.q,
  };
}
