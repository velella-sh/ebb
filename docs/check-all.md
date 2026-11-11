---
title: "Batch checking with checkAll"
description: "Synchronously evaluate SBOMs and lockfiles with exact input order, pair deduplication, summary counts, and positional error entries."
layout: doc
permalink: /check-all/
---

[`checkAll(items)`](https://github.com/velella-sh/ebb/blob/main/src/check-all.ts) checks a batch of components synchronously on top of [`check`](https://github.com/velella-sh/ebb/blob/main/src/check.ts) and returns both positional outcomes and batch counts:

```ts
import { checkAll, isCheckAllError } from "@velella/ebb/check-all";
```

By design, `checkAll` never reads SBOM or lockfile files and never touches the network; only the first evaluation loads Ebb's active local rule index (later calls reuse the warm index). Map your SBOM components or lockfile entries into `{ purl, version }` objects before calling it.

## CycloneDX SBOM example

The runnable example below builds a CycloneDX `1.5` component list modeled on [`tests/check-all/fixtures/sbom.json`](https://github.com/velella-sh/ebb/blob/main/tests/check-all/fixtures/sbom.json), adding two invalid entries (`"pkg:"` and a component with no `version`) and keeping a duplicated dependency (`request@2.88.2`).

```ts
import { checkAll, isCheckAllError } from "@velella/ebb/check-all";

const sbom = {
  bomFormat: "CycloneDX",
  specVersion: "1.5",
  components: [
    { name: "express", version: "4.21.0", purl: "pkg:npm/express@4.21.0" },
    { name: "request", version: "2.88.2", purl: "pkg:npm/request@2.88.2" },
    { name: "node-sass", version: "9.0.0", purl: "pkg:npm/node-sass@9.0.0" },
    { name: "dotnet", version: "9.0.0", purl: "pkg:generic/dotnet@9.0.0" },
    { name: "nodejs", version: "22.12.0", purl: "pkg:generic/nodejs@22.12.0" },
    { name: "request", version: "2.88.2", purl: "pkg:npm/request@2.88.2" },
    { name: "broken-purl", version: "1.0.0", purl: "pkg:" },
    { name: "express", purl: "pkg:npm/express" },
    { name: "@types/node", version: "22.10.0", purl: "pkg:npm/%40types/node@22.10.0" },
  ],
};

const { results, summary } = checkAll(
  sbom.components.map((component) => ({
    purl: component.purl ?? component.name,
    version: component.version ?? "",
  })),
);

const findings = results.filter((entry) => !isCheckAllError(entry) && entry.status !== "ok");
const errors = results.filter(isCheckAllError);

console.log(JSON.stringify({ summary, findingCount: findings.length, errors }, null, 2));
```

Output:

```json
{
  "summary": {
    "total": 9,
    "byStatus": {
      "ok": 2,
      "deprecated": 2,
      "unsupported": 1,
      "end-of-life": 1,
      "removed": 0,
      "scheduled": 1
    },
    "byEvent": {
      "deprecated": 5,
      "unsupported": 1,
      "end-of-life": 1,
      "removed": 0,
      "scheduled": 1
    },
    "errors": 2
  },
  "findingCount": 5,
  "errors": [
    {
      "status": "error",
      "index": 6,
      "code": "invalid-purl",
      "message": "PURL is missing a type: pkg:"
    },
    {
      "status": "error",
      "index": 7,
      "code": "invalid-version",
      "message": "Invalid version \"\"."
    }
  ]
}
```

Notice what happens in that run:
- `results.length === 9` and `results[i]` stays aligned with `sbom.components[i]` — nothing is sorted or dropped.
- `request@2.88.2` appears at indexes `1` and `5`. `(purl, version)` is judged once, both positions receive the cached [`CheckResult`](result-model.md), and both occurrences contribute to `summary`.
- Index `6` (`"pkg:"`) and index `7` (missing `version`) produce positional `CheckAllError` objects without aborting index `8` (`@types/node@22.10.0`).
- `byStatus` counts each valid item once by its primary verdict (`ok: 2`, `deprecated: 2`, `unsupported: 1`, `end-of-life: 1`, `scheduled: 1`, total valid `7`, plus `errors: 2` equals `total: 9`). `byEvent` counts every matched rule event across valid items (`request@2.88.2` matches two `deprecated` rules twice, and `node-sass@9.0.0` matches both an `end-of-life` rule and a `deprecated` rule, giving `byEvent.deprecated === 5`).

Every valid entry in `results` has the schema documented in [Result model](result-model.md):

```json
{
  "schemaVersion": 1,
  "status": "end-of-life",
  "matches": [
    {
      "ruleId": "npm.package.node-sass.eol",
      "event": "end-of-life",
      "date": "2024-07-24",
      "daysLeft": null,
      "replacement": "sass",
      "sources": [
        {
          "title": "Node Sass is end-of-life",
          "url": "https://sass-lang.com/blog/node-sass-is-end-of-life/",
          "accessedAt": "2026-10-16"
        }
      ],
      "reviewedAt": "2026-10-14"
    },
    {
      "ruleId": "npm.package.node-sass.deprecated",
      "event": "deprecated",
      "date": null,
      "daysLeft": null,
      "replacement": "sass",
      "sources": [
        {
          "title": "node-sass package deprecation notice",
          "url": "https://www.npmjs.com/package/node-sass",
          "accessedAt": "2026-10-30"
        },
        {
          "title": "node-sass registry metadata",
          "url": "https://registry.npmjs.org/node-sass",
          "accessedAt": "2026-10-30"
        }
      ],
      "reviewedAt": "2026-10-30"
    }
  ],
  "version": "9.0.0"
}
```

## Streaming iterables

`checkAll` accepts any `Iterable<CheckAllItem>`. Arrays use an indexed fast path with a pre-sized output array; generators, `Set`s, and other iterables stream in a single pass without building a second intermediate list first:

```ts
import { checkAll, isCheckAllError } from "@velella/ebb/check-all";

function* itemsFromLockfile() {
  yield { purl: "pkg:npm/express", version: "4.21.0" };
  yield { purl: "pkg:npm/node-sass", version: "9.0.0" };
  yield { purl: "pkg:npm/request", version: "2.88.2" };
}

const { results, summary } = checkAll(itemsFromLockfile());

console.log(
  JSON.stringify({
    statuses: results.map((entry) => (isCheckAllError(entry) ? entry.code : entry.status)),
    total: summary.total,
  }),
);
```

Output:

```json
{"statuses":["ok","end-of-life","deprecated"],"total":3}
```

## API and types

[`src/check-all.ts`](https://github.com/velella-sh/ebb/blob/main/src/check-all.ts) exports:

| Symbol | Role |
| --- | --- |
| `checkAll(items)` | Evaluates `Iterable<CheckAllItem>` synchronously and returns `CheckAllResult`. |
| `CheckAllItem` | `{ readonly purl: string; readonly version: string }` — PURL or product name, plus required version string. |
| `CheckAllResult` | `{ results: CheckAllEntry[]; summary: CheckAllSummary }` |
| `CheckAllEntry` | `CheckResult \| CheckAllError` |
| `isCheckAllError(entry)` | Type guard narrowing a `CheckAllEntry` to `CheckAllError` (`entry.status === "error"`). |
| `CheckAllSummary` | `{ total, byStatus, byEvent, errors }` |
| `CheckAllError` | `{ readonly status: "error"; readonly index: number; readonly code: CheckAllErrorCode; readonly message: string }` |
| `CheckAllErrorCode` | Reason code recorded when judging an individual item fails. |

### `CheckAllItem` requirements

Every item needs both `purl` and `version`. Even when a PURL from CycloneDX or SPDX already includes `@version` (`pkg:npm/request@2.88.2`), `checkAll` still evaluates against `item.version` (`"2.88.2"`). If a component has no version, `item.version` is empty and produces an `"invalid-version"` error entry at that index rather than guessing from the PURL.

### `CheckAllErrorCode` values

| Code | When emitted |
| --- | --- |
| `"invalid-purl"` | `purl` starts with `pkg:` but is malformed (`PurlError` / `EbbError`). |
| `"invalid-version"` | `version` is empty/whitespace or invalid for the matched rule's version scheme (`VersError`). |
| `"unknown-product"` | Bare product name (without `pkg:`) does not match any product in the active rules (`CheckError`). |
| `"ambiguous-product"` | Bare product name ties across multiple ecosystems or packages (`CheckError`); pass a full `pkg:` PURL instead. |
| `"invalid-data-version"` | Active data configuration pins an invalid data version (`EbbError`). |
| `"invalid-date"` | Query supplied an invalid ISO date (`EbbError`). |
| `"package-file-not-found"` | Required bundled package file could not be located (`EbbError`). |
| `"internal"` | Unexpected internal error encountered while processing the item (`EbbError`). |
| `"data-unavailable"` | Configured data bundle could not be loaded (`EbbError`). |
| `"data-unavailable"` | Configured data bundle could not be loaded (`EbbError`). |
| `"data-update-failed"` | Active data source failed verification or loading (`EbbError`). |
| `"check-failed"` | Fallback when checking an item throws any other error. |
