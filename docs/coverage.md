---
title: "Runtime release-line coverage"
description: "Which runtimes, official GitHub Actions, and npm package releases Ebb tracks, and the sources each list uses."
layout: doc
permalink: /coverage/
---

Ebb aims to know every release line for the runtimes below: ended lines and scheduled end dates, taken only from each project's own support schedule.

## What "complete" means

A runtime is **complete** when both are true:

1. **Every release line first released since 2018** has a registry rule that covers its end (end-of-life, end-of-support, or an equivalent catch-all that matches that line).
2. **Every still-supported line with an official end date** has a `scheduled-end-of-life` (or scheduled end-of-support) rule for that date.

Dates keep the precision the official source publishes. Month-only announcements stay month-precision in summaries, in `x-*.endOfLifeMonth` on the rule, and as `datePrecision: "month"` on `check()` / `upcoming()` results (with `date` / `deadline` kept as the last day of that month for day arithmetic). The checker compares scheduled milestones to the official date at that precision and requires one scheduled rule to cover the release line’s full `lineVers` range and match that deadline. Ebb does not invent a day-of-month from a month-only source, and it does not copy dates from third-party aggregators.

Runtimes with **no published support schedule** are listed only to document that limit. They are not treated as incomplete for lacking dated rules.

## Scope

