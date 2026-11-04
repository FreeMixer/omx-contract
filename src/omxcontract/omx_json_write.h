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

#ifndef OMX_JSON_WRITE_H
#define OMX_JSON_WRITE_H
/*
 * The one JSON string writer of the FreeMixer C programs, hand-written (not a render) and installed beside the
 * rendered headers as <omxcontract/omx_json_write.h>. A program that writes JSON (a scan, a measurement, a
 * daemon's reply) spells a string literal through these three functions and never carries an escape loop of its own:
 * omx_json_escape_byte, the escape of one byte; omx_json_write_string, a quoted literal into a FILE; omx_json_string,
 * a quoted literal into a buffer, the way snprintf fills one.
 *
 * The rule is RFC 8259 section 7: a double quote and a backslash take a backslash, a byte below 0x20 is \b, \t, \n,
 * \f, \r or \u00XX, every other byte passes as it is (UTF-8 passes through, and so does 0x7f, which JSON allows). A
 * slash is never escaped.
 */

#include <stddef.h>
#include <stdio.h>

/**
 * The escape of byte `c` into `out` (no NUL): its length, 1 for a byte written as it is, 2 for a short escape, 6 for
 * \u00XX. `out` holds at least OMX_JSON_ESCAPE_MAX bytes.
 */
#define OMX_JSON_ESCAPE_MAX 6

static inline size_t omx_json_escape_byte(unsigned char c, char *out)
{
    static const char hex[] = "0123456789abcdef";

    switch (c)
    {
    case '"': out[0] = '\\'; out[1] = '"'; return 2;
    case '\\': out[0] = '\\'; out[1] = '\\'; return 2;
    case '\b': out[0] = '\\'; out[1] = 'b'; return 2;
    case '\t': out[0] = '\\'; out[1] = 't'; return 2;
    case '\n': out[0] = '\\'; out[1] = 'n'; return 2;
    case '\f': out[0] = '\\'; out[1] = 'f'; return 2;
    case '\r': out[0] = '\\'; out[1] = 'r'; return 2;
    default:
        if (c < 0x20)
        {
            out[0] = '\\'; out[1] = 'u'; out[2] = '0'; out[3] = '0';
            out[4] = hex[c >> 4]; out[5] = hex[c & 15];
            return 6;
        }
        out[0] = (char)c;
        return 1;
    }
}

/** `s` (NUL-terminated; NULL writes null) as a quoted JSON string literal into `f`: 0, or EOF when a write failed. */
static inline int omx_json_write_string(FILE *f, const char *s)
{
    char esc[OMX_JSON_ESCAPE_MAX];
    const unsigned char *p;

    if (s == NULL)
        return fputs("null", f) == EOF ? EOF : 0;
    if (fputc('"', f) == EOF)
        return EOF;
    for (p = (const unsigned char *)s; *p; p++)
        if (fwrite(esc, 1, omx_json_escape_byte(*p, esc), f) == 0)
            return EOF;
    return fputc('"', f) == EOF ? EOF : 0;
}

/**
 * `s` (NUL-terminated; NULL writes null) as a quoted JSON string literal into `dst` of `cap` bytes, NUL-terminated
 * when cap is not 0: the length the whole literal takes without the NUL, as snprintf reports it, so a result of cap or
 * more says the literal was cut.
 */
static inline size_t omx_json_string(char *dst, size_t cap, const char *s)
{
    char esc[OMX_JSON_ESCAPE_MAX];
    const unsigned char *p;
    size_t n = 0, i, k;

#define OMX_JSON_PUT_(ch) do { if (n + 1 < cap) dst[n] = (ch); n++; } while (0)
    if (s == NULL)
    {
        for (p = (const unsigned char *)"null"; *p; p++)
            OMX_JSON_PUT_((char)*p);
    }
    else
    {
        OMX_JSON_PUT_('"');
        for (p = (const unsigned char *)s; *p; p++)
        {
            k = omx_json_escape_byte(*p, esc);
            for (i = 0; i < k; i++)
                OMX_JSON_PUT_(esc[i]);
        }
        OMX_JSON_PUT_('"');
    }
#undef OMX_JSON_PUT_
    if (cap)
        dst[n < cap ? n : cap - 1] = '\0';
    return n;
}

#endif /* OMX_JSON_WRITE_H */
