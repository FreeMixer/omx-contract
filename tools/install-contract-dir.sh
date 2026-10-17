#!/bin/sh
# SPDX-License-Identifier: GPL-3.0-or-later
# Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
#
# install-contract-dir.sh — install one package's definition files into the contract directory (docs/contract-dir.md),
# with no node: what a release build runs.
#
#   install-contract-dir.sh [-x <rel>]... <package> <version> <schema major> <from dir> <contractdir> [<tree>]
#
# Copies every .json under <from dir> (less each -x <rel>) to <contractdir>/<schema major>/<package>/, writes a
# relative "$schema" (omx-contract's own data/) as the schema's URL of that major, and writes MANIFEST.json with each
# installed file's sha256. <tree> is the manifest's "tree": the directory of the owner's tree the files came from.
# Exit 0 installed; 1 a refusal (a file name the manifest cannot carry); 2 usage.
set -eu

exclude=''
while [ "$#" -gt 0 ] && [ "$1" = -x ]; do
  [ "$#" -ge 2 ] || { echo "install-contract-dir.sh: -x needs a value" >&2; exit 2; }
  exclude="$exclude
$2"
  shift 2
done
[ "$#" -eq 5 ] || [ "$#" -eq 6 ] || { sed -n '6,11p' "$0" >&2; exit 2; }
pkg=$1 version=$2 major=$3 from=$4 to=$5 tree=${6-}
case $pkg in *[!a-z0-9-]* | '' | -*) echo "install-contract-dir.sh: package $pkg is not a lower-case name" >&2; exit 2 ;; esac
case $major in *[!0-9]* | '') echo "install-contract-dir.sh: schema major $major is not a number" >&2; exit 2 ;; esac
echo "$version" | grep -Eq '^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$' || { echo "install-contract-dir.sh: version $version is not x.y.z" >&2; exit 2; }
[ -d "$from" ] || { echo "install-contract-dir.sh: no directory $from" >&2; exit 2; }

dest=$to/$major/$pkg
url="https://github.com/FreeMixer/omx-contract/raw/v$major/schema/omx-contract.schema.json"
rm -rf "$dest"
install -d "$dest"
list=$(cd "$from" && find . -type f -name '*.json' | sed 's|^\./||' | LC_ALL=C sort)
manifest="$dest/MANIFEST.json"
{
  printf '{\n  "package": "%s",\n  "version": "%s",\n  "schemaMajor": %s,\n' "$pkg" "$version" "$major"
  [ -z "$tree" ] || printf '  "tree": "%s",\n' "$tree"
  printf '  "files": {'
} > "$manifest.tmp"
sepr=''
n=0
for rel in $list; do
  if printf '%s\n' "$exclude" | grep -Fxq "$rel"; then continue; fi
  echo "$rel" | grep -Eq '^[A-Za-z0-9_+.-]+(/[A-Za-z0-9_+.-]+)*\.json$' || { echo "install-contract-dir.sh: $rel is a name the manifest cannot carry" >&2; rm -f "$manifest.tmp"; exit 1; }
  install -d "$dest/$(dirname "$rel")"
  sed -e "1,3s|^\\(  \"\\\$schema\": \"\\)\\(\\.\\./\\)*schema/omx-contract\\.schema\\.json\"|\\1$url\"|" "$from/$rel" > "$dest/$rel"
  chmod 0644 "$dest/$rel"
  sum=$(sha256sum "$dest/$rel" | cut -d' ' -f1)
  printf '%s\n    "%s": "%s"' "$sepr" "$rel" "$sum" >> "$manifest.tmp"
  sepr=','
  n=$((n + 1))
done
[ "$n" -gt 0 ] || { echo "install-contract-dir.sh: no .json file under $from" >&2; rm -f "$manifest.tmp"; exit 1; }
printf '\n  }\n}\n' >> "$manifest.tmp"
mv "$manifest.tmp" "$manifest"
chmod 0644 "$manifest"
echo "install-contract-dir.sh: $pkg $version: $n files under $dest"