| Runtime | Official schedule | In scope |
| --- | --- | --- |
| Node.js | [Node.js Release Working Group schedule](https://github.com/nodejs/Release/blob/main/schedule.json) | Yes |
| Python | [Status of Python versions](https://devguide.python.org/versions/) ([machine-readable cycle](https://peps.python.org/api/release-cycle.json)) | Yes |
| Go | [Go release history and support policy](https://go.dev/doc/devel/release) | Yes |
| Java | [Eclipse Temurin support](https://adoptium.net/support/) (OpenJDK / Temurin availability; vendor named per rule) | Yes |
| Ruby | [Ruby maintenance branches](https://www.ruby-lang.org/en/downloads/branches/) | Yes |
| PHP | [PHP supported versions](https://www.php.net/supported-versions.php) ([unsupported branches](https://www.php.net/eol.php)) | Yes |
| .NET | [.NET and .NET Core support policy](https://dotnet.microsoft.com/en-us/platform/support/policy/dotnet-core) | Yes |
| Rust | [Rust Book — maintenance time](https://doc.rust-lang.org/book/appendix-07-nightly-rust.html#maintenance-time) ([security policy](https://www.rust-lang.org/policies/security)) | Yes |
| Deno | [Deno stability and releases (LTS)](https://docs.deno.com/runtime/fundamentals/stability_and_releases/) | Yes (dated LTS lines only) |
| Bun | No official dated support schedule | Limits only — no dated rules required |

## Coverage status

The table below is filled at documentation build time by `tools/coverage/runtimes.ts` from the reviewed expected release lines under `tools/coverage/expected/` and the current registry. It is not edited by hand.

<!-- runtime-coverage:begin -->

| Runtime | Status | Missing lines | Missing scheduled |
| --- | --- | --- | --- |
| bun | limit | — | — |
| deno | complete | — | — |
| dotnet | complete | — | — |
| go | complete | — | — |
| java | complete | — | — |
| nodejs | complete | — | — |
| php | complete | — | — |
| python | complete | — | — |
| ruby | complete | — | — |
| rust | complete | — | — |

<!-- runtime-coverage:end -->

## Limits

- **Bun:** No official dated support or LTS schedule is published. Existing historical Bun entries in `registry/deno.json` are not expanded; new dated Bun rules are not added until Bun publishes a schedule.
- **Deno:** Coverage tracks the official LTS maintenance table on the Deno stability page. Undated stable-channel minors without an LTS row are not given invented end dates.
- **Ruby 3.4 / 4.0 / 4.1:** The maintenance branches page lists EOL as TBD; those lines stay policy-only until a date is published.
- **Java LTS (Temurin):** Java 11, 17, 21, and 25 are recorded as supported without a fixed EOL. Temurin’s “At least …” availability floors are not treated as end dates, so no scheduled rule is invented from them.

## Checker

```bash
npm run build --silent
node dist/tools/coverage/runtimes.js
```

The checker reads only local expected JSON and `registry/`. It does not fetch the network. Exit code `0` means complete, `1` means at least one in-scope runtime still has a gap (the docs table is still written with `--write-docs`), and `2` means a checker or write error.

## Official Actions

Ebb records which major versions of official GitHub Actions run on a Node.js runtime GitHub has removed from Actions runners.

An action is **complete** when every published major whose `action.yml` sets `runs.using` to `node12`, `node16`, or `node20` is matched by a registry end rule (`end-of-support`, `end-of-life`, or `removed`) for that action. The rule's VERS range must contain version `N.0.0`. A catch-all such as `vers:semver/<5.0.0` covers major 4. When the inventory lists `releases` because `runs.using` changes inside a major, the checker also requires an end rule for each retired release version, such as `6.0.0` and `6.1.0` under `actions/setup-go` while `6.2.0` stays on Node.js 24.

Node.js 20 was removed from GitHub-hosted Actions runners on 2026-09-23 ([changelog](https://github.blog/changelog/2026-09-23-node-20-is-no-longer-available-in-github-actions/)). Node.js 12 was removed on 2023-08-14 and Node.js 16 on 2024-11-12. This list was reviewed on 2026-11-15, after all three dates, so those majors are `end-of-support` or `removed`. They are not `scheduled-end-of-life`.

A **coverage limit** explains why an action has no Node.js rule: it is composite, Docker, a starter template, or it has no retired JavaScript major. The limit does not hide a retired runtime the inventory lists, and an in-scope action missing from the inventory is incomplete. Majors that set `runs.using` to `node24`, `composite`, or `docker` do not need a retired-runtime rule.

Third-party actions already in the registry (`docker/*`, `softprops/action-gh-release`, `hashicorp/setup-terraform`, `astral-sh/setup-uv`) stay there. They are not part of this completeness list.

Rules keep a string `replacement`, and cases keep matching that string. Structured replacement objects wait on [#418](https://github.com/velella-sh/ebb/issues/418). This page does not close #544 or #381.

### Scope

Reviewed on 2026-11-15 from the non-archived repositories in the [`actions` organization](https://github.com/orgs/actions/repositories) that have a root `action.yml` or `action.yaml` (39 repositories), plus the JavaScript subpaths of [`github/codeql-action`](https://github.com/github/codeql-action): `init`, `autobuild`, `analyze`, and `upload-sarif`. The root CodeQL action is composite and is not a separate scope entry. Callers pin the subpath, and the PURL identity drops it, so the rules use `pkg:github/github/codeql-action`. The majors, release boundaries, and `runs.using` values are the reviewed inventory at `tools/coverage/expected/github-actions-inventory.json`. The scope list is `tools/coverage/expected/github-actions.json`. A maintainer tool, `tools/coverage/refresh-actions-inventory.ts`, refreshes that inventory from GitHub. It does not write rules. The weekly importers workflow opens an inventory-only pull request when the snapshot changes.

### Coverage status

The table below is filled by `tools/coverage/actions.ts`. It is not edited by hand.

<!-- actions-coverage:begin -->

| Action | Status | Missing majors |
| --- | --- | --- |
| actions/add-to-project | complete | — |
| actions/ai-inference | complete | — |
| actions/attest | complete | — |
| actions/attest-build-provenance | limit | — |
| actions/attest-sbom | limit | — |
| actions/cache | complete | — |
| actions/checkout | complete | — |
| actions/component-detection-dependency-submission-action | limit | — |
| actions/configure-pages | complete | — |
| actions/container-action | limit | — |
| actions/container-prebuilt-action | limit | — |
| actions/container-toolkit-action | limit | — |
| actions/create-github-app-token | complete | — |
| actions/delete-package-versions | complete | — |
| actions/dependency-review-action | complete | — |
| actions/deploy-pages | complete | — |
| actions/download-artifact | complete | — |
| actions/first-interaction | complete | — |
| actions/github-script | complete | — |
| actions/go-dependency-submission | complete | — |
| actions/gradle-build-tools-actions | limit | — |
| actions/hello-world-docker-action | limit | — |
| actions/hello-world-javascript-action | limit | — |
| actions/javascript-action | limit | — |
| actions/jekyll-build-pages | limit | — |
| actions/labeler | complete | — |
| actions/maven-dependency-submission-action | limit | — |
| actions/publish-action | complete | — |
| actions/publish-immutable-action | complete | — |
| actions/setup-dotnet | complete | — |
| actions/setup-go | complete | — |
| actions/setup-java | complete | — |
| actions/setup-node | complete | — |
| actions/setup-python | complete | — |
| actions/stale | complete | — |
| actions/typescript-action | limit | — |
| actions/upload-artifact | complete | — |
| actions/upload-code-coverage | limit | — |
| actions/upload-pages-artifact | limit | — |
| github/codeql-action/init | complete | — |
| github/codeql-action/autobuild | complete | — |
| github/codeql-action/analyze | complete | — |
| github/codeql-action/upload-sarif | complete | — |

<!-- actions-coverage:end -->

### Limits

- **Templates:** `typescript-action`, `container-action`, `container-toolkit-action`, and `container-prebuilt-action` are starter repositories with no integer major at 1 or above. `hello-world-docker-action` publishes majors that set `runs.using` to `docker`. `hello-world-javascript-action` and `javascript-action` publish v1 with `runs.using` set to node12, covered by their node12 end rules.
- **Composite, no Node runtime:** `upload-pages-artifact`, `attest-build-provenance`, `attest-sbom`, and `upload-code-coverage`. `gradle-build-tools-actions` has no version tags. Its root `action.yml` is a composite stub that tells callers to use `gradle/actions/setup-gradle` or `gradle/actions/dependency-submission`.
- **CodeQL subpaths:** `init`, `autobuild`, `analyze`, and `upload-sarif` use node12 on v1, node16 on v2, node20 on v3, and node24 on v4. One set of end rules on `pkg:github/github/codeql-action` covers all four.
- **Pages on GitHub.com:** From 2025-01-30, custom Pages workflows must use `actions/upload-pages-artifact@v3` and `actions/deploy-pages@v4` ([changelog](https://github.blog/changelog/2024-12-05-deprecation-notice-github-pages-actions-to-require-artifacts-actions-v4-on-github-com/)). That requirement does not affect GitHub Enterprise Server. `configure-pages` and `deploy-pages` keep their Node.js runtime rules.
- **Docker:** `jekyll-build-pages` sets `runs.using` to `docker`.
- **No major tags:** `publish-action` (v0.1.0–v0.4.0) and `publish-immutable-action` (v0–v0.0.4) publish only 0.x tags. `maven-dependency-submission-action` and `component-detection-dependency-submission-action` had no git tags on 2026-11-15.
- **delete-package-versions:** v1–v2 use node12, v3–v4 use node16, and v5 uses node20. The default branch still uses node20, so the replacement does not name a major.
- **go-dependency-submission:** v1 uses node16 and v2 uses node20. The default branch uses node24 and has no major tag, so the replacement does not name v2.
- **Artifact and cache:** `github-actions.upload-artifact.v1-v2` and `github-actions.download-artifact.v1-v2` cover versions below 3.0.0, removed on 2024-06-30. `github-actions.upload-artifact.retired` and `github-actions.download-artifact.retired` cover v3 (`>=3.0.0|<4.0.0`), removed on 2025-01-30, with brownouts on 2025-01-09, 2025-01-16, and 2025-01-23. That service removal does not affect GitHub Enterprise Server ([v1 and v2](https://github.blog/changelog/2024-02-13-deprecation-notice-v1-and-v2-of-the-artifact-actions/), [v3](https://github.blog/changelog/2024-04-16-deprecation-notice-v3-of-the-artifact-actions/)). Later node20 majors are separate end-of-support rules: upload `>=4.0.0|<6.0.0` and download `>=4.0.0|<7.0.0`, so upload 6.0.0 is clean. `github-actions.cache.service-v1-v2` covers cache below 3.0.0, retired on 2025-03-01, with brownouts on 2025-02-04, 2025-02-11, and 2025-02-18, and does not affect GitHub Enterprise Server. `github-actions.cache.node20` is the runtime band `>=3.0.0|<5.0.0` only.

### Checker

```bash
npm run build --silent
node dist/tools/coverage/actions.js
```

The checker reads only the scope file, the inventory, and `registry/github-actions.json`. It does not fetch the network. Exit code `0` means complete, `1` means at least one in-scope action still has a gap (the docs table is still written with `--write-docs`), and `2` means a checker or write error. The weekly importers workflow refreshes the inventory snapshot (network, in that workflow only), including actions that have a coverage limit. The inventory job is the only step that opens a coverage-gap issue. When the refreshed file differs from the default branch, that job copies only that file onto a branch cut from the default branch, checks that the pull request diff is exactly that file, and then pushes. It does not edit `registry/`.

## npm packages

This first review for [#1007](https://github.com/velella-sh/ebb/issues/1007) covers high-download candidates among older dependencies, Babel proposal plugins, and TypeScript declarations. It includes the 26 shortlisted packages with at least seven million downloads from 2026-11-20 through 2026-11-26, ranked by the [npm downloads endpoint](https://github.com/npm/registry/blob/main/docs/download-counts.md). On 2026-11-28, Ebb checked the [npm registry's per-version deprecation flags](https://github.com/npm/registry/blob/main/docs/responses/package-metadata.md) at the sources below. Download counts determine review order. Each lifecycle claim uses the flag and notice for the affected versions.

Seven rules cover six packages in this batch. Each rule has released matching and nonmatching versions in `cases/npm.json`. The notices for these releases give no deprecation day, so the rules leave the deadline unset.

| Package and registry evidence | Canonical PURL | Downloads | Coverage result |
| --- | --- | ---: | --- |
| [glob](https://registry.npmjs.org/glob) | `pkg:npm/glob` | 528,585,876 | Deferred. Reconcile the distinct notices and releases without a flag before forming ranges. |
| [uuid](https://registry.npmjs.org/uuid) | `pkg:npm/uuid` | 382,637,497 | Added through 10.0.0. The notice says 10 and earlier are unsupported. 11.0.0 and its prerelease have no flag. |
| [rimraf](https://registry.npmjs.org/rimraf) | `pkg:npm/rimraf` | 204,726,104 | Deferred. Separate the maintenance notice for older majors from release-specific replacement notices. |
| [jsdom](https://registry.npmjs.org/jsdom) | `pkg:npm/jsdom` | 158,130,827 | No version carries a deprecation flag in the inspected metadata. |
| [node-domexception](https://registry.npmjs.org/node-domexception) | `pkg:npm/node-domexception` | 108,138,872 | Deferred. All 4 published versions are flagged, so the shortlist review found no released comparison version. |
| [whatwg-encoding](https://registry.npmjs.org/whatwg-encoding) | `pkg:npm/whatwg-encoding` | 95,501,545 | Deferred. All 10 published versions are flagged, so the shortlist review found no released comparison version. |
| [@types/qs](https://registry.npmjs.org/@types%2Fqs) | `pkg:npm/%40types/qs` | 83,151,432 | No version carries a deprecation flag in the inspected metadata. |
| [@types/jest](https://registry.npmjs.org/@types%2Fjest) | `pkg:npm/%40types/jest` | 54,873,118 | Added 26.0.5, the release with the mock typing regression. 26.0.6 has no flag. |
| [@babel/plugin-proposal-private-property-in-object](https://registry.npmjs.org/@babel%2Fplugin-proposal-private-property-in-object) | `pkg:npm/%40babel/plugin-proposal-private-property-in-object` | 49,748,446 | Deferred. The unflagged 7.21.0-placeholder-for-preset-env.2 needs an explicit exception when defining the range. |
| [@types/uuid](https://registry.npmjs.org/@types%2Fuuid) | `pkg:npm/%40types/uuid` | 45,552,525 | Added 3.3.27 and 3.3.28 for the uuid.js declarations, and 11.0.0 for the uuid declaration stub. 3.4.0 and 10.0.0 have no flag. |
| [asn1js](https://registry.npmjs.org/asn1js) | `pkg:npm/asn1js` | 38,944,887 | No version carries a deprecation flag in the inspected metadata. |
| [@types/fs-extra](https://registry.npmjs.org/@types%2Ffs-extra) | `pkg:npm/%40types/fs-extra` | 26,319,301 | No version carries a deprecation flag in the inspected metadata. |
| [@types/minimatch](https://registry.npmjs.org/@types%2Fminimatch) | `pkg:npm/%40types/minimatch` | 22,776,568 | Added the 6.0.0 stub. 5.1.2 has no flag. |
| [querystring](https://registry.npmjs.org/querystring) | `pkg:npm/querystring` | 17,334,305 | Already covered by an npm registry rule. |
| [@babel/plugin-proposal-class-properties](https://registry.npmjs.org/@babel%2Fplugin-proposal-class-properties) | `pkg:npm/%40babel/plugin-proposal-class-properties` | 16,299,944 | Deferred. All 65 published versions are flagged, so the shortlist review found no released comparison version. |
| [har-validator](https://registry.npmjs.org/har-validator) | `pkg:npm/har-validator` | 13,416,570 | Already covered by an npm registry rule. |
| [source-map-resolve](https://registry.npmjs.org/source-map-resolve) | `pkg:npm/source-map-resolve` | 12,703,649 | Deferred. All 14 published versions are flagged, so the shortlist review found no released comparison version. |
| [@babel/plugin-proposal-object-rest-spread](https://registry.npmjs.org/@babel%2Fplugin-proposal-object-rest-spread) | `pkg:npm/%40babel/plugin-proposal-object-rest-spread` | 12,614,919 | Deferred. All 86 published versions are flagged, so the shortlist review found no released comparison version. |
| [@babel/plugin-proposal-optional-chaining](https://registry.npmjs.org/@babel%2Fplugin-proposal-optional-chaining) | `pkg:npm/%40babel/plugin-proposal-optional-chaining` | 11,319,813 | Deferred. All 70 published versions are flagged, so the shortlist review found no released comparison version. |
| [@babel/plugin-proposal-nullish-coalescing-operator](https://registry.npmjs.org/@babel%2Fplugin-proposal-nullish-coalescing-operator) | `pkg:npm/%40babel/plugin-proposal-nullish-coalescing-operator` | 10,896,262 | Deferred. All 59 published versions are flagged, so the shortlist review found no released comparison version. |
| [resolve-url](https://registry.npmjs.org/resolve-url) | `pkg:npm/resolve-url` | 10,281,458 | Already covered by an npm registry rule. |
| [urix](https://registry.npmjs.org/urix) | `pkg:npm/urix` | 10,199,842 | Deferred. All 1 published versions are flagged, so the shortlist review found no released comparison version. |
| [@npmcli/move-file](https://registry.npmjs.org/@npmcli%2Fmove-file) | `pkg:npm/%40npmcli/move-file` | 9,179,182 | Already covered by an npm registry rule. |
| [@babel/plugin-proposal-numeric-separator](https://registry.npmjs.org/@babel%2Fplugin-proposal-numeric-separator) | `pkg:npm/%40babel/plugin-proposal-numeric-separator` | 8,616,169 | Deferred. All 56 published versions are flagged, so the shortlist review found no released comparison version. |
| [@types/dompurify](https://registry.npmjs.org/@types%2Fdompurify) | `pkg:npm/%40types/dompurify` | 8,346,208 | Added the 3.2.0 stub. 3.0.5 has no flag. |
| [@types/bcryptjs](https://registry.npmjs.org/@types%2Fbcryptjs) | `pkg:npm/%40types/bcryptjs` | 7,943,601 | Added the 3.0.0 stub. 2.4.6 has no flag. |

A candidate check installs the built npm tarball and validates representative matches through `check()` and the generated static API. The [0.2.4 release verification](https://github.com/velella-sh/ebb/issues/1023) tracks the same checks against the published package and deployed API.
