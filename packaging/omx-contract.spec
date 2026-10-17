# SPDX-License-Identifier: GPL-3.0-or-later
# Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com>
Name: omx-contract
Version: 2.16.0
Release: 1%{?dist}
# the command carries ajv and its dependencies (vendor/): MIT, and BSD-3-Clause for fast-uri
License: GPL-3.0-or-later AND MIT AND BSD-3-Clause
Summary: One shared source of truth for every FreeMixer knob, range and default
URL: https://github.com/FreeMixer/omx-contract
BuildArch: noarch

Source0: %{url}/archive/v%{version}/%{name}-%{version}.tar.gz

BuildRequires: gcc
BuildRequires: make
BuildRequires: sed
BuildRequires: tar
BuildRequires: gzip

Requires: nodejs
Provides: bundled(nodejs-ajv) = 8.20.0
Provides: bundled(nodejs-fast-deep-equal) = 3.1.3
Provides: bundled(nodejs-fast-uri) = 3.1.8
Provides: bundled(nodejs-json-schema-traverse) = 1.0.0
Provides: bundled(nodejs-require-from-string) = 2.0.2

%description
A fader range, a default, a plugin parameter, a supported sample rate: in
FreeMixer each of these is written down once, in omx-contract, and everything
else reads it. That is why the console, the DSP library and the plugins agree
on what a knob does and how far it turns. The declarations are plain JSON with
a JSON Schema, so tools in any language can read them, and they are rendered
as C headers for the code that is built from them.

This package holds the omx-contract command, which validates, formats and
renders the declarations, and reads the contract directory the packages
install their definitions into as one checked set.

%package devel
License: GPL-3.0-or-later
Summary: Headers, JSON data and schema to build on the FreeMixer declarations
# the C headers and the resolved json need no node; the union of the contract directory is read by the command
Recommends: %{name} = %{version}-%{release}
Provides: %{name}-static = %{version}-%{release}
# the owners' releases before they installed their own definitions read names this release no longer carries
Conflicts: omx-dsp-devel < 0.22.0~
Conflicts: omx-clap-core-devel < 0.10.0~
Conflicts: omx-plugins-devel < 0.10.0~

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
%{__make} install-cli DESTDIR=%{buildroot} PREFIX=%{_prefix} DATADIR=%{_datadir} BINDIR=%{_bindir} CLIDIR=%{_prefix}/lib/omx-contract MANDIR=%{_mandir}

%check
%make_build check

%files
%license LICENSE
%{_bindir}/omx-contract
%{_prefix}/lib/omx-contract/
%{_mandir}/man1/omx-contract.1*

%files devel
%license LICENSE
%doc README.md
%{_includedir}/omxcontract/
%{_datadir}/omx-contract/
%{_datadir}/pkgconfig/omx-contract.pc

%changelog
* Wed Oct 21 2026 Pau Aliagas <linuxnow@gmail.com> - 2.16.0-1
- The nine-rate list RME_RATES is renamed ORACLE_FULL_RATES, the full grid
  of rates a professional interface can clock at, 32 to 192 kHz, beside the
  four-rate ORACLE_FLOOR_RATES. Its values are unchanged and its doc names
  no vendor.
- The old name stays for this release as a deprecated alias of the new one:
  OMX_RME_RATES_COUNT and OMX_RME_RATES_INIT expand to the
  OMX_ORACLE_FULL_RATES_* defines, the TypeScript RME_RATES export is the
  ORACLE_FULL_RATES export, and the JSON render lists it under formerNames.
  2.17.0 removes it.
- The schema gains formerly, the word a renamed list keeps its old name
  with, and the release that removes it.
- No owner needs a newer release: the alias keeps the old name building, so
  the conflicts stay at omx-dsp-devel 0.22.0, omx-clap-core-devel 0.10.0
  and omx-plugins-devel 0.10.0, as in 2.15.0.

* Tue Oct 20 2026 Pau Aliagas <linuxnow@gmail.com> - 2.15.0-1
- Packages install their own definitions into a shared contract directory,
  contract.d/2/<package>/ with a MANIFEST.json, named by contractdir in
  omx-contract.pc, and every reader reads it through one call that refuses an
  incomplete, altered or conflicting set with a named contract.* code.
  A definition file states the lowest schema it needs (requires) and where its
  values come from and which code implements them (source); links --check
  holds those links to the owner's code.
- The schema gains the plugin descriptor words: controls with their ids,
  symbols, groups, meanings and flags, audio and note ports, instruments, what
  a plugin needs from its host, and latency, with five more units.
