// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { cpSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { ROOT } from './helpers.mjs';

// The packaged CLI carries its runtime dependencies as the npm tarballs in vendor/ (a package build has no network):
// exactly the packages package-lock.json installs for production, each at its locked version and integrity.
function vendorProblems(vendor, lock) {
  const want = new Map();
  for (const [path, p] of Object.entries(lock.packages)) {
    if (!path || p.dev) continue;
    const name = path.replace(/^.*node_modules\//, '');
    want.set(`${name}-${p.version}.tgz`, p.integrity);
  }
  const have = readdirSync(vendor).filter((f) => f.endsWith('.tgz'));
  const problems = [];
  for (const f of have) {
    if (!want.has(f)) { problems.push(`${f}: not a production package of package-lock.json`); continue; }
    const got = `sha512-${createHash('sha512').update(readFileSync(join(vendor, f))).digest('base64')}`;
    if (got !== want.get(f)) problems.push(`${f}: integrity ${got} is not the locked ${want.get(f)}`);
  }
  for (const f of want.keys()) if (!have.includes(f)) problems.push(`${f}: locked but not in vendor/`);
  return problems;
}

const lock = () => JSON.parse(readFileSync(join(ROOT, 'package-lock.json'), 'utf8'));

test('vendor: one tarball per production dependency, at the locked version and integrity', () => {
  assert.deepEqual(vendorProblems(join(ROOT, 'vendor'), lock()), []);
});

test('vendor: a changed, missing or extra tarball is named', () => {
  const d = mkdtempSync(join(tmpdir(), 'omx-vendor-'));
  try {
    cpSync(join(ROOT, 'vendor'), d, { recursive: true });
    const [first, second] = readdirSync(d).filter((f) => f.endsWith('.tgz')).sort();
    const bytes = readFileSync(join(d, first));
    bytes[bytes.length - 1] ^= 1;
    writeFileSync(join(d, first), bytes);
    rmSync(join(d, second));
    writeFileSync(join(d, 'left-pad-1.3.0.tgz'), '');
    const problems = vendorProblems(d, lock());
    assert.ok(problems.some((p) => p.startsWith(`${first}: integrity`)), problems.join('\n'));
    assert.ok(problems.some((p) => p.startsWith(`${second}: locked but not`)), problems.join('\n'));
    assert.ok(problems.some((p) => p.startsWith('left-pad-1.3.0.tgz: not a production')), problems.join('\n'));
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});
