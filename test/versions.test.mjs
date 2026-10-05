// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { packageVersion } from '../lib/data.mjs';
import { ROOT } from './helpers.mjs';

const read = (p) => readFileSync(join(ROOT, p), 'utf8');

test('versions: package.json, the RPM spec and the debian changelog name one version', () => {
  const v = packageVersion(ROOT);
  assert.equal(/^Version: (\S+)$/m.exec(read('packaging/omx-contract.spec'))[1], v);
  assert.equal(/^omx-contract \(([^)]+)\)/.exec(read('debian/changelog'))[1], v);
  assert.equal(JSON.parse(read('share/omx-contract/omx-contract.json')).version, v);
  assert.equal(JSON.parse(read('package-lock.json')).version, v);
});

test('versions: npm publishes from publish.yml, by OIDC with no token', () => {
  // npmjs.com's trusted publisher names exactly these: FreeMixer/omx-contract, publish.yml, no environment
  const y = read('.github/workflows/publish.yml');
  assert.match(y, /\n {2}publish:\n {4}if: github\.repository == 'FreeMixer\/omx-contract'\n/);
  assert.doesNotMatch(y, /\n {4}environment:/);  // npm's entry names none: a named one would not match it
  assert.match(y, /\n {4}permissions:\n {6}contents: read\n {6}id-token: write\n/);  // job-level, not workflow-level
  assert.match(y, /npm publish --provenance --access public/);
  assert.doesNotMatch(y, /NPM_TOKEN|NODE_AUTH_TOKEN/);
  // release.yml no longer publishes to npm: one publisher, the one npmjs.com trusts
  assert.doesNotMatch(read('.github/workflows/release.yml'), /npm publish/);
});
