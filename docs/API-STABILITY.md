---
title: "API stability and entry points"
description: "Every @velella/ebb package entry point, what api/ebb.api.md locks in CI, and how pre-1.0 deprecation works."
layout: doc
permalink: /api-stability/
---

`@velella/ebb` exposes a single locked TypeScript entry point at the package root (`@velella/ebb`), alongside temporary `"./*"` subpath exports kept for `0.x` compatibility and experimental helpers.

## What the API report enforces

CI locks the root entry point (`"."` → [`src/index.ts`](https://github.com/velella-sh/ebb/blob/main/src/index.ts)) by running `npm run api:check` (`api-extractor run --print-api-report-diff`) against [`api/ebb.api.md`](https://github.com/velella-sh/ebb/blob/main/api/ebb.api.md).

What that check **does** enforce:

- Every public runtime export (`check`, `checkAll`, `rulesFor`, `replacementFor`) and public type exported from `@velella/ebb`, plus their TypeScript signatures. Any unreviewed signature or export diff fails CI until `api/ebb.api.md` is updated in the same PR.

What that check **does not** promise:

- **No subpaths are locked.** Nothing under `@velella/ebb/*` is checked by `api/ebb.api.md`. Tests verify that legacy `0.1.0` subpaths resolve and load, not that internal types or non-root exports stay unchanged.
- **No CommonJS support.** `require("@velella/ebb")` maps to [`src/cjs-error.cts`](https://github.com/velella-sh/ebb/blob/main/src/cjs-error.cts) and throws an explicit ESM-only error directing callers to dynamic `import("@velella/ebb")`.
- **Pre-`1.0` status.** While the package version is `0.x`, reviewed PRs can still update `api/ebb.api.md` when needed.
- **Field-level `@experimental` tags.** Inside `Result` / `CheckResult` and `ResultMatch` / `CheckMatch`, `asOf` and `daysLeft` carry `@experimental` JSDoc tags (see [Result model](result-model.md)) and may still evolve before `1.0`; API Extractor records their TypeScript types, not their runtime invariants.

## Root and manifest entry points

| Entry point | Classification | Locked by `api/ebb.api.md` | Exports & notes |
| --- | --- | --- | --- |
| `@velella/ebb` | Root public API (ESM only; `require` throws ESM-only error) | Yes | Runtime: `check`, `checkAll`, `createEbb`, `preload`, `rulesFor`, `replacementFor`. Types: `CheckAllEntry`, `CheckAllError`, `CheckAllErrorCode`, `CheckAllItem`, `CheckAllResult`, `CheckAllSummary`, `CheckEvent`, `CheckMatch`, `CheckResult`, `CheckStatus`, `CreateEbbOptions`, `EbbErrorCode`, `EbbInstance`, `EcosystemDataInput`, `EcosystemInput`, `EvidenceSource`, `Result`, `ResultEvent`, `ResultMatch`, `ResultStatus`, `Rule`, `RuleEvent`, `RulesForOptions`. |
| `@velella/ebb/package.json` | Package metadata | No | Static JSON [`package.json`](https://github.com/velella-sh/ebb/blob/main/package.json) via `"./package.json"`. |
| `@velella/ebb/create` | Factory entry point | No | Runtime: `createEbb`. Scoped instance factory. |
| `@velella/ebb/data/load` | Data loading & preload | No | Runtime: `loadEcosystem`, `loadEcosystemSync`, `preload`, `purlToEcosystems`. |
| `@velella/ebb/data/<ecosystem>` | Ecosystem data subpaths | No | 25 modules (`npm`, `python`, etc.) exporting `rules` (default and named), `data`, and `ecosystem`. |

## Experimental and `0.2.0` subpaths

Resolved through the temporary `"./*"` export in [`package.json`](https://github.com/velella-sh/ebb/blob/main/package.json). These subpaths are **experimental** until `1.0` and are not tracked by [`api/ebb.api.md`](https://github.com/velella-sh/ebb/blob/main/api/ebb.api.md). Prefer importing `check`, `checkAll`, `rulesFor`, and `replacementFor` from `@velella/ebb` instead.

| Entry point | Main exports / role | Notes |
| --- | --- | --- |
| `@velella/ebb/check-all` | `checkAll`, `isCheckAllError` | Use `checkAll` from `@velella/ebb`; `isCheckAllError` and the subpath itself are experimental. |
| `@velella/ebb/replacement` | `replacementFor` | Use `replacementFor` from `@velella/ebb`. |
| `@velella/ebb/result-compat` | `fromLookupProduct` | Experimental adapter from legacy `LookupResult` to `Result` (see [Result model](result-model.md)). |
| `@velella/ebb/rules-for` | `rulesFor` | Use `rulesFor` from `@velella/ebb`. |
| `@velella/ebb/vers/errors` | `VersError` | Internal VERS error module extracted from `vers`. |
| `@velella/ebb/vers/schemes` | `SUPPORTED_SCHEMES`, `intdotScheme` | Internal VERS scheme registry module. |
| `@velella/ebb/index` | Same as `@velella/ebb` via `"./*"` | Resolves accidentally through the wildcard; import `@velella/ebb` instead. |

## Deprecated `0.1.0` subpaths

Every source module shipped in `0.1.0` resolves in `0.x` via `"./*"` so existing consumers keep working without breakage, verified in CI by `tests/exports/legacy.test.ts` and `tests/exports/pack.test.ts`. Each subpath's main export carries a `@deprecated` JSDoc tag pointing editors to `@velella/ebb` (verified by `tests/exports/deprecations.test.ts`). None of these subpaths are locked by `api/ebb.api.md`.

| Subpath | Main deprecated export | Replacement / status before `1.0` |
| --- | --- | --- |
| `@velella/ebb/as-of` | `applyAsOf` | `check(purl, version, asOf)` on `@velella/ebb`; scan helper stays deprecated for removal in `1.0`. |
| `@velella/ebb/bundled-rules` | `bundledRules` | Internal rule loader; subpath deprecated for removal in `1.0`. |
| `@velella/ebb/cache-paths` | `defaultCacheDirectory` | Internal cache path helper; deprecated for removal in `1.0`. |
| `@velella/ebb/check` | `check` | Import `check` from `@velella/ebb`. |
| `@velella/ebb/countdown` | `runCountdown` | Internal CLI/UI helper; deprecated for removal in `1.0`. |
| `@velella/ebb/data-bundle` | `buildDataBundle` | Internal data bundle helper; deprecated for removal in `1.0`. |
| `@velella/ebb/data-release-log` | `verifyReleaseLog` | Internal release log helper; deprecated for removal in `1.0`. |
| `@velella/ebb/data-signature` | `verifyArtifactSignature` | Internal Sigstore helper; deprecated for removal in `1.0`. |
| `@velella/ebb/data-source` | `getActiveData` | Data source loader; subpath deprecated for removal in `1.0`. |
| `@velella/ebb/data-status` | `getDataStatus` | Data freshness helper; subpath deprecated for removal in `1.0`. |
| `@velella/ebb/data-update` | `updateData` | Network cache updater; subpath deprecated for removal in `1.0`. |
| `@velella/ebb/domain` | `LifecycleScan` | `EvidenceSource` is exported from `@velella/ebb`; subpath deprecated for removal in `1.0`. |
| `@velella/ebb/errors` | `EbbError` | `EbbErrorCode` is exported from `@velella/ebb`; subpath deprecated for removal in `1.0`. |
| `@velella/ebb/export/cle` | `exportCle` | Internal CLE exporter; deprecated for removal in `1.0`. |
| `@velella/ebb/forecast` | `buildForecast` | Internal forecast helper; deprecated for removal in `1.0`. |
| `@velella/ebb/lookup` | `lookupProduct` | Import `check` from `@velella/ebb`. |
| `@velella/ebb/min-support` | `applyMinSupport` | Internal scan helper; deprecated for removal in `1.0`. |
| `@velella/ebb/package-files` | `findPackageFile` | Internal package file resolver; deprecated for removal in `1.0`. |
| `@velella/ebb/product-name` | `rankProductsForName` | Internal alias/ranking helper; deprecated for removal in `1.0`. |
| `@velella/ebb/purl` | `parsePurl` | Internal PURL parser; deprecated for removal in `1.0`. |
| `@velella/ebb/registry` | `validateRegistryV2` | Internal registry validator; `Rule` type is exported from `@velella/ebb`. |
| `@velella/ebb/required` | `required` | Internal assertion helper; deprecated for removal in `1.0`. |
| `@velella/ebb/result` | `daysLeft` | `Result`, `ResultEvent`, `ResultMatch`, and `ResultStatus` are exported from `@velella/ebb`; subpath deprecated for removal in `1.0`. |
| `@velella/ebb/rule-guards` | `validateRegistry` | Internal registry guard; deprecated for removal in `1.0`. |
| `@velella/ebb/rule-lint` | `lintRuleFiles` | Maintainer lint helper; deprecated for removal in `1.0`. |
| `@velella/ebb/rule-versions` | `kubernetesRuleVersion` | Internal rule version translator; deprecated for removal in `1.0`. |
| `@velella/ebb/vers` | `versContains` | Internal VERS range engine; deprecated for removal in `1.0`. |
| `@velella/ebb/vers/gem` | `gemScheme` | Internal RubyGems scheme; deprecated for removal in `1.0`. |
| `@velella/ebb/vers/index` | `versContains` | Re-export of `@velella/ebb/vers`; deprecated for removal in `1.0`. |
| `@velella/ebb/vers/maven` | `mavenScheme` | Internal Maven scheme; deprecated for removal in `1.0`. |
| `@velella/ebb/vers/nuget` | `nugetScheme` | Internal NuGet scheme; deprecated for removal in `1.0`. |
| `@velella/ebb/vers/pep440` | `pep440Scheme` | Internal PEP 440 scheme; deprecated for removal in `1.0`. |
| `@velella/ebb/vers/semver` | `semverScheme` | Internal SemVer scheme; deprecated for removal in `1.0`. |
| `@velella/ebb/version` | `VERSION` | Package version constant; read `@velella/ebb/package.json` instead. |

## Deprecation rule before `1.0`

1. **Keep `0.1.x` subpaths working during `0.x`.** Every `0.1.0` subpath above continues to resolve via `"./*"` and load from the packed npm tarball across `0.x` releases.
2. **Surface `@deprecated` in editors.** TypeScript consumers importing legacy subpaths see `@deprecated` diagnostics pointing to `@velella/ebb`; imports from `@velella/ebb` itself produce none.
3. **Remove `"./*"` in `1.0.0`.** Only intentionally exposed entry points (`"."` and `"./package.json"`, plus any explicitly promoted subpaths added with API coverage before release) remain in `1.0.0`. Internal modules and deprecated `0.1.x` subpaths will stop resolving directly at that major boundary.
