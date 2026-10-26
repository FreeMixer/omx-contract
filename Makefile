# SPDX-License-Identifier: GPL-3.0-or-later
# Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
#
# Installs the committed renders (include/omxcontract/, share/omx-contract/omx-contract.json), the
# schema, omx-contract.pc, and data/ as the package omx-contract of the contract directory
# (CONTRACTDIR/<schema major>/omx-contract/, docs/contract-dir.md) with tools/install-contract-dir.sh, which is
# installed beside the schema for the packages that install their own definitions. No node runs here: a release build (RPM, deb) installs what
# `omx-contract render --check` already holds equal to the data (R-056). `make test` is the node suite.
#
# `make install-cli` installs the omx-contract command, which needs node at run time: the CLI's own files under
# CLIDIR with its runtime dependencies unpacked from the npm tarballs in vendor/ (no network, no npm) and their
# development files (dot files, tests, benchmarks, lint and TypeScript configuration) left out, the command in
# BINDIR and its man page.

PREFIX ?= /usr/local
INCLUDEDIR ?= $(PREFIX)/include
DATADIR ?= $(PREFIX)/share
PKGCONFIGDIR ?= $(DATADIR)/pkgconfig
CONTRACTDIR ?= $(DATADIR)/omx-contract/contract.d
BINDIR ?= $(PREFIX)/bin
CLIDIR ?= $(PREFIX)/lib/omx-contract
MANDIR ?= $(DATADIR)/man
SCHEMA_MAJOR := $(shell sed -n 's/^  "x-omx-schema-version": "\([0-9]*\)\..*",$$/\1/p' schema/omx-contract.schema.json)
CC ?= cc
VERSION := $(shell sed -n 's/^  "version": "\(.*\)",$$/\1/p' package.json)

.PHONY: all check completeness inventory-check layout public-sources install install-cli test

all:
	@test -n "$(VERSION)" || { echo "no version in package.json" >&2; exit 1; }
	@test -n "$(SCHEMA_MAJOR)" || { echo "no x-omx-schema-version in schema/omx-contract.schema.json" >&2; exit 1; }

# The headers compile on their own, warnings as errors: the committed renders and the verbs fixture's (test/golden/verbs/).
check: all
	printf '#include <omxcontract/omx_contract_limits.h>\n#include <omxcontract/omx_vocabulary.h>\n#include <omxcontract/omx_resource_hints.h>\nstatic const char *const voice_bases[] = OMX_MEASUREMENT_VOICE_BASES_INIT;\nint main(void) { return OMX_READOUT_RATE_HZ > 0 && OMX_DECLARED_RATE_COUNT > 0 && OMX_PARAM_SCALES_LINEAR < OMX_PARAM_SCALES_COUNT && sizeof voice_bases / sizeof voice_bases[0] == OMX_MEASUREMENT_VOICE_BASES_COUNT && OMX_MACHINE_CLASS_FIELDS_ARCH[0] == 0x61 && OMX_RESOURCE_HINT_COUNT > 0u ? 0 : 1; }\n' > check-headers.c
	$(CC) -std=c11 -Wall -Wextra -Werror -Wno-unused-function -Iinclude check-headers.c -o check-headers
	./check-headers
	printf '#include "omx_host_verbs.h"\n#include "c/verbs_fixture_host_verbs.h"\n#include "c/verbs_fixture_vocabulary.h"\nint main(void) { return omx_host_verb_level(OMX_VERB_CHAIN, OMX_HOST_VERB_HOST_PLUGIN_HOSTD) == OMX_HOST_VERB_REQUIRED && verbs_fixture_host_verb_find(OMX_VERB_PARAM_INFO) != NULL ? 0 : 1; }\n' > check-headers.c
	$(CC) -std=c11 -Wall -Wextra -Werror -Wno-unused-function -Itest/golden/verbs check-headers.c -o check-headers
	./check-headers
	rm -f check-headers check-headers.c

