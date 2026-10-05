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

test('versions: the release publishes from the job named publish in release.yml, by OIDC with no token', () => {
  const y = read('.github/workflows/release.yml');
  assert.match(y, /\n {2}publish:\n {4}name: publish\n/);
  assert.match(y, /\n {2}publish:[\s\S]*?permissions:\n {6}contents: read\n {6}id-token: write\n/);
  assert.match(y, /npm publish "\$tgz" --provenance --access public\n/);
  assert.doesNotMatch(y, /NPM_TOKEN|NODE_AUTH_TOKEN/);
});
