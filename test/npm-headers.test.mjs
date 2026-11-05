// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { ROOT } from './helpers.mjs';

// The headers the RPM and DEB -devel packages carry are what `make install` puts under <prefix>/include/omxcontract;
// the npm tarball must carry the same set under include/omxcontract, because consumers that fetch the headers from the
// tarball (plugin-qualify's native/fetch-deps.sh) read them from there (omx_json_write.h was missing in 3.9.0).
test('npm tarball: include/omxcontract carries every header the -devel packages install', () => {
  const dest = mkdtempSync(join(tmpdir(), 'omx-contract-install-'));
  try {
    execFileSync('make', ['install', `DESTDIR=${dest}`, 'PREFIX=/usr'], { cwd: ROOT, stdio: 'pipe' });
    const devel = readdirSync(join(dest, 'usr/include/omxcontract')).filter((f) => f.endsWith('.h')).sort();
    assert.ok(devel.includes('omx_json_write.h') && devel.includes('omx_contract_limits.h'), 'positive control: the install holds the hand-written and a rendered header');
    const out = execFileSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
    const packed = JSON.parse(out)[0].files.map((f) => f.path);
    const npm = packed.filter((p) => /^include\/omxcontract\/[^/]+\.h$/.test(p)).map((p) => p.split('/').pop()).sort();
    assert.deepEqual(npm, devel, 'npm include/omxcontract headers equal the -devel headers');
  } finally {
    rmSync(dest, { recursive: true, force: true });
  }
});