- An owner frames its own C headers and TypeScript module with a render word
  in its files, and renders them with render --package.
- The kernels, the DSP design constants and the hosting limits and codes now
  ship with omx-dsp and omx-clap-core, and the console-only rows with the
  console. This package keeps the shared facts: the sample rate sets, the
  hard real-time target, the readout rate and the parameter scales.
  clap_host_limits.h is no longer installed here.
- It conflicts with omx-dsp-devel before 0.22.0, omx-clap-core-devel before 0.10.0
  and omx-plugins-devel before 0.10.0, the releases that do not yet ship their
  own definitions.
- The omx-contract command ships in its own package, omx-contract, with its
  man page and the npm packages it runs on, so the union of the contract
  directory can be read on a system with node and nothing else installed.

* Mon Oct 19 2026 Pau Aliagas <linuxnow@gmail.com> - 2.14.0-1
- The kernel files declare what the console engine still typed as literals: the FBS, HRP, balance,
  generator, align and idelay travels and constants, and the multiband compressor's limits
  (MBC_MIN_BANDS, MBC_MAX_BANDS, MBC_CORNER_MAX_FRACTION and the come-up corners by band count).
  The delay's read-tap travel, its per-tap gain and pan limits and the tap factor set as two integer lists are declared.
  The instrument families (INSTRUMENT_FAMILIES) and the pitch search each one implies (HRP_FAMILY_SEARCH) are declared,
  and so are the EQ biquad kinds (BIQUAD_KINDS) and the low-pass hand-over table (LOWPASS_HANDOVER).
  The graphic EQ declares its design mode, GEQ_MODES, and the designClamped readout; the drive curve and band choices
  declare their come-up; HRP_AMOUNT_RANGE's come-up is held to what its readers derive; seconds and minutes join the unit list.
  The docs say what semver classifies and the development-phase rule, and describe the shapes the data uses.

* Sun Oct 18 2026 Pau Aliagas <linuxnow@gmail.com> - 2.13.0-1
- The EQ curve grid is contract data now: EQ_CURVE_GRID declares the start frequency
  (20 Hz), the points per decade (53) and the upper bound (0.999 of the Nyquist
  frequency); the C render has OMX_EQ_CURVE_GRID_* defines and the TypeScript
  render the EQ_CURVE_GRID export, so an engine and a UI draw the same curve.

* Sat Oct 17 2026 Pau Aliagas <linuxnow@gmail.com> - 2.12.1-1
- Packages for 2.12.0 were not built because the release workflow lacked
  a permission; 2.12.1 is the same data with the fix

* Fri Oct 16 2026 Pau Aliagas <linuxnow@gmail.com> - 2.12.0-1
- The hosting limits and refusal codes are contract data now:
  HOSTED_STAGE_LIMITS and HOSTING_CODES, rendered by the C target as
  clap_host_limits.h. The schema gains a codes kind and per-sheet docs
- The pitch shifter's limits carry their step, unit and come-up value as
  the console shows them; st (semitones) joins the list of units
- The documentation in the data states plain facts and names the console
  engine instead of other repositories; every 2.11.0 define is unchanged

