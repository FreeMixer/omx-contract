#!/bin/sh
# SPDX-License-Identifier: GPL-3.0-or-later
# Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
#
# live-owner-data.sh <dest> [<tag>]: fetch the omx-dsp release that carries the kernels the goldens run over, unpack it
# below <dest> and print the path of its data/ directory: the value of OMX_LIVE_OWNER_DATA (test/live-owners.test.mjs,
# FreeMixer/omx-contract#109). With no tag, the latest release: the release the ops release-consumers.tsv row of omx-dsp
# holds its consumers to. A failed fetch or a release with no data/kernels is an error, never an empty answer.
set -eu
dest=${1:?usage: live-owner-data.sh <dest> [<tag>]}
tag=${2:-}
if [ -z "$tag" ]; then
  tag=$(curl -fsSL ${GITHUB_TOKEN:+-H "Authorization: Bearer $GITHUB_TOKEN"} https://api.github.com/repos/FreeMixer/omx-dsp/releases/latest | sed -n 's/.*"tag_name": *"\([^"]*\)".*/\1/p' | head -n 1)
fi
test -n "$tag" || { echo "live-owner-data: no omx-dsp release found" >&2; exit 1; }
mkdir -p "$dest"
curl -fsSL "https://github.com/FreeMixer/omx-dsp/archive/refs/tags/$tag.tar.gz" | tar -xz -C "$dest"
data="$dest/omx-dsp-${tag#v}/data"
test -d "$data/kernels" || { echo "live-owner-data: $tag holds no data/kernels" >&2; exit 1; }
echo "$data"
