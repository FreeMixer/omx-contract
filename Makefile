# SPDX-License-Identifier: GPL-3.0-or-later
# Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
#
# Installs the committed renders (include/omxcontract/, share/omx-contract/omx-contract.json), the
# schema, omx-contract.pc, and data/ as the package omx-contract of the contract directory
# (CONTRACTDIR/<schema major>/omx-contract/, docs/contract-dir.md) with tools/install-contract-dir.sh, which is
# installed beside the schema for the packages that install their own definitions. No node runs here: a release build (RPM, deb) installs what
# `omx-contract render --check` already holds equal to the data (R-056). `make test` is the node suite.

PREFIX ?= /usr/local
INCLUDEDIR ?= $(PREFIX)/include
DATADIR ?= $(PREFIX)/share
PKGCONFIGDIR ?= $(DATADIR)/pkgconfig
CONTRACTDIR ?= $(DATADIR)/omx-contract/contract.d
SCHEMA_MAJOR := $(shell sed -n 's/^  "x-omx-schema-version": "\([0-9]*\)\..*",$$/\1/p' schema/omx-contract.schema.json)
CC ?= cc
VERSION := $(shell sed -n 's/^  "version": "\(.*\)",$$/\1/p' package.json)

.PHONY: all check completeness public-sources install test

all:
	@test -n "$(VERSION)" || { echo "no version in package.json" >&2; exit 1; }
	@test -n "$(SCHEMA_MAJOR)" || { echo "no x-omx-schema-version in schema/omx-contract.schema.json" >&2; exit 1; }

# The header compiles on its own, warnings as errors.
check: all
	printf '#include <omxcontract/omx_contract_limits.h>\nint main(void) { return OMX_EQ_MAX_BANDS > 0 && OMX_DECLARED_RATE_COUNT > 0 && OMX_PARAM_SCALES_LINEAR < OMX_PARAM_SCALES_COUNT ? 0 : 1; }\n' > check-headers.c
	$(CC) -std=c11 -Wall -Wextra -Werror -Wno-unused-function -Iinclude check-headers.c -o check-headers
	./check-headers
	rm -f check-headers check-headers.c

install: all
	install -d $(DESTDIR)$(INCLUDEDIR)/omxcontract $(DESTDIR)$(DATADIR)/omx-contract $(DESTDIR)$(PKGCONFIGDIR)
	install -m 0644 include/omxcontract/*.h $(DESTDIR)$(INCLUDEDIR)/omxcontract/
	install -m 0644 share/omx-contract/omx-contract.json schema/omx-contract.schema.json $(DESTDIR)$(DATADIR)/omx-contract/
	install -m 0755 tools/install-contract-dir.sh $(DESTDIR)$(DATADIR)/omx-contract/
	sh tools/install-contract-dir.sh -x codes.json omx-contract $(VERSION) $(SCHEMA_MAJOR) data $(DESTDIR)$(CONTRACTDIR) data
	sed -e 's|@PREFIX@|$(PREFIX)|' -e 's|@INCLUDEDIR@|$(INCLUDEDIR)|' -e 's|@DATADIR@|$(DATADIR)|' -e 's|@VERSION@|$(VERSION)|' \
	  -e 's|@CONTRACTDIR@|$(CONTRACTDIR)|' \
	  omx-contract.pc.in > $(DESTDIR)$(PKGCONFIGDIR)/omx-contract.pc
	chmod 0644 $(DESTDIR)$(PKGCONFIGDIR)/omx-contract.pc

test:
	npm test

# Every kernel, the released ones included, has every artifact recipes/kernel.recipe.json lists.
completeness:
	node tools/kernel-recipe.mjs

# No tracked file points into a private repository, branch, issue or path (the few exemptions are listed in the tool).
public-sources:
	node tools/check-public-sources.mjs --self-test
	node tools/check-public-sources.mjs
