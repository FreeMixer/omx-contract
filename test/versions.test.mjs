// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { packageVersion } from '../lib/data.mjs';
import { ROOT } from './helpers.mjs';

const read = (p) => readFileSync(join(ROOT, p), 'utf8');

test('versions: the schema is no newer than the package, and nothing shipped needs a newer schema than it is', () => {
  const v = packageVersion(ROOT);
  const schema = JSON.parse(read('schema/omx-contract.schema.json'))['x-omx-schema-version'];
  const n = (x) => x.split('.').map(Number).reduce((a, b) => a * 1000 + b, 0);
  assert.ok(n(schema) <= n(v), `x-omx-schema-version ${schema} is newer than the package ${v}`);
  const floors = [];
  const walk = (d) => {
    for (const f of readdirSync(join(ROOT, d), { withFileTypes: true })) {
      if (f.isDirectory()) walk(join(d, f.name));
      else if (f.name.endsWith('.json')) {
        const floor = JSON.parse(read(join(d, f.name))).requires?.['omx-contract-schema'];
        if (floor) floors.push([join(d, f.name), floor.replace(/^>= /, '')]);
      }
    }
  };
  walk('data');
  walk('test/fixtures/descriptors');
  assert.ok(floors.length > 0, 'positive control: the descriptor fixtures state a floor');
  for (const [f, floor] of floors) assert.ok(n(floor) <= n(schema), `${f} requires schema ${floor}, newer than ${schema}`);
});

// The owners whose releases before the split read names this one no longer carries: each owner's RPM -devel and DEB
// -dev package, and the first release that ships its own definitions.
const OWNER_FLOORS = [
  ['omx-dsp-devel', 'libomxdsp-dev', '0.22.0'],
  ['omx-clap-core-devel', 'libomx-clap-core-dev', '0.10.0'],
  ['omx-plugins-devel', 'omx-plugins-dev', '0.10.0'],
];

test('versions: the RPM Conflicts and the DEB Breaks name the same owners at the same releases', () => {
  const rpm = Object.fromEntries([...read('packaging/omx-contract.spec').matchAll(/^Conflicts: (\S+) < (\S+)$/gm)].map((m) => [m[1], m[2]]));
  const breaks = /^Breaks: (.+)$/m.exec(read('debian/control'))?.[1] ?? '';
  const deb = Object.fromEntries([...breaks.matchAll(/([a-z0-9.+-]+) \(<< ([^)]+)\)/g)].map((m) => [m[1], m[2]]));
  // the floor ends in `~` so a pre-release snapshot of the floor release (0.22.0~git…) is not refused: in both RPM
  // and DEB ordering `0.22.0~x` sorts before `0.22.0`, and the CI builds of the owners are exactly such snapshots
  assert.deepEqual(rpm, Object.fromEntries(OWNER_FLOORS.map(([r, , v]) => [r, `${v}~`])));
  assert.deepEqual(deb, Object.fromEntries(OWNER_FLOORS.map(([, d, v]) => [d, `${v}~`])));
  for (const [, , v] of OWNER_FLOORS) assert.match(read('debian/changelog').split('\n -- ')[0], new RegExp(v.replace(/\./g, '\\.')), `the newest changelog entry says ${v}`);
});

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
