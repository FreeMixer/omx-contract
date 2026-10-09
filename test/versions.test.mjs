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
  assert.match(read('packaging/omx-contract.spec'), new RegExp(`^%changelog\\n\\* .* - ${v.replace(/\./g, '\\.')}-1$`, 'm'));
});

// lintian refuses a release dated no later than the one before it (latest-changelog-entry-without-new-date):
// 1.2.0 shipped dated as 1.1.0 and its four deb builds failed at release time
test('versions: the newest debian/changelog entry is dated strictly after the one before it', () => {
  const [newest, previous] = [...read('debian/changelog').matchAll(/^ -- .*>  (.+)$/gm)].map((m) => ({ text: m[1], at: Date.parse(m[1]) }));
  assert.ok(newest && previous, 'debian/changelog has at least two entries');
  assert.ok(!Number.isNaN(newest.at) && !Number.isNaN(previous.at), 'both dates parse');
  assert.ok(newest.at > previous.at,
    `debian/changelog: the newest entry (${newest.text}) is not dated after the one before it (${previous.text})`);
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
