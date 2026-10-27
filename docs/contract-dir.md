<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Copyright (C) 2026 Pau Aliagas <linuxnow@gmail.com> -->
# The contract directory

A package that owns definitions installs them as files into one shared directory, and every reader reads that
directory through one call. This page states the directory's layout, the schema words a file carries to live
there (`requires`, `source`, `render`), the refusals the reader names by code, and the `links` check. The bundled `data/`
stays the default input of every command; the directory is read only when it is asked for.

## The layout

```
<contractdir>/<schema major>/<package>/
    MANIFEST.json
    <file>.json ...            any depth; a kernel file sits under kernels/
```

- `contractdir` is a variable of `omx-contract.pc`: `pkg-config --variable=contractdir omx-contract`. It names
  the directory above the majors; a reader appends its own schema major (`3`) and reads nothing else (an owner of schema 2 under `2/` is never read), so a future
  major installs beside this one and is never half-read.
- One directory per package. The owner is the path, two packages never ship one file, and a package's files leave
  with it.
- `MANIFEST.json`, written at install, is the list of the package's files and their hashes:

  ```json
  { "package": "omx-dsp", "version": "0.25.0", "schemaMajor": 3, "tree": "data",
    "files": { "kernels/eq.json": "<sha256 hex of the installed bytes>" } }
  ```

  `package` is the directory's name and `schemaMajor` the major above it. `version` is the package's own version,
  the one a `requires` floor is compared to. `tree` (optional) is the directory of the owner's source tree the
  files were installed from: a file's reported path is `<tree>/<file>`, the path in the tree that owns it, so the
  renders cite the same file whether they read the tree or the installed copy.
- A file name carries no version.
- A past minor's schema stays frozen under `schema/history/<major>.<minor>.0.schema.json` (never the current
  minor, which is `schema/omx-contract.schema.json` itself): the reader checks a file against the schema at its
  stated floor with it (`contract.schema.floor-understated`, below). A release that bumps `x-omx-schema-version`
  freezes the minor it leaves as a new file here; the vocabulary never changes at a patch, so a floor's patch
  names no schema of its own.
- `tools/install-contract-dir.sh <package> <version> <from> <to>` installs one package: it copies every `.json`
  under `<from>` to `<to>/<package>/`, writes `$schema` in its installed form (below) and writes the manifest. It
  is plain shell and coreutils, so a release build runs no node. `make install` installs omx-contract's own
  `data/` as the package `omx-contract` with it.

`$OMX_CONTRACT_PATH`, a `:` list of directories each standing where `contractdir` stands, replaces the pkg-config
lookup for a developer's checkout and for a test. A release build never sets it. When two of its directories hold
one package, the first one wins.

## The words of the schema

### `requires`: a schema floor, and the packages a file refers to

```json
{ "$schema": "https://github.com/FreeMixer/omx-contract/raw/v3/schema/omx-contract.schema.json",
  "requires": { "omx-contract-schema": ">= 3.0.0", "omx-dsp": ">= 0.25.0" } }
```

- The schema states the version of its vocabulary: `"x-omx-schema-version"`, the omx-contract release that last
  changed it. A new kind, unit, scale or field is a minor; removing or narrowing one is a major.
- `requires.omx-contract-schema` is the lowest schema the file's words need. A floor, never a ceiling: every
  entry is written `>= <x.y.z>`.
- Any other key of `requires` names a package whose items the file refers to, with that package's floor.
- Every installed file of a package other than `omx-contract` carries `requires.omx-contract-schema`. omx-contract's
  own files are read by the schema they ship with and may leave it out.
- An installed file's `$schema` is the URL above, whose `v<major>` is the schema major. omx-contract's own files
  in `data/` keep their relative `$schema`; the install writes the URL in their place.

### `source`: provenance and connector

A file may carry one `source` for all its items, and an item (or a kernel control) its own, which takes the
file's place for that item.

| Field | Meaning |
|---|---|
| `from` | Provenance: where the value was read off code. A link, compared to the item's whole value, or a map from a field path of the value (`max`, `guitar.maxVoices`) to a link. |
| `impl` | Connector: the code that implements the item. A link or a list of links. |
| `at` | `<package>@<version>`: the links lie outside the owner's tree (a twin in another package). Absent: the owner's tree at the manifest's version. |

