// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
//
// The suite leaves nothing in TMPDIR: it made about 27 directories a run and /tmp ran out of inodes (#169).
// Each file that made scratch directories runs again under its own empty TMPDIR, which must be empty at the end.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ROOT } from './helpers.mjs';

const FILES = ['kernel-recipe', 'render', 'formats', 'set-values'];

for (const name of FILES) {
  test(`${name}.test.mjs leaves no scratch directory in TMPDIR`, () => {
    const tmp = mkdtempSync(join(tmpdir(), 'omx-scratch-clean-'));
    try {
      // NODE_TEST_CONTEXT makes a nested `node --test` run nothing and exit 0; the child must be a real run.
      const env = { ...process.env, TMPDIR: tmp };
      delete env.NODE_TEST_CONTEXT;
      const run = spawnSync('node', ['--test', join(ROOT, `test/${name}.test.mjs`)], { encoding: 'utf8', env });
      assert.equal(run.status, 0, run.stdout.slice(-2000));
      assert.match(run.stdout, /^# pass [1-9]/m, 'the child ran tests');
      assert.deepEqual(readdirSync(tmp), []);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
}
