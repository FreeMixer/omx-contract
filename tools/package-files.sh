#!/bin/sh
# SPDX-License-Identifier: GPL-3.0-or-later
# Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
#
# package-files.sh — which file lands in which binary package (BUILDING.md): the RPMs or the debs of one build held to
# the tree they were built from, with no node, what CI runs after each build.
#
#   package-files.sh rpm <dir of the RPMs>
#   package-files.sh deb <dir of the debs>
#
# omx-contract-data holds data/ installed as contract.d/<schema major>/omx-contract/ (less codes.json, with its
# MANIFEST.json), the schema and the committed renders under share/omx-contract; the development package the C
# render, omx-contract.pc and install-contract-dir.sh; the command package the command, its tree under
# /usr/lib/omx-contract and its man page. No file is in two packages, and the command and the development package
# each require omx-contract-data at their own version. Prints each package's list; exit 0 equal, 1 a difference, 2 usage.
set -eu

kind=${1-} dir=${2-}
{ [ "$kind" = rpm ] || [ "$kind" = deb ]; } && [ -d "$dir" ] || { sed -n '7,9p' "$0" >&2; exit 2; }
major=$(sed -n 's/^  "x-omx-schema-version": "\([0-9]*\)\..*",$/\1/p' schema/omx-contract.schema.json)
[ -n "$major" ] || { echo "package-files.sh: run it from the tree the packages were built from" >&2; exit 2; }
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

# the files of one package, one absolute path a line, sorted; no directory, no build-id link, no licence or doc file
files() {
  if [ "$kind" = rpm ]; then
    rpm -qp --qf '[%{FILEMODES:perms} %{FILENAMES}\n]' "$1" | grep -v -e '^d' -e '/\.build-id/' | cut -d' ' -f2
  else
    dpkg-deb -c "$1" | awk '$1 !~ /^d/ { print $NF }' | sed 's|^\./|/|'
  fi | grep -v -e '^/usr/share/licenses/' -e '^/usr/share/doc/' | LC_ALL=C sort
}

pkgfile() {
  if [ "$kind" = rpm ]; then set -- "$dir/$1"-[0-9]*.noarch.rpm; else set -- "$dir/$1"_*_all.deb; fi
  [ "$#" -eq 1 ] && [ -f "$1" ] || { echo "package-files.sh: not one package file for $pkg under $dir" >&2; exit 1; }
  echo "$1"
}

if [ "$kind" = rpm ]; then data=omx-contract-data devel=omx-contract-devel; else data=omx-contract-data devel=libomx-contract-dev; fi
cli=omx-contract

# what the tree says each package holds
(cd data && find . -name '*.json' ! -path ./codes.json | sed "s|^\./|/usr/share/omx-contract/contract.d/$major/omx-contract/|"
  echo "/usr/share/omx-contract/contract.d/$major/omx-contract/MANIFEST.json"
  for f in omx-contract.json omx-vocabulary.schema.json omx-resource-hints.ttl omx_contract.py; do echo "/usr/share/omx-contract/$f"; done
  echo /usr/share/omx-contract/omx-contract.schema.json) | LC_ALL=C sort > "$tmp/want-$data"
(for h in include/omxcontract/*.h; do echo "/usr/$h"; done
  echo /usr/share/omx-contract/install-contract-dir.sh
  echo /usr/share/pkgconfig/omx-contract.pc) | LC_ALL=C sort > "$tmp/want-$devel"

bad=0
for pkg in "$data" "$devel" "$cli"; do
  f=$(pkgfile "$pkg")
  echo "== $pkg ($(basename "$f"))"
  files "$f" > "$tmp/got-$pkg"
  # the command's vendored npm tree is counted, not listed
  grep -v '^/usr/lib/omx-contract/node_modules/' "$tmp/got-$pkg" || true
  n=$(grep -c '^/usr/lib/omx-contract/node_modules/' "$tmp/got-$pkg" || true)
  [ "$n" -eq 0 ] || echo "(and $n files under /usr/lib/omx-contract/node_modules/)"
  if [ "$pkg" = "$cli" ]; then
    # the command: /usr/bin/omx-contract, its man page, and its own tree, nothing under share/omx-contract
    grep -qx /usr/bin/omx-contract "$tmp/got-$pkg" || { echo "$pkg: no /usr/bin/omx-contract"; bad=1; }
    grep -q '^/usr/lib/omx-contract/bin/omx-contract.mjs$' "$tmp/got-$pkg" || { echo "$pkg: no /usr/lib/omx-contract/bin/omx-contract.mjs"; bad=1; }
    grep -v -e '^/usr/bin/omx-contract$' -e '^/usr/lib/omx-contract/' -e '^/usr/share/man/man1/omx-contract\.1' "$tmp/got-$pkg" > "$tmp/stray" || true
    [ ! -s "$tmp/stray" ] || { echo "$pkg: files outside the command's places:"; cat "$tmp/stray"; bad=1; }
  else
    diff -u "$tmp/want-$pkg" "$tmp/got-$pkg" || { echo "$pkg: the files differ from the tree's (- the tree, + the package)"; bad=1; }
  fi
done

# one file, one package
LC_ALL=C sort "$tmp"/got-* | uniq -d > "$tmp/twice"
[ ! -s "$tmp/twice" ] || { echo "files in two packages:"; cat "$tmp/twice"; bad=1; }

# the command and the development package require the data at their own version
for pkg in "$cli" "$devel"; do
  f=$(pkgfile "$pkg")
  if [ "$kind" = rpm ]; then
    v=$(rpm -qp --qf '%{VERSION}-%{RELEASE}' "$f")
    rpm -qp --requires "$f" | grep -qx "$data = $v" || { echo "$pkg: does not require $data = $v"; bad=1; }
  else
    v=$(dpkg-deb -f "$f" Version)
    dpkg-deb -f "$f" Depends | tr ',' '\n' | sed 's/^ *//' | grep -qx "$data (= $v)" || { echo "$pkg: does not depend on $data (= $v)"; bad=1; }
  fi
done
[ "$bad" -eq 0 ] && echo "package-files.sh: every file in its package; $cli and $devel require $data"
exit "$bad"
