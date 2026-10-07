# SPDX-License-Identifier: GPL-3.0-or-later
# Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
Name: omx-contract
Version: 1.2.1
Release: 1%{?dist}
License: GPL-3.0-or-later
Summary: One shared source of truth for every FreeMixer knob, range and default
URL: https://github.com/FreeMixer/omx-contract
BuildArch: noarch

Source0: %{url}/archive/v%{version}/%{name}-%{version}.tar.gz

BuildRequires: gcc
BuildRequires: make
BuildRequires: sed

%description
A fader range, a default, a plugin parameter, a supported sample rate: in
FreeMixer each of these is written down once, in omx-contract, and everything
else reads it. That is why the console, the DSP library and the plugins agree
on what a knob does and how far it turns. The declarations are plain JSON with
a JSON Schema, so tools in any language can read them, and they are rendered
as C headers for the code that is built from them.

%package devel
Summary: Headers, JSON data and schema to build on the FreeMixer declarations
Provides: %{name}-static = %{version}-%{release}

%description devel
Everything you need to build against omx-contract: the C render of omx-contract under include/omxcontract (the limits header), the resolved json
render and the JSON Schema under share/omx-contract, and omx-contract.pc
(version, datadir). A consumer requires it at exactly the version it pins.

%prep
%autosetup

%build
%make_build

%install
%make_install PREFIX=%{_prefix} INCLUDEDIR=%{_includedir} DATADIR=%{_datadir}

%check
%make_build check

%files devel
%license LICENSE
%doc README.md
%{_includedir}/omxcontract/
%{_datadir}/omx-contract/
%{_datadir}/pkgconfig/omx-contract.pc

%changelog
* Thu Oct 08 2026 Pau Aliagas <linuxnow@gmail.com> - 1.2.1-1
- 1.2.1 repackages 1.2.0 with no data change. The 1.2.0 Debian changelog
  carried the same date as 1.1.0, which lintian refuses, so the Debian
  packages of 1.2.0 were never built.

* Wed Oct 07 2026 Pau Aliagas <linuxnow@gmail.com> - 1.2.0-1
- omx-dsp can build against the C header rendered here: every limit its code
  reads is now in it, with the value omx-dsp uses today. The only ones left
  out are the three EQ band budget numbers (`OPERATOR_EQ_BANDS_RESERVE` and
  the FBS and HRP auto-band defaults), which stay in openmixer.
- The chorus kernel: 4 more values, read from the engine where it declares
  them: rate, depth, voices and mix.
- The drive kernel: 5 more values, read from the engine where it declares
  them: drive, character, band, mix and trim, with the C names omx-dsp already
  reads (`OMX_DRIVE_DRIVE_DB_MIN` and the rest).
- The eq kernel: 6 more values, read from the engine where it declares them:
  the band frequency, gain and Q, the notch Q, and the high- and low-pass
  corners.
- The reverb kernel: 11 more values, read from the engine where it declares
  them: mix, size, damping, width, pre-delay, low and high cut, the reverse
  window, and the gated hold, release and threshold.
- The balance kernel: 1 value, read from the engine where it declares it: the
  pan travel, with the `OMX_PAN_PAN_MIN` and `OMX_PAN_PAN_MAX` names the
  balance law clamps to.
- Continuous forms of the gate's threshold, range, release and ratio and the
  compressor's threshold and release (`GATE_CONTINUOUS_TRAVELS`,
  `COMP_CONTINUOUS_TRAVELS`), for a plugin that offers them without steps, and
  the input trim as a travel (`TRIM_TRAVELS`). `GATE_LIMITS` and `COMP_LIMITS`
  are unchanged.
- An item added to a kernel after its first release records the release that
  added it, and the kernel wizard can add items to a released kernel.

* Wed Oct 07 2026 Pau Aliagas <linuxnow@gmail.com> - 1.1.0-1
- Every kernel cites where the engine declares each of its values
  (`recipes/answers/`), and `make completeness` checks each kernel against the
  kernel recipe: its file, the citations, the renders and the changelog.
  `tools/omx-new-kernel.mjs` adds a kernel by reading its values from the
  engine's own code.
- The delay plugin's parameter selection (`data/plugins/delay.json`,
  `DELAY_PLUGIN`) and the `omxcontract/params/` headers are gone: omx-plugins
  now declares each plugin's parameters by reference to the kernel travels
  here and renders those headers itself. While every consumer of omx-contract
  is a FreeMixer repository, removing an item is a minor release.
- A travels table may name each field's travel by reference, and `x` (a
  multiplier) joins the units.
- The flanger kernel: 4 values, read from the engine where it declares them.
- The deesser kernel: 8 values, read from the engine where it declares them.
- The geq kernel: 4 values, read from the engine where it declares them.
- The phaser kernel: 8 values, read from the engine where it declares them.
- The rotary kernel: 20 values, read from the engine where it declares them.
- The tremolo kernel: 4 values, read from the engine where it declares them.

* Mon Oct 05 2026 Pau Aliagas <linuxnow@gmail.com> - 1.0.0-1
- First release: the shared declarations the FreeMixer DSP library needs
  (value ranges, defaults, kernel constants, sample rates and plugin parameter
  choices), as JSON data with a JSON Schema and as C headers. The headers
  match the ones omx-dsp 0.1.3 shipped, unit for unit.
