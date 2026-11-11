---
title: "Result model"
description: "Field-by-field reference, JSON Schema v1, stability tags, and lookupProduct compatibility for Ebb's Result model."
layout: doc
permalink: /result-model/
---

Every `check(purlOrName, version, asOf?)` call and [`fromLookupProduct`](https://github.com/velella-sh/ebb/blob/main/src/result-compat.ts) conversion returns a `Result` conforming to [`schemas/result.v1.schema.json`](https://github.com/velella-sh/ebb/blob/main/schemas/result.v1.schema.json) (JSON Schema draft `2020-12`). Types live in [`src/result.ts`](https://github.com/velella-sh/ebb/blob/main/src/result.ts), [`src/check.ts`](https://github.com/velella-sh/ebb/blob/main/src/check.ts), and [`src/domain.ts`](https://github.com/velella-sh/ebb/blob/main/src/domain.ts).

Stability tags on `Result` and `ResultMatch` match the JSDoc annotations in `src/result.ts`:
- `@stable`: additive-only contract through 1.0; field name and meaning will not change incompatibly.
- `@experimental`: evolving behavior; field name, optionality, or semantics are not promised and may change before 1.0.

## `check` → `Result` (`CheckResult`)

| Field | Type | Stability | Meaning |
| --- | --- | --- | --- |
| `schemaVersion` | `1` | `@stable` | Fixed version number of this result model (`RESULT_SCHEMA_VERSION`). |
| `status` | `"ok" \| "deprecated" \| "unsupported" \| "end-of-life" \| "removed" \| "scheduled"` | `@stable` | Primary verdict. `"ok"` when no rule matches; otherwise the most serious matching event (short names; see mapping below). |
| `matches` | `ResultMatch[]` | `@stable` | Every matching rule, ordered by event seriousness then earliest date. Empty when `status` is `"ok"`. |
| `version` | `string` | `@stable` | The version argument exactly as passed to `check` (not normalised). |
| `asOf` | `string` (optional) | `@experimental` | The day `daysLeft` is measured from (`YYYY-MM-DD`), when supplied. Omitted for the two-argument call. |

### `ResultMatch` (`CheckMatch`)

| Field | Type | Stability | Meaning |
| --- | --- | --- | --- |
| `ruleId` | `string` | `@stable` | Id of the matching registry rule. |
| `event` | `"deprecated" \| "unsupported" \| "end-of-life" \| "removed" \| "scheduled"` | `@stable` | Lifecycle event on that rule, in `check`'s short form. |
| `date` | `string \| null` | `@stable` | Deadline from the rule (`YYYY-MM-DD`), or `null` when the rule has no deadline. |
| `daysLeft` | `number \| null` | `@experimental` | Whole UTC days from `asOf` until `date`; `null` when past, undated, or `asOf` is omitted. |
| `replacement` | `string \| null` | `@stable` | Suggested replacement from the rule, or `null` when none. |
| `sources` | `EvidenceSource[]` | `@stable` | Authoritative evidence pages the rule cites. |
| `reviewedAt` | `string` | `@stable` | Date (`YYYY-MM-DD`) a maintainer last reviewed the rule against its sources. |

## Shared: `EvidenceSource`

Defined in `src/domain.ts` and used by both `ResultMatch.sources` and `LookupFinding.sources`.

| Field | Type | Meaning |
| --- | --- | --- |
| `title` | `string` | Name of the evidence page. |
| `url` | `string` | URL of that page (`https://`). |
| `accessedAt` | `string` (optional) | Day the page was reviewed (`YYYY-MM-DD`). |

## Complete examples

Scheduled release line with an explicit `asOf` day (`check("node", "22.12.0", "2026-04-01")`):

```json
{
  "schemaVersion": 1,
  "status": "scheduled",
  "matches": [
    {
      "ruleId": "nodejs.runtime.eol-22",
      "event": "scheduled",
      "date": "2027-04-30",
      "daysLeft": 394,
      "replacement": "Node.js 24 LTS or later",
      "sources": [
        {
          "title": "Node.js Release Working Group schedule",
          "url": "https://github.com/nodejs/Release/blob/main/schedule.json",
          "accessedAt": "2026-10-24"
        }
      ],
      "reviewedAt": "2026-10-24"
    }
  ],
  "version": "22.12.0",
  "asOf": "2026-04-01"
}
```

Supported or unknown package with no matching rule (`check("pkg:generic/nodejs", "24.0.0")`):

```json
{
  "schemaVersion": 1,
  "status": "ok",
  "matches": [],
  "version": "24.0.0"
}
```

## Field reference: `Result`

### `schemaVersion`

- **Stability:** `@stable`
- **Type:** integer constant `1` (`RESULT_SCHEMA_VERSION`, required)
- **Meaning:** Identifies schema `v1` of the result payload. New fields in `v1` are additive only; `schemaVersion` is never bumped without an accepted decision record.

Example:

```json
1
```

### `status`

- **Stability:** `@stable`
- **Type:** `"ok" | "deprecated" | "unsupported" | "end-of-life" | "removed" | "scheduled"` (required)
- **Meaning:** Primary verdict for the checked version. Always `"ok"` if and only if `matches` is empty; otherwise equals the `event` of the first element in `matches` (most serious event according to `lifecycleEventPrecedence`: `end-of-life`, `removed`, `unsupported`, `deprecated`, `scheduled`).

Example:

```json
"scheduled"
```

### `matches`

- **Stability:** `@stable`
- **Type:** `ResultMatch[]` (required)
- **Meaning:** Every active rule whose version range contains the input `version`, ordered by event seriousness first and earliest `date` second (undated rules sort after dated ones; ties preserve registry rule order). Empty (`[]`) when `status` is `"ok"`.

Example:

```json
[
  {
    "ruleId": "osv.npm.request",
    "event": "deprecated",
    "date": null,
    "daysLeft": null,
    "replacement": null,
    "sources": [
      {
        "title": "GHSA-p8p7-x288-28g6",
        "url": "https://osv.dev/vulnerability/GHSA-p8p7-x288-28g6",
        "accessedAt": "2026-10-27"
      }
    ],
    "reviewedAt": "2026-10-27"
  }
]
```

### `version`

- **Stability:** `@stable`
- **Type:** non-empty `string` containing non-whitespace characters (required)
- **Meaning:** The `version` string exactly as supplied by the caller, without stripping whitespace, leading `v`, or build metadata (`+...`), even though matching normalises those before testing `vers` ranges.

Example:

```json
"22.12.0"
```

### `asOf`

- **Stability:** `@experimental` (do not rely on this field name or shape as frozen before 1.0)
- **Type:** `YYYY-MM-DD` `string` (optional)
- **Meaning:** Present today when the caller passes an explicit `asOf` date string to `check` or `fromLookupProduct`, and omitted in the two-argument call. Never read from a system clock. Because `asOf` is `@experimental`, whether it remains optional on `Result`, changes name, or moves into another structure is not guaranteed across pre-1.0 releases.

Example:

```json
"2026-04-01"
```

## Field reference: `ResultMatch`

### `ruleId`

- **Stability:** `@stable`
- **Type:** `string` matching `^[a-z0-9]+(?:[.-][a-z0-9]+)*$` (required)
- **Meaning:** Identifier of the matched rule in `registry/*.json` (for example `"nodejs.runtime.eol-22"` or `"npm.package.request.deprecated"`).

Example:

```json
"nodejs.runtime.eol-22"
```

### `event`

- **Stability:** `@stable`
- **Type:** `"deprecated" | "unsupported" | "end-of-life" | "removed" | "scheduled"` (required)
- **Meaning:** Lifecycle event recorded on the matching rule, expressed in the result model's short enum (mapping `"end-of-support"` to `"unsupported"` and `"scheduled-end-of-life"` to `"scheduled"`). Status and event values are never renamed.

Example:

```json
"deprecated"
```

### `date`

- **Stability:** `@stable`
- **Type:** `YYYY-MM-DD` `string | null` (required)
- **Meaning:** Announced lifecycle deadline from the rule, or `null` when the rule carries no deadline date.

Example:

```json
"2027-04-30"
```

### `daysLeft`

- **Stability:** `@experimental` (do not treat this behavior as promised before 1.0)
- **Type:** positive `integer` (`>= 1`) or `null` (required in v1 JSON, value semantics are experimental)
- **Meaning:** Currently reports whole UTC calendar days from `asOf` until `date` when `asOf` is provided and `date` is strictly after `asOf`, and `null` otherwise (past, same-day, undated, or two-argument no-`asOf` calls). Because `daysLeft` is `@experimental`, its name, nullability, whether past deadlines report negative counts, and which events populate it are not promised before 1.0.

Example:

```json
394
```

### `replacement`

- **Stability:** `@stable`
- **Type:** non-empty `string | null` (required)
- **Meaning:** Maintainer-reviewed replacement guidance from the rule when present, or `null` when the rule does not specify a replacement.

Example:

```json
"Node.js 24 LTS or later"
```

### `sources`

- **Stability:** `@stable`
- **Type:** non-empty array of `EvidenceSource` objects (`minItems: 1`, required)
- **Meaning:** Authoritative external pages (release schedules, package deprecations, official advisories) backing the rule's lifecycle claim.

Example:

```json
[
  {
    "title": "request package deprecation notice",
    "url": "https://www.npmjs.com/package/request",
    "accessedAt": "2026-10-13"
  }
]
```

### `reviewedAt`

- **Stability:** `@stable`
- **Type:** `YYYY-MM-DD` `string` (required)
- **Meaning:** Date a maintainer last reviewed the matched rule against its cited sources (`rule.provenance.reviewedAt`). Carried directly on each match so callers can check evidence freshness without consulting separate files.

Example:

```json
"2026-10-24"
```

## Field reference: `EvidenceSource`

Each entry in `ResultMatch.sources` matches `$defs.source` in `schemas/result.v1.schema.json`.

### `title`

- **Type:** non-empty `string` (required)
- **Meaning:** Human-readable title of the authoritative source document or notice.

Example:

```json
"Node.js Release Working Group schedule"
```

### `url`

- **Type:** `https://` URL `string` (required)
- **Meaning:** HTTPS link to the authoritative source page.

Example:

```json
"https://github.com/nodejs/Release/blob/main/schedule.json"
```

### `accessedAt`

- **Type:** `YYYY-MM-DD` `string` (optional)
- **Meaning:** Calendar day that source page was fetched or checked when recording provenance, when supplied by the registry rule. Distinct from `reviewedAt` on the rule/match.

Example:

```json
"2026-10-24"
```

## Status name mapping

`check` shortens two registry events; `lookupProduct` keeps the registry names and uses `"supported"` / `"ok"` differently for "nothing matched":

| Registry / `lookupProduct` status | `check` / `Result` status |
| --- | --- |
| `"supported"` (no match) | `"ok"` (no match) |
| `"deprecated"` | `"deprecated"` |
| `"end-of-support"` | `"unsupported"` |
| `"end-of-life"` | `"end-of-life"` |
| `"removed"` | `"removed"` |
| `"scheduled-end-of-life"` | `"scheduled"` |

## Legacy: `lookupProduct` → `LookupResult`

[`lookupProduct`](https://github.com/velella-sh/ebb/blob/main/src/lookup.ts) stays available for existing callers (`schemaVersion: "ebb.lookup.v1"`). Use [`fromLookupProduct(old, asOf?)`](https://github.com/velella-sh/ebb/blob/main/src/result-compat.ts) to convert a versioned `LookupResult` into the v1 `Result` model above.

| Field | Type | Meaning |
| --- | --- | --- |
| `schemaVersion` | `"ebb.lookup.v1"` | Fixed schema id for this legacy result shape. |
| `query` | `{ name: string; version?: string }` | Echo of the caller's arguments. `version` is omitted when the caller did not pass one. |
| `query.name` | `string` | Product name or package URL as given. |
| `query.version` | `string` (optional) | Version as given, when present. |
| `product` | `{ id: string; purl: string; name: string; ecosystems: string[] }` | The resolved product record. |
| `product.id` | `string` | Stable product id. |
| `product.purl` | `string` | Canonical package URL for the product. |
| `product.name` | `string` | Display name. |
| `product.ecosystems` | `string[]` | Ecosystems that product appears in. |
| `version` | `string` (optional) | Version as given; omitted when the caller did not pass one. |
| `status` | `LifecycleEvent \| "supported"` | Primary verdict from findings, or `"supported"` when none match. Uses registry event names (not `Result`'s short forms). |
| `deadline` | `string` (optional) | Earliest deadline among findings that have one; omitted when none do. |
| `replacement` | `string` (optional) | Replacement from the primary finding; omitted when that finding has none. |
| `findings` | `LookupFinding[]` | Matching rules (all product rules when no version; version-filtered otherwise), sorted by deadline then rule id. |

`LifecycleEvent` is `"deprecated" \| "end-of-support" \| "end-of-life" \| "removed" \| "scheduled-end-of-life"`.

### `LookupFinding`

| Field | Type | Meaning |
| --- | --- | --- |
| `ruleId` | `string` | Id of the matching registry rule. |
| `ecosystem` | `string` | Ecosystem the rule belongs to. |
| `event` | `LifecycleEvent` | Lifecycle event on that rule (registry names). |
| `severity` | `"info" \| "low" \| "medium" \| "high" \| "critical"` | How much attention the rule assigns. |
| `title` | `string` | Short rule title. |
| `summary` | `string` | Longer rule summary. |
| `deadline` | `string` (optional) | Rule deadline when present. |
| `replacement` | `string` (optional) | Suggested replacement when present. |
| `affectedVersions` | `string` | The rule's `vers` range string. |
| `sources` | `EvidenceSource[]` | Authoritative evidence pages the rule cites. |
