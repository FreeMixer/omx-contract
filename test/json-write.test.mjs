// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
/**
 * src/omxcontract/omx_json_write.h (installed as omxcontract/omx_json_write.h), the one JSON string writer of the C programs (omx-contract#158): what it writes is a
 * JSON string literal JSON.parse reads back to the bytes given, for every byte; the buffer form reports the length the
 * way snprintf does and cuts without overrunning.
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { ROOT, scratchDir } from './helpers.mjs';

function probe() {
  const dir = scratchDir('json-write');
  const src = join(dir, 'probe.c');
  writeFileSync(src, `#include <omxcontract/omx_json_write.h>
#include <stdlib.h>
#include <string.h>
/* every byte 1..255 once, the escapes in between, as one string: the FILE form on the first line, the buffer form on
 * the second, then the lengths the buffer form reports for a cap of 0, of 4 and of the whole */
int main(void) {
  char all[256 + 8], buf[2048], small[4];
  size_t n, i;
  for (i = 1; i < 256; i++) all[i - 1] = (char)i;
  memcpy(all + 255, "\\"\\\\/\\b\\n", 6);
  all[255 + 7] = 0;
  if (omx_json_write_string(stdout, all) != 0) return 2;
  putchar('\\n');
  n = omx_json_string(buf, sizeof buf, all);
  fputs(buf, stdout);
  putchar('\\n');
  {
    size_t zero = omx_json_string(NULL, 0, all), cut = omx_json_string(small, sizeof small, all);
    printf("%zu %zu %zu %zu\\n", n, zero, cut, strlen(small));
  }
  if (omx_json_write_string(stdout, NULL) != 0) return 2;
  putchar('\\n');
  return 0;
}
`);
  const cc = spawnSync('cc', ['-std=c11', '-Wall', '-Wextra', '-Werror', `-I${join(ROOT, 'include')}`, `-I${join(ROOT, 'src')}`, src, '-o', join(dir, 'probe')], { encoding: 'utf8' });
  assert.equal(cc.status, 0, cc.stderr);
  const run = spawnSync(join(dir, 'probe'), { encoding: 'latin1' });
  assert.equal(run.status, 0, run.stderr);
  return run.stdout.split('\n');
}

test('every byte round-trips through JSON.parse, in the FILE form and the buffer form alike', () => {
  const [file, buffer] = probe();
  const want = Array.from({ length: 255 }, (_, i) => String.fromCharCode(i + 1)).join('') + '"\\/\b\n';
  assert.equal(JSON.parse(file), want, 'omx_json_write_string');
  assert.equal(buffer, file, 'omx_json_string writes the same bytes');
  // the one rule, byte for byte: JSON.stringify's (short escapes, \u00XX in lower case, a slash and 0x7f as they are)
  assert.equal(file, JSON.stringify(want), 'the escapes are the shortest RFC 8259 ones, and no other byte is escaped');
});

test('the buffer form reports the length snprintf would, and cuts at cap with a NUL', () => {
  const [file, , lengths, nul] = probe();
  const [n, zero, small, got] = lengths.split(' ').map(Number);
  assert.equal(n, file.length, 'the length of the whole literal');
  assert.equal(zero, n, 'cap 0 reports the same length and writes nothing');
  assert.equal(small, n, 'a small cap reports the same length');
  assert.equal(got, 3, 'and holds cap - 1 bytes and the NUL');
  assert.equal(nul, 'null', 'NULL is null');
});
