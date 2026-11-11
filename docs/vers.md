---
title: "VERS version ranges"
description: "Supported VERS versioning schemes, conformance results against package-url/vers-spec v1.2.1, and how to run the suite."
layout: doc
permalink: /vers/
---

Ebb parses, normalises, formats, and evaluates [VERS (`vers:`)](https://github.com/package-url/vers-spec) version ranges offline via [`@velella/ebb/vers`](https://github.com/velella-sh/ebb/blob/main/src/vers.ts). Every built-in versioning scheme lives in one lookup table in [`src/vers/schemes.ts`](https://github.com/velella-sh/ebb/blob/main/src/vers/schemes.ts).

```ts
import {
  SUPPORTED_SCHEMES,
  formatVers,
  normalizeVers,
  parseVers,
  versContains,
} from "@velella/ebb/vers";

const canonical = normalizeVers("VERS:NPM/ >= 2.0.0 | = 1.0.0 ");
const parsed = parseVers(canonical);

console.log(
  JSON.stringify(
    {
      schemeCount: Object.keys(SUPPORTED_SCHEMES).length,
      canonical,
      formatted: formatVers(parsed),
      matchesV1: versContains(parsed, "1.0.0"),
      matchesV15: versContains(parsed, "1.5.0"),
    },
    null,
    2,
  ),
);
```

Output:

```json
{
  "schemeCount": 10,
  "canonical": "vers:npm/1.0.0|>=2.0.0",
  "formatted": "vers:npm/1.0.0|>=2.0.0",
  "matchesV1": true,
  "matchesV15": false
}
```

## Supported schemes

All built-in schemes are defined in [`SUPPORTED_SCHEMES`](https://github.com/velella-sh/ebb/blob/main/src/vers/schemes.ts):

| Scheme | Comparator | Versioning rules |
| --- | --- | --- |
| `intdot` | [`intdotScheme`](https://github.com/velella-sh/ebb/blob/main/src/vers/schemes.ts) | Dot-separated integers; suffixes after the first non-digit/non-dot character are ignored. |
| `semver` | [`semverScheme`](https://github.com/velella-sh/ebb/blob/main/src/vers/semver.ts) | Semantic Versioning 2.0 (build metadata ignored; short `v1` / `1.2` prefixes accepted). |
| `npm` | [`semverScheme`](https://github.com/velella-sh/ebb/blob/main/src/vers/semver.ts) | Semantic Versioning 2.0. |
| `cargo` | [`semverScheme`](https://github.com/velella-sh/ebb/blob/main/src/vers/semver.ts) | Semantic Versioning 2.0. |
| `golang` | [`semverScheme`](https://github.com/velella-sh/ebb/blob/main/src/vers/semver.ts) | Semantic Versioning 2.0 with short `v1` / `1.2` prefixes. |
| `composer` | [`semverScheme`](https://github.com/velella-sh/ebb/blob/main/src/vers/semver.ts) | Semantic Versioning 2.0 with short `v1` / `1.2` prefixes. |
| `pypi` | [`pep440Scheme`](https://github.com/velella-sh/ebb/blob/main/src/vers/pep440.ts) | Python PEP 440 ordering (epochs, pre/post/dev releases, local segments). |
| `maven` | [`mavenScheme`](https://github.com/velella-sh/ebb/blob/main/src/vers/maven.ts) | Apache Maven `ComparableVersion` qualifier and segment rules. |
| `nuget` | [`nugetScheme`](https://github.com/velella-sh/ebb/blob/main/src/vers/nuget.ts) | NuGet four-part numeric versions and SemVer 2.0 case-insensitive pre-release labels. |
| `gem` | [`gemScheme`](https://github.com/velella-sh/ebb/blob/main/src/vers/gem.ts) | RubyGems `Gem::Version` ordering (pre-release segments sort before releases). |

Parsing or evaluating any scheme not registered in [`SUPPORTED_SCHEMES`](https://github.com/velella-sh/ebb/blob/main/src/vers/schemes.ts) throws [`VersError`](https://github.com/velella-sh/ebb/blob/main/src/vers/errors.ts) (an [`EbbError`](https://github.com/velella-sh/ebb/blob/main/src/errors.ts) with `code: "invalid-version"`), unless added at runtime with `registerVersionScheme`.

## What is not supported

- **Unsupported schemes in the upstream suite:** `apk`, `alpm`, `conan`, `datetime`, `gentoo`, `lexicographic`, `openssl`, and `nginx` are not built in. The suite skips `920` non-`from_native` vectors for those schemes (`716` `apk`, `42` `alpm`, `47` `conan`, `11` `datetime`, `48` `gentoo`, `12` `lexicographic`, `44` `openssl`; `nginx` appears in `from_native` vectors only).
- **Native range conversion (`from_native`):** Ebb does not translate ecosystem-native range expressions (`^1.2`, `~> 2.0`, etc.) into `vers:` strings. The `737` `from_native` vectors in the vendored suite are skipped.

## Conformance suite and pass rate

The vendored fixtures in [`tests/vers/fixtures/`](https://github.com/velella-sh/ebb/blob/main/tests/vers/README.md) come unchanged from [`package-url/vers-spec@v1.2.1`](https://github.com/package-url/vers-spec/tree/v1.2.1/tests) (`2,721` total vectors).

| Metric | Value | Notes |
| --- | --- | --- |
| Supported schemes pass rate | `1064/1064` (100%) | Reported on every CI run by [`tests/vers/spec.test.ts`](https://github.com/velella-sh/ebb/blob/main/tests/vers/spec.test.ts). |
| Documented upstream inconsistencies | `7` | Verified via conforming alternatives in [`tests/vers/upstream-inconsistencies.json`](https://github.com/velella-sh/ebb/blob/main/tests/vers/upstream-inconsistencies.json) (`4` NuGet pre-release casing differences, `3` PyPI Clause 5.4 contradictions). |
| Canonical round-trips | `30` unique strings | Verified in [`tests/vers/roundtrip.test.ts`](https://github.com/velella-sh/ebb/blob/main/tests/vers/roundtrip.test.ts) via `parseVers(normalizeVers(v))` → `formatVers` → `parseVers`. |
| Unsupported-scheme vectors skipped | `920` | Schemes without a registered comparator (`apk`, `alpm`, `conan`, `datetime`, `gentoo`, `lexicographic`, `openssl`). |
| `from_native` vectors skipped | `737` | Native-syntax conversion tests outside Ebb's `vers:` parser scope. |

## Running the suite

Run the full project checks (formatting, TypeScript build, unit tests, and conformance suites):

```bash
npm ci
npm run check
```

To build and run only the VERS suite and related tests:

```bash
npm run build --silent
node --test dist/tests/vers/spec.test.js dist/tests/vers/roundtrip.test.js dist/tests/vers/schemes.test.js dist/tests/vers/errors.test.js
```
