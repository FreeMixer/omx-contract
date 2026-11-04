/* SPDX-License-Identifier: GPL-3.0-or-later */
/*
 * This file is part of omx-contract.
 *
 * omx-contract is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * omx-contract is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with omx-contract.  If not, see <http://www.gnu.org/licenses/>.
 *
 * Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
 */

#ifndef OMX_PARAM_UNITS_H
#define OMX_PARAM_UNITS_H
/*
 * GENERATED: DO NOT EDIT BY HAND.
 * Rendered from OMX_PARAM_CONTRACT_UNITS of data/param-contract.json: the unit codes of org.openmixer.param-contract/1.
 * A plugin includes this header for the codes its get() reports; omx-panel and plugin-hostd read the same item as data.
 */

/** @file
 * @brief The unit codes of the parameter contract extension, one OMX_CLAP_UNIT_ define per token. */

/** the unit of a parameter's plain value: 0..24 the LV2 units one to one, 0x100 and up the vendor block */
#define OMX_CLAP_UNIT_NONE 0u
#define OMX_CLAP_UNIT_S 1u
#define OMX_CLAP_UNIT_MS 2u
#define OMX_CLAP_UNIT_MIN 3u
#define OMX_CLAP_UNIT_BAR 4u
#define OMX_CLAP_UNIT_BEAT 5u
#define OMX_CLAP_UNIT_FRAME 6u
#define OMX_CLAP_UNIT_M 7u
#define OMX_CLAP_UNIT_CM 8u
#define OMX_CLAP_UNIT_MM 9u
#define OMX_CLAP_UNIT_KM 10u
#define OMX_CLAP_UNIT_INCH 11u
#define OMX_CLAP_UNIT_MILE 12u
#define OMX_CLAP_UNIT_DB 13u
#define OMX_CLAP_UNIT_PC 14u
#define OMX_CLAP_UNIT_COEF 15u
#define OMX_CLAP_UNIT_HZ 16u
#define OMX_CLAP_UNIT_KHZ 17u
#define OMX_CLAP_UNIT_MHZ 18u
#define OMX_CLAP_UNIT_BPM 19u
#define OMX_CLAP_UNIT_OCT 20u
#define OMX_CLAP_UNIT_CENT 21u
#define OMX_CLAP_UNIT_SEMITONE12_TET 22u
#define OMX_CLAP_UNIT_DEGREE 23u
#define OMX_CLAP_UNIT_MIDI_NOTE 24u
#define OMX_CLAP_UNIT_DBFS 256u
#define OMX_CLAP_UNIT_DBU 257u
#define OMX_CLAP_UNIT_RATIO 258u
#define OMX_CLAP_UNIT_LUFS 259u

/** every field of the sheet as X(value, "field"), in its declared order, for a table a consumer builds at run time */
#define OMX_PARAM_UNITS(X) \
    X(0u, "none") X(1u, "s") X(2u, "ms") X(3u, "min") X(4u, "bar") X(5u, "beat") \
    X(6u, "frame") X(7u, "m") X(8u, "cm") X(9u, "mm") X(10u, "km") X(11u, "inch") \
    X(12u, "mile") X(13u, "db") X(14u, "pc") X(15u, "coef") X(16u, "hz") X(17u, "khz") \
    X(18u, "mhz") X(19u, "bpm") X(20u, "oct") X(21u, "cent") X(22u, "semitone12TET") X(23u, "degree") \
    X(24u, "midiNote") X(256u, "dbfs") X(257u, "dbu") X(258u, "ratio") X(259u, "lufs")

#endif /* OMX_PARAM_UNITS_H */
