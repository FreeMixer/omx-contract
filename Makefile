# SPDX-License-Identifier: GPL-3.0-or-later
# Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
#
# Installs the committed renders (include/omxcontract/, share/omx-contract/omx-contract.json), the
# schema and omx-contract.pc. No node runs here: a release build (RPM, deb) installs what
# `omx-contract render --check` already holds equal to the data (R-056). `make test` is the node suite.

PREFIX ?= /usr/local
INCLUDEDIR ?= $(PREFIX)/include
DATADIR ?= $(PREFIX)/share
PKGCONFIGDIR ?= $(DATADIR)/pkgconfig
CC ?= cc
VERSION := $(shell sed -n 's/^  "version": "\(.*\)",$$/\1/p' package.json)

.PHONY: all check completeness install test

all:
	@test -n "$(VERSION)" || { echo "no version in package.json" >&2; exit 1; }

# The header compiles on its own, warnings as errors.
check: all
	printf '#include <omxcontract/omx_contract_limits.h>\nint main(void) { return OMX_FX_DELAY_TIME_RANGE_MAX > 0 && OMX_DECLARED_RATE_COUNT > 0 ? 0 : 1; }\n' > check-headers.c
	$(CC) -std=c11 -Wall -Wextra -Werror -Wno-unused-function -Iinclude check-headers.c -o check-headers
	./check-headers
	rm -f check-headers check-headers.c

install: all
	install -d $(DESTDIR)$(INCLUDEDIR)/omxcontract $(DESTDIR)$(DATADIR)/omx-contract $(DESTDIR)$(PKGCONFIGDIR)
	install -m 0644 include/omxcontract/*.h $(DESTDIR)$(INCLUDEDIR)/omxcontract/
	install -m 0644 share/omx-contract/omx-contract.json schema/omx-contract.schema.json $(DESTDIR)$(DATADIR)/omx-contract/
	sed -e 's|@PREFIX@|$(PREFIX)|' -e 's|@INCLUDEDIR@|$(INCLUDEDIR)|' -e 's|@DATADIR@|$(DATADIR)|' -e 's|@VERSION@|$(VERSION)|' \
	  omx-contract.pc.in > $(DESTDIR)$(PKGCONFIGDIR)/omx-contract.pc
	chmod 0644 $(DESTDIR)$(PKGCONFIGDIR)/omx-contract.pc

test:
	npm test

# Every kernel, the released ones included, has every artifact recipes/kernel.recipe.json lists.
completeness:
	node tools/kernel-recipe.mjs