install: all
	install -d $(DESTDIR)$(INCLUDEDIR)/omxcontract $(DESTDIR)$(DATADIR)/omx-contract $(DESTDIR)$(PKGCONFIGDIR)
	install -m 0644 include/omxcontract/*.h $(DESTDIR)$(INCLUDEDIR)/omxcontract/
	install -m 0644 share/omx-contract/omx-contract.json share/omx-contract/omx-vocabulary.schema.json share/omx-contract/omx-resource-hints.ttl schema/omx-contract.schema.json $(DESTDIR)$(DATADIR)/omx-contract/
	install -m 0755 tools/install-contract-dir.sh $(DESTDIR)$(DATADIR)/omx-contract/
	sh tools/install-contract-dir.sh -x codes.json omx-contract $(VERSION) $(SCHEMA_MAJOR) data $(DESTDIR)$(CONTRACTDIR) data
	sed -e 's|@PREFIX@|$(PREFIX)|' -e 's|@INCLUDEDIR@|$(INCLUDEDIR)|' -e 's|@DATADIR@|$(DATADIR)|' -e 's|@VERSION@|$(VERSION)|' \
	  -e 's|@CONTRACTDIR@|$(CONTRACTDIR)|' \
	  omx-contract.pc.in > $(DESTDIR)$(PKGCONFIGDIR)/omx-contract.pc
	chmod 0644 $(DESTDIR)$(PKGCONFIGDIR)/omx-contract.pc

install-cli: all
	install -d $(DESTDIR)$(CLIDIR)/bin $(DESTDIR)$(CLIDIR)/lib $(DESTDIR)$(CLIDIR)/render/c $(DESTDIR)$(CLIDIR)/schema \
	  $(DESTDIR)$(CLIDIR)/data $(DESTDIR)$(BINDIR) $(DESTDIR)$(MANDIR)/man1
	install -m 0755 bin/omx-contract.mjs $(DESTDIR)$(CLIDIR)/bin/
	install -m 0644 lib/*.mjs $(DESTDIR)$(CLIDIR)/lib/
	install -m 0644 render/*.mjs $(DESTDIR)$(CLIDIR)/render/
	install -m 0644 render/c/*.mjs $(DESTDIR)$(CLIDIR)/render/c/
	install -m 0644 schema/omx-contract.schema.json $(DESTDIR)$(CLIDIR)/schema/
	cd data && find . -name '*.json' | LC_ALL=C sort | while read -r f; do install -D -m 0644 "$$f" "$(DESTDIR)$(CLIDIR)/data/$$f" || exit 1; done
	install -m 0644 package.json $(DESTDIR)$(CLIDIR)/
	for t in vendor/*.tgz; do \
	  m=$$(basename $$t .tgz | sed 's/-[0-9][^-]*$$//'); \
	  install -d $(DESTDIR)$(CLIDIR)/node_modules/$$m && tar -xzf $$t --no-same-owner --strip-components=1 -C $(DESTDIR)$(CLIDIR)/node_modules/$$m || exit 1; \
	  find $(DESTDIR)$(CLIDIR)/node_modules/$$m -mindepth 1 -maxdepth 1 \( -name '.*' -o -name test -o -name spec -o -name benchmark \
	    -o -name 'eslint.config.*' -o -name 'tsconfig*.json' \) -exec rm -rf {} + || exit 1; \
	done
	printf '#!/bin/sh\nexec node %s/bin/omx-contract.mjs "$$@"\n' '$(CLIDIR)' > $(DESTDIR)$(BINDIR)/omx-contract
	chmod 0755 $(DESTDIR)$(BINDIR)/omx-contract
	install -m 0644 man/omx-contract.1 $(DESTDIR)$(MANDIR)/man1/

test:
	npm test

# Every kernel, the released ones included, has every artifact recipes/kernel.recipe.json lists: over the kernels
# omx-contract carried until 2.14.0 (test/fixtures/owners-2.14.0/), since this tree holds none of its own.
completeness:
	node tools/kernel-recipe.mjs --owners-fixture

# Every word of data/ in the file its rule places it, and every LV2 and CLAP term of inventory/ mapped with a status
# (docs/data-layout.md).
layout:
	node tools/data-layout.mjs

# inventory/ is the LV2 and CLAP installed here (needs serdi, the LV2 bundles and the CLAP headers).
inventory-check:
	node tools/format-inventory.mjs --check

# No tracked file points into a private repository, branch, issue or path (the few exemptions are listed in the tool).
public-sources:
	node tools/check-public-sources.mjs --self-test
	node tools/check-public-sources.mjs

# The same refusal as the shared script every public OpenMixer repository carries, with its sabotage self-test.
.PHONY: private-refs
private-refs:
	tools/private-refs-check.sh
	tools/private-refs-check.sh --self-test