* Wed Oct 14 2026 Pau Aliagas <linuxnow@gmail.com> - 2.11.0-1
- DRIVE_HF_ROLLOFFS ids are off, 12000, 16000, each carrying its corner
  in Hz, off none (#29); a set's ids may carry values. The C header
  renumbers the roll-off set and adds omx_drive_hf_rolloffs_value()

* Wed Oct 14 2026 Pau Aliagas <linuxnow@gmail.com> - 2.10.1-1
- Packages for the 2.10 data: the release gate takes a MAJOR class on
  a minor bump in the development phase (#54), so the RPM and DEB that
  2.10.0 never built are built here. The data is 2.10.0's, unchanged

* Tue Oct 13 2026 Pau Aliagas <linuxnow@gmail.com> - 2.10.0-1
- DETECTOR_OVERSAMPLINGS ids are auto, off, 4x (#28); the C header
  spells OMX_DETECTOR_OVERSAMPLINGS_4X (still 2), every other 2.9.0
  define unchanged

* Tue Oct 13 2026 Pau Aliagas <linuxnow@gmail.com> - 2.9.0-1
- An EQ band comes up off: EQ_BAND_ONS defaults to off (#26); the C
  header adds OMX_EQ_BAND_ONS_DEFAULT and keeps every 2.8.0 define

* Tue Oct 13 2026 Pau Aliagas <linuxnow@gmail.com> - 2.8.0-1
- The drive's oversampling factor is a control, oversample
  (DRIVE_OVERSAMPLES: 1, 2, 4, coming up at 4); the C header keeps every
  2.7.0 define

* Tue Oct 13 2026 Pau Aliagas <linuxnow@gmail.com> - 2.7.0-1
- The keyed gate's detector filter edges, hpHz and lpHz, are gate
  controls (GATE_KEY_LIMITS: 0..20000 Hz, step 1, no come-up value); the
  C header keeps every 2.6.0 define

* Tue Oct 13 2026 Pau Aliagas <linuxnow@gmail.com> - 2.6.0-1
- The sample-rate converter's design constants (src: SRC_TAPS,
  SRC_STOPBAND_DB, SRC_ROLLOFF, SRC_MAX_L) and the generators' kind and
  waveform sets (generator: GENERATOR_KINDS, WAVEFORMS); the C header
  keeps every 2.5.0 define

* Mon Oct 12 2026 Pau Aliagas <linuxnow@gmail.com> - 2.5.0-1
- The compressor's detector topology is a control, detectorTopology
  (DETECTOR_TOPOLOGY: feedforward, feedback), and the feedback loop's
  one-sample delay is a constant, DYN_FB_LOOP_DELAY_SAMPLES; the C header
  keeps every 2.4.0 define

* Sun Oct 11 2026 Pau Aliagas <linuxnow@gmail.com> - 2.4.0-1
- Readouts: a kernel file may list the meters the kernel reports, each
  with its unit, display range, scale and publish rate (docs/readouts.md)
- The compressor, the de-esser, the gate and the limiter declare their
  gain reduction, its range read off the travel that bounds it; the C
  header spells them OMX_<KERNEL>_READOUT_* and keeps every 2.3.0 define

* Fri Oct 09 2026 Pau Aliagas <linuxnow@gmail.com> - 2.3.0-1
- The input trim is a kernel, trim, with the one control trimDb (the
  console's TRIM_RANGE, -24 to +24 dB); the C header spells it
  OMX_TRIM_RANGE_* and keeps every 2.2.0 define
- TRIM_TRAVELS is that control's aggregate: the same value, declared once

* Fri Oct 09 2026 Pau Aliagas <linuxnow@gmail.com> - 2.2.0-1
- New controls: the delay's ping-pong switch (its come-up value is
  FX_DELAY_PINGPONG_DEFAULT), the drive's auto-gain and stereo-link switches
  and HF roll-off corner, and the compressor's kind and detector oversampling.
- The EQ kernel lists the controls an EQ instance takes, in its order: pass
  filter switches, corners and slopes, then the per-band type, frequency,
  gain, Q and switch, counted by EQ_BAND_COUNTS. The notch's Q travel is the
  Q control's travel while the band is a notch.
- A control may use the item another control declares, and a choice's
  default may refer to the scalar that states it. Every 2.1.0 C define is
  unchanged; the new sets are added.

* Fri Oct 09 2026 Pau Aliagas <linuxnow@gmail.com> - 2.1.0-1
- The JSON render lists each kernel's controls in their declared order, with
  the kind, the global each one lives in and the table of a table field, so a
  consumer reads control order and kinds from the render instead of the kernel
  files. The existing JSON keys and the C and TypeScript renders are unchanged.
- A control may declare "rearms": changing it re-arms the kernel's state, so
  it is not a smooth parameter. The limiter's look-ahead declares it.

* Fri Oct 09 2026 Pau Aliagas <linuxnow@gmail.com> - 2.0.0-1
- A kernel file now holds four sections: its controls (each a travel or a
  choice, in order), the tables some of them are fields of, the aggregates
  that list controls by name, and its constants. A control's item name follows
  from the kernel and its own name unless it says otherwise. Every render is
  the same: the C headers byte for byte, the JSON item for item, the
  TypeScript declaration for declaration. A kernel file written the old way,
  as a flat map of items, is refused by `omx-contract validate`, and the
  kernel wizard writes the new shape.
- The band_dyn kernel: the travels of a multiband dynamics band, read from the
  de-esser and the compressor where they declare them, its modes, its knee and
  its band count, plus the shortest attack at which the compressor's detector
  does not alias, the floor of the band's attack travel.
- HRP_AMOUNT_RANGE comes up from the desk, like every other travel.
- `omx-contract semver` against a release before 2.0.0 reads that release's
  kernel files in the new shape, so it reports only the items that changed.

* Thu Oct 08 2026 Pau Aliagas <linuxnow@gmail.com> - 1.3.0-1
- Corrects the 1.2.0 note: omx-dsp could not yet build against the header
  rendered here, because 38 limits its code reads were missing from it (the
  feedback detector, the ring correction, the RTA, the bus input cap and the
  EQ band reserve). They are all here now, with the value omx-dsp uses today,
  so the list of limits omx-contract lacks that omx-dsp keeps ends empty. The
  three EQ band budget numbers that 1.2.0 said stay in openmixer are in too:
  the budget is declared here and `omx-contract validate` refuses data where
  the operator's reserve plus the feedback and ring planters' bands no longer
  fit the EQ's maximum.
- A new kind of item, the set: ordered ids with an optional default and
  labels. C gets an enum with a `_COUNT` and, where there is a default, a
  `_DEFAULT`; TypeScript gets the list of ids; the JSON render carries the
  default and the labels. A travel can now say how a host draws it (`scale`,
  one of `PARAM_SCALES`: linear, log or stepped), a derivation `ceilSum`
  rounds a sum up, and an item outside the kernels can record the release that
  added it (`since`).
- The fbs kernel: 20 values the feedback detector reads, from the guard bands
  and the growth gates to the default thresholds and the notch policy, read
  from the engine where it declares them.
- The hrp kernel: 9 values the ring correction reads, read from the engine
  where it declares them, plus its amount travel with the come-up value 0.5
  omx-dsp uses.
- The rta kernel: 2 values, read from the engine where it declares them: the
  target bin width and the largest FFT.
- The mixmatrix kernel: 1 value, read from the engine where it declares it:
  the input cap of a summing bus.
- The eq kernel: 8 more values. The band types and the pass-filter slopes as
  sets, with the labels a host shows. The operator's band reserve. How many
  bands each strip type starts with and may hold (`channel` 4 of 24, `strip`
  4, `eq8` 8, `eq16` 16, `eq32` 32): a start never exceeds the maximum, and
  the default centres of any count come from one rule for every strip, host
  and consumer, with no override. The rule: four bands start at 100, 400, 2000
  and 8000 Hz; any other count is spread evenly on a log axis across the band
  frequency range and snapped to the ISO 266 R10 preferred frequencies (to R20
  where R10 is too coarse to give each band its own centre, as at 32 bands);
  the first band is a low shelf and the last a high shelf, each switchable to
  a bell, and every band between is a bell. Every band comes up flat at Q 1,
  the value omx-plugins ship for bells and shelves, so no shelf Q is invented.
  The pass filters come up at 80 Hz and 18 kHz. `eqDefaultCentres`,
  `eqDefaultTypes` and `eqDefaultBands` in the TypeScript module and
  `omx_eq_default_centres` and `omx_eq_default_type` in the C header run the
  rule, and a test holds the three equal for every count. The console's
  previous starter bands (a low shelf at 120 Hz, bells at 800 and 3000 Hz, a
  high shelf at 10 kHz, Q 0.7 and 1) change to these; gains come up at 0 dB,
  so nothing sounds different.
- The EQ's three frequency travels, as a host draws them, in
  `EQ_CONTINUOUS_TRAVELS`: the band frequency and the two pass-filter corners
  with no step, on a log scale.
- The deesser kernel: 1 more value, the de-esser's modes, as a set.
- The drive kernel: 2 more values, the curves and the bands, as sets.
- The reverb kernel: 2 more values, the algorithms as a set and the gated
  reverb's gate attack.
- The rotary kernel: 1 more value, the speeds, as a set.
- The tremolo kernel: 1 more value, the modes, as a set coming up as tremolo.
- The gate kernel: 1 more value, the key sources (self or sidechain), as a
  set.
- The chorus kernel: 2 more values, the base delay and the longest delay a
  voice reaches (the base plus the depth maximum, rounded up).
- The flanger kernel: 2 more values, likewise.
- The phaser kernel: 1 more value, the top frequency of the sweep.
- Two measurement rate sets for the oracles: the four every kernel runs at
  (`ORACLE_FLOOR_RATES`) and the nine an RME interface clocks at
  (`RME_RATES`).
- The ISO third-octave centres now have a C spelling
  (`OMX_ISO_THIRD_OCTAVE_CENTRES_HZ_INIT`).
- The leftover parameter-header renderer of the retired plugin data is gone,
  with the frozen delay header it was proved against: omx-plugins renders its
  own parameter headers.
- The kernel wizard cites an item the engine does not declare by an `origin`
  sentence (the omx-dsp header or the ruling that first declares it) and takes
  a doc for a value that shares its comment, and the importer resolves
  `@openmixer/omx-contract` from the engine's installed copy.

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