A link may also carry its own `at`, `{ "link": "<link>", "at": "<package>@<version>" }`, in place of the source's: an
`impl` in the owner's tree beside a `from` in the console's tree at the commit the value was imported from
(`"from": { "link": "<path in the console's tree>#<symbol>", "at": "openmixer@<commit>" }`), so the import's provenance is
the definition's `source.from` and no second record is kept. A `from` map's field may carry one too.

A link is `<path>#<symbol>[.<field>|[<key>]]...`, the path relative to the owner's root:
`include/omxdsp/omx_eq_design.h#OMX_EQ_LOWPASS_HANDOVER_Q_PEAK`, `include/omxdsp/omx_eq_design.h#enum omx_eq_kind`,
`src/omx_hrp_correct.c#omx_hrp_correct_plan`. A table control's link sits on its table, since the field is no item
of its own.

### `render`: an owner's own header

A file may say how the owner's own C headers and TypeScript module spell its items: each header's path, guard,
licence project, banner, brief and sections, and the module's name. `render --target c|ts --package <owner>` writes
them; the tool names no item (docs/render.md).

### `checks`: a sum held under a bound

```json
{ "checks": [
    { "name": "eqBandBudget", "doc": "The operator's reserve and both planters fit the EQ's band maximum.",
      "sum": ["OPERATOR_EQ_BANDS_RESERVE", "FBS_DEFAULT_MAX_AUTO_BANDS", "HRP_DEFAULT_MAX_AUTO_BANDS"],
      "atMost": "EQ_MAX_BANDS" } ] }
```

A file may declare a relation between numbers that several packages state, which no one item can carry: `validate`
adds the numbers `sum` names and refuses (rule `check`, the check's `name`) a total above the number `atMost` names.
Each term is an item name, or an item and the path to one of its leaves (`EQ_BAND_COUNTS.channel.max`). A read that
lacks an item a check names cannot judge it and skips it (omx-dsp's own read never holds the console's FBS default);
the package that sees every term judges it. A term that resolves to anything but a finite number is refused. The
package that owns the relation declares it; the tool names none.

## A package's verbs

A host's verbs (the lines of mod-host's protocol a controller sends, the replies and refusals they answer, and what
each host owes them) are declared by the package that owns them, in an item of kind `verbs` in a file of its own
directory, `<contractdir>/3/<package>/`. A package adds a verb by adding the file or an entry to it and installing it;
omx-contract changes for none of it.

```json
{ "$schema": "../schema/omx-contract.schema.json",
  "requires": { "omx-contract-schema": ">= 3.3.0" },
  "OMX_CLAP_CORE_VERBS": { "kind": "verbs", "since": "0.20.0", "doc": "The verbs omx-clap-host answers by instance.",
    "verbs": {
      "paramInfo": {
        "verb": "param_info",
        "format": "param_info %i %s",
        "reply": "resp 0 <unit> <scale> <min> <max> <default> <step> <stable_symbol>",
        "codes": [{ "ref": "MOD_HOST_REPLY_CODES.paramSymbolInvalid" }],
        "implementedBy": { "plugin-hostd": "optional", "omx-clap-host": "optional", "mod-host": "unsupported" },
        "since": "0.20.0",
        "doc": "What a parameter's value means: its unit, its scale, and the symbol it keeps across hosts and versions." } } } }
```

| Field | Meaning |
|---|---|
| `verb` | The word as written on the wire, lower snake case. |
| `format` | The line as mod-host's `protocol_add_command` takes it: the verb, then `%i` (an integer), `%f` (a number) or `%s` (a word) per argument, and a last `...` for the words that may follow. Its first word is the verb. |
| `reply` | The reply as the protocol writes it: `resp 0`, `resp <count>`, or `resp 0` and its columns. |
| `codes` | The refusals it answers besides the reply, each `{ "ref": "<ITEM>.<name>" }` to a code of a `codes` item. A reply code is `reply.<group>.<reason>` and carries `resp`, the negative number of `resp <n>`. The codes of another package are named in `requires`, as any reference is. |
| `implementedBy` | What each host owes the verb, by a word of `VERB_HOSTS` (`data/verbs.json`: `plugin-hostd`, `omx-clap-host`, `mod-host`): `required` (answered as its grammar says), `optional` (answered or refused, never misread) or `unsupported` (refused on purpose). A host left out owes it nothing. A new host is a word added to `VERB_HOSTS`, an omx-contract minor. |
| `since`, `doc` | The owner's release that first carried the verb, and one line of prose. |

`MOD_HOST_REPLY_CODES` is a codes item of the same package, `"paramSymbolInvalid": { "code":
"reply.mod-host.param-symbol-invalid", "resp": -103 }`. The fixture `test/fixtures/package-verbs/` declares four verbs
this way (track_info, remote_pages, param_info, chain) with the refusals they answer.

A verb has one owner: one word declared twice, by one package or two, is refused. The renders carry every verb of the
read: the C render writes `omxcontract/omx_host_verbs.h` (and `render --package` the package's own,
`<stem>_host_verbs.h`, docs/render.md) with `OMX_VERB_<VERB>` (the word), `OMX_VERB_<VERB>_FMT` (the format),
`OMX_VERB_<VERB>_REPLY`, `OMX_VERB_<VERB>_CODES_INIT` (the refusals' `resp`, in order) and the table
`<stem>_host_verbs()`, with `<stem>_host_verb_find()` and `<stem>_host_verb_level()`, which a host reads at run time; the ts
and json renders carry the item, every code resolved to its `code` and `resp`.

Adding the kind is a MINOR change of the schema (3.3.0), as any new kind is. For a verbs item `semver` judges: a verb
added, a refusal added, or a host given an optional verb it did not owe is MINOR; a verb removed, its word, format or
reply changed, a refusal removed, or any other move of what a host owes is MAJOR. A verb's hosts and controllers are no
consumer `DEVELOPMENT_PHASE` names, so a verb's removal is MAJOR in the development phase too.

## Reading the directory

`loadContractDir()` (`lib/contract-dir.mjs`) and the CLI's `--contract-dir <dir>` (or `--installed`, which looks it
up as step 1 says) read it in this order; any
refusal stops the whole read and nothing is returned, so there is never a partial set:

1. Find the directory: `--contract-dir`, else `$OMX_CONTRACT_PATH`, else pkg-config. A directory of `validate`,
   `fmt --check`, `render` and `links` alike; `fmt` never writes one.
2. Read every `<package>/MANIFEST.json`, then every file it lists, checking each hash. A file on disk that the
   manifest does not list is refused too.
3. Check each file's `$schema` major and its `requires.omx-contract-schema` floor against the reader's schema,
   then validate the file against the schema and the kernel-file shape. A plugin descriptor
   ([descriptors.md](descriptors.md)) of origin `scanned` is refused here; any other is held to the schema and then
   to its own rules, each refused by its own code. A descriptor declares no item. Then, when the floor names an
   older minor, validate the file again against the schema frozen at that minor (`schema/history/`, above): a
   file that fails there while it passed against the reader's own schema understates its floor
   (`contract.schema.floor-understated`) — it needs the vocabulary of a minor newer than the one it states.
4. Merge into one namespace: one name, one declaration. A reference names an item of the same package, of
   omx-contract, or of a package the file's `requires` names.
5. Check every verb (above): one owner, a format that starts with its verb, known hosts, and codes that are codes. A
   code whose item no file declares was refused at step 4.
6. Check what the consumer needs (`--needs <package>@>=<x.y.z>`, repeatable).

The files are merged in the order of their reported paths, so omx-contract's own package reads in the order of
`data/` and every render of it is byte for byte the render of `data/`.

## The refusal codes

Each refusal is a code of `CONTRACT_CODES` (`data/codes.json`), printed first on its line and as `code` in
`--json`; the command exits 1. Exit 2 is usage or environment, never a pass. `data/codes.json` is the reader's
own table: it is validated by the schema like any data file, and it is not a declaration, so the renders do not
carry it and it is not installed in the directory.

| Code | When |
|---|---|
| `contract.dir.absent` | No directory found, or the one named does not exist. |
| `contract.manifest.absent` | A package directory without `MANIFEST.json`. |
| `contract.manifest.invalid` | A manifest that is not JSON, lacks a field, or names another package or major than its place. |
| `contract.manifest.mismatch` | A listed file missing, a file present but unlisted, or a hash that differs. |
| `contract.schema.major` | A file's `$schema` major is not the reader's, or `$schema` is not the installed form. |
| `contract.schema.too-old` | A file's `requires.omx-contract-schema` floor is above the reader's schema. |
| `contract.schema.floor-absent` | An installed file of another package than omx-contract with no schema floor. |
| `contract.schema.floor-understated` | A file does not validate against the schema at its `requires.omx-contract-schema` floor, only against a newer one. |
| `contract.file.not-json` | A file that does not parse. |
| `contract.file.invalid` | A schema or shape violation, an unknown key or word included. |
| `contract.item.duplicate` | Two files declare one name. |
| `contract.kernel.duplicate` | Two packages each install a file of one kernel (`kernels/<k>.json`): a kernel's controls are one file's, in its order. |
| `contract.ref.unresolved` | A reference names no item. |
| `contract.ref.undeclared` | A reference names an item of a package the file does not require. |
| `contract.verb.duplicate` | Two verbs items, of one package or two, declare one verb. |
| `contract.verb.format` | A verb's format does not start with its verb. |
| `contract.verb.host-unknown` | A verb's `implementedBy` names a host that is no word of `VERB_HOSTS`. |
| `contract.verb.code-unknown` | A verb's code names an item that is no codes item, or a name that item does not carry. |
| `contract.package.absent` | A package the consumer or a file requires is not installed. |
| `contract.package.too-old` | It is installed below the floor. |
| `contract.origin.misplaced` | A `scanned` plugin descriptor ([descriptors.md](descriptors.md)): a scan is never read as a declaration. |
| `contract.source.absent` | A link's path does not exist. |
| `contract.source.symbol-absent` | The path holds no definition of the link's symbol. |
| `contract.source.ambiguous` | The path defines the symbol twice. |
| `contract.source.differs` | The value at `from` is not the declared value. |
| `contract.source.unevaluable` | A `from` link whose value the tool cannot read (a selector into a table, a definition that is not a number, a string or an enum). |
| `contract.source.unread` | An `impl` link whose definition does not name the item. |
| `contract.source.none` | With `--require-impl`: an item with no `impl` link. |

A plugin descriptor's own rules carry the `contract.descriptor.*` codes listed in [descriptors.md](descriptors.md).

## `links --check`

```
omx-contract links --check [--root <owner tree>] [--data <dir> | --contract-dir <dir> --package <name>] [--require-impl]
```

Run by the owner's CI over its own tree; a consumer never resolves links. For every item, the effective `source`:

- every `impl` link: its path exists under the root, it defines its symbol once, and that definition (the line of
  a `#define`, the body of a function or enum, the statement of a declaration) names the item, as its name, its C
  spelling `OMX_<NAME>` or one of that spelling's derived names, or any other C name the render spells for it: a
  `_LIMITS` table's `OMX_<PREFIX>_<FIELD>_MIN` (`GATE_LIMITS` is read as `OMX_GATE_RATIO_MIN`), a declared scalar's macro, and the names a file's `render` word gives its
  items (`CLAP_HOST_<FIELD>`, `CLAP_HOST_CODE_<NAME>`; a field the word omits is no name of the item). An `impl` that is also the item's whole-value
  `from` link is the twin that holds the value, and its equality is what names it;
- every `from` link: the value it defines equals the declared value. A `#define` of a number or a string, a TS or
  JS `const` of a number or a string, and an `enum` (its enumerators in order, read without their common prefix,
  against a set's ids or a list's values, case and underscores aside) are read; anything else is
  `contract.source.unevaluable`.

Links with `at` lie in another package's tree; they are reported as unchecked unless `--at <package>=<dir>` names
that tree.
